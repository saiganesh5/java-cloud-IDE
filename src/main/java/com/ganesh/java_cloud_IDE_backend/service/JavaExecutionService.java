//package com.ganesh.java_cloud_IDE_backend.service;
//
//import com.ganesh.java_cloud_IDE_backend.model.ExecutionRequest;
//import com.ganesh.java_cloud_IDE_backend.model.ExecutionResponse;
//import com.ganesh.java_cloud_IDE_backend.model.SourceFile;
//import org.springframework.stereotype.Service;
//import java.io.InputStream;
//import java.nio.file.*;
//import java.util.UUID;
//import java.util.concurrent.TimeUnit;
//@Service
//public class JavaExecutionService {
//    public ExecutionResponse execute(ExecutionRequest request) throws Exception{
//        if (request.getFiles() == null || request.getFiles().isEmpty()) {
//            return new ExecutionResponse(
//                    "",
//                    "No source files provided. 'files' field is missing or empty.",
//                    1
//            );
//        }
//
//
//        Path projectDir = Files.createTempDirectory("java-project"+ UUID.randomUUID());
//
//        // Write all files preserving folder structure
//
//        for(SourceFile file:request.getFiles()){
//            Path filePath = projectDir.resolve(file.getPath());
//            Files.createDirectories(filePath.getParent());
//            Files.writeString(filePath,file.getContent());
//        }
//        String mainClass = request.getMainClass();
//        if(mainClass==null||mainClass.isBlank()){
//            mainClass="Main";
//        }
//
//        String command =
//                "javac $(find . -name \"*.java\") && " +
//                        "java " + mainClass;
//
//
//
//        // Docker sandbox
//
//        ProcessBuilder pb = new ProcessBuilder(
//                "docker", "run", "--rm",
//                "--cpus=0.5",
//                "--memory=256m",
//                "--network=none",
//                "-v", projectDir.toAbsolutePath() + ":/workspace",
//                "-w", "/workspace",
//                "java-runner:25",
//                "bash", "-c", command
//        );
//
//
//        Process process = pb.start();
//        process.waitFor();
//
//        String stdout = read(process.getInputStream());
//        String stderr = read(process.getErrorStream());
//
//        return new ExecutionResponse(stdout,stderr,process.exitValue());
//
//    }
//
//    private String read(InputStream is) throws Exception{
//        return new String(is.readAllBytes());
//    }
//
//    private String escape(String input){
//        return input.replace("\"", "\\\"");
//    }
//}


