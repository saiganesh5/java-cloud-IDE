
package com.ganesh.java_cloud_IDE_backend.service;

import com.ganesh.java_cloud_IDE_backend.model.ExecutionRequest;
import com.ganesh.java_cloud_IDE_backend.model.ExecutionResponse;
import com.ganesh.java_cloud_IDE_backend.model.SourceFile;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class JavaExecutionService {

    private static final int EXECUTION_TIMEOUT_SECONDS = 60;

    public ExecutionResponse execute(ExecutionRequest request) throws Exception {

        if (request.getFiles() == null || request.getFiles().isEmpty()) {
            return new ExecutionResponse("", "No source files provided", 1);
        }

        Path projectDir = Files.createTempDirectory("java-project-");

        try {
            /* 1️ Write files */
            for (SourceFile file : request.getFiles()) {
                Path filePath = projectDir.resolve(file.getPath());
                Files.createDirectories(filePath.getParent());
                Files.writeString(filePath, file.getContent());
            }

            /* 2️ Discover Java files */
            List<Path> javaFiles;
            try (var stream = Files.walk(projectDir)) {
                javaFiles = stream
                        .filter(p -> p.toString().endsWith(".java"))
                        .toList();
            }

            if (javaFiles.isEmpty()) {
                return new ExecutionResponse("", "No Java files found", 1);
            }

            /* 3️ Detect main class */
            String mainClass = detectMainClass(javaFiles);

            /* 4️ Build compile command */
            String compileCmd = javaFiles.stream()
                    .map(p -> projectDir.relativize(p).toString())
                    .reduce("javac", (a, b) -> a + " " + b);

            /* 5️ Docker command (NO echo, STDIN enabled) */
            ProcessBuilder pb = new ProcessBuilder(
                    "docker", "run", "--rm", "-i",
                    "--cpus=0.5",
                    "--memory=256m",
                    "--network=none",
                    "-v", projectDir.toAbsolutePath() + ":/workspace",
                    "-w", "/workspace",
                    "java-runner:25",
                    "bash", "-c",
                    compileCmd + " && java " + mainClass
            );

            pb.redirectErrorStream(true);

            Process process = pb.start();

            /* WRITE INPUT SAFELY TO STDIN */
            if (request.getInput() != null && !request.getInput().isEmpty()) {
                process.getOutputStream()
                        .write(request.getInput().getBytes());
            }
            process.getOutputStream().close();

            /* 6️ Read output asynchronously (NO DEADLOCK) */
            String output = readStreamAsync(process.getInputStream());

            boolean finished = process.waitFor(
                    EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS
            );

            if (!finished) {
                process.destroyForcibly();
                return new ExecutionResponse(
                        output,
                        "Execution timed out",
                        1
                );
            }

            return new ExecutionResponse(
                    output,
                    "",
                    process.exitValue()
            );

        } finally {
            /* 7️ Cleanup */
            Files.walk(projectDir)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try { Files.deleteIfExists(p); }
                        catch (Exception ignored) {}
                    });
        }
    }

    /* Prevent stdout buffer deadlock */
    private String readStreamAsync(InputStream is) throws Exception {
        StringBuilder output = new StringBuilder();

        Thread reader = new Thread(() -> {
            try (Scanner sc = new Scanner(is)) {
                while (sc.hasNextLine()) {
                    output.append(sc.nextLine()).append("\n");
                }
            }
        });

        reader.start();
        reader.join();

        return output.toString();
    }

    /* Auto-detect main() with package support */
    private String detectMainClass(List<Path> javaFiles) throws Exception {

        Pattern packagePattern =
                Pattern.compile("package\\s+([a-zA-Z0-9_.]+)\\s*;");
        Pattern classPattern =
                Pattern.compile("public\\s+class\\s+(\\w+)");
        Pattern mainPattern =
                Pattern.compile("public\\s+static\\s+void\\s+main\\s*\\("));

        for (Path file : javaFiles) {
            String code = Files.readString(file);

            if (mainPattern.matcher(code).find()) {
                String pkg = "";

                Matcher pkgMatcher = packagePattern.matcher(code);
                if (pkgMatcher.find()) {
                    pkg = pkgMatcher.group(1) + ".";
                }

                Matcher classMatcher = classPattern.matcher(code);
                if (classMatcher.find()) {
                    return pkg + classMatcher.group(1);
                }
            }
        }

        throw new RuntimeException("No main method found");
    }
}