//package com.ganesh.java_cloud_IDE_backend.service;
//
//import com.ganesh.java_cloud_IDE_backend.model.ExecutionRequest;
//import com.ganesh.java_cloud_IDE_backend.model.ExecutionResponse;
//import com.ganesh.java_cloud_IDE_backend.model.SourceFile;
//import org.springframework.stereotype.Service;
//
//import java.io.InputStream;
//import java.nio.file.*;
//import java.util.*;
//import java.util.concurrent.TimeUnit;
//import java.util.regex.Matcher;
//import java.util.regex.Pattern;
//
//@Service
//public class JavaExecutionService {
//
//    private static final int EXECUTION_TIMEOUT_SECONDS=5;
//    public ExecutionResponse execute(ExecutionRequest request) throws Exception {
//
//        // 1️⃣ Validate input
//        if (request.getFiles() == null || request.getFiles().isEmpty()) {
//            return new ExecutionResponse(
//                    "",
//                    "No source files provided",
//                    1
//            );
//        }
//
//        Path projectDir = Files.createTempDirectory("java-project-");
//
//        try {
//            // 2️⃣ Write files exactly as frontend sends
//            for (SourceFile file : request.getFiles()) {
//                Path filePath = projectDir.resolve(file.getPath());
//                Files.createDirectories(filePath.getParent());
//                Files.writeString(filePath, file.getContent());
//            }
//
//            // 3️⃣ Discover all .java files dynamically
//            List<Path> javaFiles;
//            try (var stream = Files.walk(projectDir)) {
//                javaFiles = stream
//                        .filter(p -> p.toString().endsWith(".java"))
//                        .toList();
//            }
//
//            if (javaFiles.isEmpty()) {
//                return new ExecutionResponse(
//                        "",
//                        "No Java source files found",
//                        1
//                );
//            }
//
//            // 4️⃣ Auto-detect main class
//            String mainClass = detectMainClass(javaFiles);
//
//            // 5️⃣ Compile (SAFE, NO SHELL FIND)
//            List<String> compileCmd = new ArrayList<>();
//            compileCmd.add("javac");
//
//            for (Path file : javaFiles) {
//                compileCmd.add(projectDir.relativize(file).toString());
//            }
//
//            ProcessBuilder compilePb = new ProcessBuilder(compileCmd);
//            compilePb.directory(projectDir.toFile());
//            compilePb.redirectErrorStream(true);
//
//            Process compileProcess = compilePb.start();
//            String compileOutput = readStreamAsync(compileProcess.getInputStream());
//            int compileExit = compileProcess.waitFor();
//
////            String compileOutput =
////                    new String(compileProcess.getInputStream().readAllBytes());
//
//            if (compileExit != 0) {
//                return new ExecutionResponse(
//                        "",
//                        compileOutput,
//                        compileExit
//                );
//            }
//
//            // 6️⃣ Run program
//            ProcessBuilder runPb = new ProcessBuilder("java", mainClass);
//            runPb.directory(projectDir.toFile());
//            runPb.redirectErrorStream(true);
//
//            Process runProcess = runPb.start();
//            String runOutput = readStreamAsync(runProcess.getInputStream());
////            int runExit = runProcess.waitFor();
//            boolean finished =
//                    runProcess.waitFor(EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
//
//            if (!finished) {
//                runProcess.destroyForcibly();
//                return new ExecutionResponse(
//                        runOutput,
//                        "Execution timed out",
//                        1
//                );
//            }
//
////            String runOutput =
////                    new String(runProcess.getInputStream().readAllBytes());
//
//            return new ExecutionResponse(
//                    runOutput,
//                    "",
//                    runProcess.exitValue()
//            );
//
//        } finally {
//            // 7️⃣ Cleanup temp directory
//            Files.walk(projectDir)
//                    .sorted(Comparator.reverseOrder())
//                    .forEach(p -> {
//                        try {
//                            Files.deleteIfExists(p);
//                        } catch (Exception ignored) {}
//                    });
//        }
//    }
//
//    // 🔥 AUTO-DETECT MAIN CLASS (PACKAGE AWARE)
//    private String detectMainClass(List<Path> javaFiles) throws Exception {
//
//        Pattern packagePattern =
//                Pattern.compile("package\\s+([a-zA-Z0-9_.]+)\\s*;");
//        Pattern classPattern =
//                Pattern.compile("public\\s+class\\s+(\\w+)");
//        Pattern mainPattern =
//                Pattern.compile("public\\s+static\\s+void\\s+main\\s*\\(");
//
//        for (Path file : javaFiles) {
//            String code = Files.readString(file);
//
//            if (mainPattern.matcher(code).find()) {
//                String pkg = "";
//
//                Matcher pkgMatcher = packagePattern.matcher(code);
//                if (pkgMatcher.find()) {
//                    pkg = pkgMatcher.group(1) + ".";
//                }
//
//                Matcher classMatcher = classPattern.matcher(code);
//                if (classMatcher.find()) {
//                    return pkg + classMatcher.group(1);
//                }
//            }
//        }
//
//        throw new RuntimeException("No main method found");
//    }
//
//    private String readStreamAsync(InputStream inputStream) throws Exception {
//        StringBuilder output = new StringBuilder();
//
//        Thread reader = new Thread(() -> {
//            try (Scanner sc = new Scanner(inputStream)) {
//                while (sc.hasNextLine()) {
//                    output.append(sc.nextLine()).append("\n");
//                }
//            }
//        });
//
//        reader.start();
//        reader.join();
//
//        return output.toString();
//    }
//
//}



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
            /* 1️⃣ Write files */
            for (SourceFile file : request.getFiles()) {
                Path filePath = projectDir.resolve(file.getPath());
                Files.createDirectories(filePath.getParent());
                Files.writeString(filePath, file.getContent());
            }

            /* 2️⃣ Discover Java files */
            List<Path> javaFiles;
            try (var stream = Files.walk(projectDir)) {
                javaFiles = stream
                        .filter(p -> p.toString().endsWith(".java"))
                        .toList();
            }

            if (javaFiles.isEmpty()) {
                return new ExecutionResponse("", "No Java files found", 1);
            }

            /* 3️⃣ Detect main class */
            String mainClass = detectMainClass(javaFiles);

            /* 4️⃣ Build compile command */
            String compileCmd = javaFiles.stream()
                    .map(p -> projectDir.relativize(p).toString())
                    .reduce("javac", (a, b) -> a + " " + b);

            /* 5️⃣ Docker command (NO echo, STDIN enabled) */
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

            /* 🔥 WRITE INPUT SAFELY TO STDIN */
            if (request.getInput() != null && !request.getInput().isEmpty()) {
                process.getOutputStream()
                        .write(request.getInput().getBytes());
            }
            process.getOutputStream().close();

            /* 6️⃣ Read output asynchronously (NO DEADLOCK) */
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
            /* 7️⃣ Cleanup */
            Files.walk(projectDir)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try { Files.deleteIfExists(p); }
                        catch (Exception ignored) {}
                    });
        }
    }

    /* 🔥 Prevent stdout buffer deadlock */
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

    /* 🔥 Auto-detect main() with package support */
    private String detectMainClass(List<Path> javaFiles) throws Exception {

        Pattern packagePattern =
                Pattern.compile("package\\s+([a-zA-Z0-9_.]+)\\s*;");
        Pattern classPattern =
                Pattern.compile("public\\s+class\\s+(\\w+)");
        Pattern mainPattern =
                Pattern.compile("public\\s+static\\s+void\\s+main\\s*\\(");

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

