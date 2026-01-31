//package com.ganesh.java_cloud_IDE_backend.service;
//
//import com.ganesh.java_cloud_IDE_backend.model.ExecutionRequest;
//import com.ganesh.java_cloud_IDE_backend.model.ExecutionResponse;
//import com.ganesh.java_cloud_IDE_backend.model.SourceFile;
//import org.springframework.stereotype.Service;
//import jakarta.annotation.PreDestroy;
//import java.io.*;
//import java.nio.file.*;
//import java.security.MessageDigest;
//import java.util.*;
//import java.util.concurrent.*;
//import java.util.stream.Collectors;
//
//@Service
//public class OptimizedJavaExecutionService {
//
//    private static final int EXECUTION_TIMEOUT_SECONDS = 6;
//    private static final int CONTAINER_POOL_SIZE = 3;
//
//    private final BlockingQueue<String> containerPool = new LinkedBlockingQueue<>();
//    private final Set<String> activeContainers = ConcurrentHashMap.newKeySet();
//    private final ConcurrentHashMap<String, Path> compilationCache = new ConcurrentHashMap<>();
//    private final ExecutorService asyncExecutor = Executors.newCachedThreadPool();
//    private volatile boolean dockerAvailable = false;
//
//    public OptimizedJavaExecutionService() {
//        checkDockerAvailability();
//        if (dockerAvailable) {
//            initializeContainerPool();
//        }
//    }
//
//    private void checkDockerAvailability() {
//        try {
//            ProcessBuilder pb = new ProcessBuilder("docker", "--version");
//            Process process = pb.start();
//            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
//            dockerAvailable = finished && process.exitValue() == 0;
//
//            if (dockerAvailable) {
//                System.out.println("✅ Docker is available");
//            } else {
//                System.err.println("❌ Docker is not available - will use fallback mode");
//            }
//        } catch (Exception e) {
//            System.err.println("❌ Docker check failed: " + e.getMessage());
//            dockerAvailable = false;
//        }
//    }
//
//    private void initializeContainerPool() {
//        asyncExecutor.submit(() -> {
//            for (int i = 0; i < CONTAINER_POOL_SIZE; i++) {
//                try {
//                    String containerId = createPersistentContainer();
//                    if (containerId != null && !containerId.isEmpty()) {
//                        containerPool.offer(containerId);
//                        System.out.println("✅ Container created: " + containerId.substring(0, 12));
//                    }
//                } catch (Exception e) {
//                    System.err.println("Failed to create container: " + e.getMessage());
//                }
//            }
//        });
//    }
//
//    private String createPersistentContainer() throws Exception {
//        ProcessBuilder pb = new ProcessBuilder(
//                "docker", "run", "-d", "-i",
//                "--cpus=0.5",
//                "--memory=256m",
//                "--network=none",
//                "java-runner:25",
//                "tail", "-f", "/dev/null"
//        );
//
//        pb.redirectErrorStream(true);
//        Process process = pb.start();
//
//        StringBuilder output = new StringBuilder();
//        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
//            String line;
//            while ((line = reader.readLine()) != null) {
//                output.append(line).append("\n");
//            }
//        }
//
//        boolean finished = process.waitFor(10, TimeUnit.SECONDS);
//        if (!finished || process.exitValue() != 0) {
//            throw new RuntimeException("Docker run failed: " + output);
//        }
//
//        String containerId = output.toString().trim().split("\n")[0];
//        if (containerId.isEmpty()) {
//            throw new RuntimeException("No container ID returned");
//        }
//
//        activeContainers.add(containerId);
//        return containerId;
//    }
//
//    public ExecutionResponse execute(ExecutionRequest request) throws Exception {
//
//        if (request.getFiles() == null || request.getFiles().isEmpty()) {
//            return new ExecutionResponse("", "No source files provided", 1);
//        }
//
//        // Calculate hash for caching
//        String codeHash = calculateHash(request.getFiles());
//
//        // Check compilation cache
//        Path compiledDir = compilationCache.get(codeHash);
//        boolean needsCompilation = (compiledDir == null || !Files.exists(compiledDir));
//
//        if (needsCompilation) {
//            compiledDir = compileAndCache(request.getFiles(), codeHash);
//        }
//
//        // Execute with or without Docker
//        if (dockerAvailable) {
//            return executeWithDocker(compiledDir, request);
//        } else {
//            return executeLocally(compiledDir, request);
//        }
//    }
//
//    private Path compileAndCache(List<SourceFile> files, String hash) throws Exception {
//        Path projectDir = Files.createTempDirectory("java-cache-" + hash.substring(0, 8));
//
//        // Write files
//        for (SourceFile file : files) {
//            Path filePath = projectDir.resolve(file.getPath());
//            Files.createDirectories(filePath.getParent());
//            Files.writeString(filePath, file.getContent());
//        }
//
//        // Find all Java files
//        List<Path> javaFiles = new ArrayList<>();
//        try (var stream = Files.walk(projectDir)) {
//            stream.filter(p -> p.toString().endsWith(".java"))
//                    .forEach(javaFiles::add);
//        }
//
//        if (javaFiles.isEmpty()) {
//            throw new RuntimeException("No Java files found");
//        }
//
//        // Compile locally (much faster than Docker)
//        List<String> compileCommand = new ArrayList<>();
//        compileCommand.add("javac");
//        compileCommand.add("-d");
//        compileCommand.add(projectDir.toString());
//
//        for (Path javaFile : javaFiles) {
//            compileCommand.add(javaFile.toString());
//        }
//
//        ProcessBuilder pb = new ProcessBuilder(compileCommand);
//        pb.directory(projectDir.toFile());
//        pb.redirectErrorStream(true);
//
//        Process compileProcess = pb.start();
//
//        StringBuilder compileOutput = new StringBuilder();
//        try (BufferedReader reader = new BufferedReader(new InputStreamReader(compileProcess.getInputStream()))) {
//            String line;
//            while ((line = reader.readLine()) != null) {
//                compileOutput.append(line).append("\n");
//            }
//        }
//
//        boolean finished = compileProcess.waitFor(30, TimeUnit.SECONDS);
//
//        if (!finished) {
//            compileProcess.destroyForcibly();
//            throw new RuntimeException("Compilation timed out");
//        }
//
//        if (compileProcess.exitValue() != 0) {
//            throw new RuntimeException("Compilation failed:\n" + compileOutput);
//        }
//
//        // Cache the compiled directory
//        compilationCache.put(hash, projectDir);
//
//        // Cleanup old cache entries
//        if (compilationCache.size() > 100) {
//            cleanupOldestCache();
//        }
//
//        System.out.println("✅ Compiled and cached: " + hash.substring(0, 8));
//        return projectDir;
//    }
//
//    private ExecutionResponse executeWithDocker(Path compiledDir, ExecutionRequest request) throws Exception {
//
//        String mainClass = detectMainClass(compiledDir);
//
//        // Get container from pool
//        String containerId = containerPool.poll(2, TimeUnit.SECONDS);
//
//        if (containerId == null) {
//            // Fallback to local execution if no container available
//            System.err.println("⚠️ No container available, using local execution");
//            return executeLocally(compiledDir, request);
//        }
//
//        try {
//            // Copy compiled classes to container
//            ProcessBuilder copyPb = new ProcessBuilder(
//                    "docker", "cp",
//                    compiledDir.toAbsolutePath() + "/.",
//                    containerId + ":/workspace/"
//            );
//
//            Process copyProcess = copyPb.start();
//            if (!copyProcess.waitFor(5, TimeUnit.SECONDS) || copyProcess.exitValue() != 0) {
//                throw new RuntimeException("Failed to copy files to container");
//            }
//
//            // Execute in container
//            ProcessBuilder execPb = new ProcessBuilder(
//                    "docker", "exec", "-i", containerId,
//                    "bash", "-c",
//                    "cd /workspace && java " + mainClass
//            );
//
//            execPb.redirectErrorStream(true);
//            Process process = execPb.start();
//
//            // Write input
//            if (request.getInput() != null && !request.getInput().isEmpty()) {
//                try (OutputStream os = process.getOutputStream()) {
//                    os.write(request.getInput().getBytes());
//                }
//            }
//
//            // Read output with timeout
//            Future<String> outputFuture = asyncExecutor.submit(() -> readStream(process.getInputStream()));
//
//            String output;
//            try {
//                output = outputFuture.get(EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
//            } catch (TimeoutException e) {
//                process.destroyForcibly();
//                return new ExecutionResponse("", "Execution timed out", 1);
//            }
//
//            boolean finished = process.waitFor(1, TimeUnit.SECONDS);
//            int exitCode = finished ? process.exitValue() : 1;
//
//            return new ExecutionResponse(output, "", exitCode);
//
//        } finally {
//            // Return container to pool
//            containerPool.offer(containerId);
//        }
//    }
//
//    private ExecutionResponse executeLocally(Path compiledDir, ExecutionRequest request) throws Exception {
//
//        String mainClass = detectMainClass(compiledDir);
//
//        ProcessBuilder pb = new ProcessBuilder("java", "-cp", compiledDir.toString(), mainClass);
//        pb.directory(compiledDir.toFile());
//        pb.redirectErrorStream(true);
//
//        Process process = pb.start();
//
//        // Write input
//        if (request.getInput() != null && !request.getInput().isEmpty()) {
//            try (OutputStream os = process.getOutputStream()) {
//                os.write(request.getInput().getBytes());
//            }
//        }
//
//        // Read output
//        Future<String> outputFuture = asyncExecutor.submit(() -> readStream(process.getInputStream()));
//
//        String output;
//        try {
//            output = outputFuture.get(EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
//        } catch (TimeoutException e) {
//            process.destroyForcibly();
//            return new ExecutionResponse("", "Execution timed out", 1);
//        }
//
//        boolean finished = process.waitFor(1, TimeUnit.SECONDS);
//        int exitCode = finished ? process.exitValue() : 1;
//
//        return new ExecutionResponse(output, "", exitCode);
//    }
//
//    private String calculateHash(List<SourceFile> files) throws Exception {
//        MessageDigest md = MessageDigest.getInstance("SHA-256");
//
//        files.stream()
//                .sorted(Comparator.comparing(SourceFile::getPath))
//                .forEach(f -> {
//                    md.update(f.getPath().getBytes());
//                    md.update(f.getContent().getBytes());
//                });
//
//        byte[] hash = md.digest();
//        StringBuilder hexString = new StringBuilder();
//        for (byte b : hash) {
//            hexString.append(String.format("%02x", b));
//        }
//        return hexString.toString();
//    }
//
//    private String detectMainClass(Path projectDir) throws Exception {
//        List<Path> javaFiles = new ArrayList<>();
//        try (var stream = Files.walk(projectDir)) {
//            stream.filter(p -> p.toString().endsWith(".java"))
//                    .forEach(javaFiles::add);
//        }
//
//        for (Path file : javaFiles) {
//            String code = Files.readString(file);
//            if (code.contains("public static void main(")) {
//                // Extract package
//                String pkg = "";
//                int pkgStart = code.indexOf("package ");
//                if (pkgStart >= 0) {
//                    int pkgEnd = code.indexOf(";", pkgStart);
//                    pkg = code.substring(pkgStart + 8, pkgEnd).trim() + ".";
//                }
//
//                // Extract class name from filename
//                String className = file.getFileName().toString().replace(".java", "");
//                return pkg + className;
//            }
//        }
//
//        throw new RuntimeException("No main method found");
//    }
//
//    private String readStream(InputStream is) {
//        StringBuilder output = new StringBuilder();
//        try (BufferedReader reader = new BufferedReader(new InputStreamReader(is))) {
//            String line;
//            while ((line = reader.readLine()) != null) {
//                output.append(line).append("\n");
//            }
//        } catch (IOException e) {
//            // Stream closed
//        }
//        return output.toString();
//    }
//
//    private void cleanupOldestCache() {
//        if (compilationCache.size() <= 50) return;
//
//        Iterator<Map.Entry<String, Path>> iterator = compilationCache.entrySet().iterator();
//        int removed = 0;
//        while (iterator.hasNext() && removed < 50) {
//            Map.Entry<String, Path> entry = iterator.next();
//            try {
//                Files.walk(entry.getValue())
//                        .sorted(Comparator.reverseOrder())
//                        .forEach(p -> {
//                            try { Files.deleteIfExists(p); } catch (Exception ignored) {}
//                        });
//            } catch (Exception ignored) {}
//            iterator.remove();
//            removed++;
//        }
//        System.out.println("🧹 Cleaned up " + removed + " cached compilations");
//    }
//
//    @PreDestroy
//    public void cleanup() {
//        System.out.println("🛑 Shutting down execution service...");
//
//        // Stop all containers
//        for (String containerId : activeContainers) {
//            try {
//                ProcessBuilder pb = new ProcessBuilder("docker", "stop", containerId);
//                Process process = pb.start();
//                process.waitFor(5, TimeUnit.SECONDS);
//                System.out.println("Stopped container: " + containerId.substring(0, 12));
//            } catch (Exception e) {
//                System.err.println("Failed to stop container: " + e.getMessage());
//            }
//        }
//
//        // Cleanup cache directories
//        for (Path dir : compilationCache.values()) {
//            try {
//                Files.walk(dir)
//                        .sorted(Comparator.reverseOrder())
//                        .forEach(p -> {
//                            try { Files.deleteIfExists(p); } catch (Exception ignored) {}
//                        });
//            } catch (Exception ignored) {}
//        }
//
//        asyncExecutor.shutdown();
//        System.out.println("✅ Cleanup complete");
//    }
//}

package com.ganesh.java_cloud_IDE_backend.service;

import com.ganesh.java_cloud_IDE_backend.model.ExecutionRequest;
import com.ganesh.java_cloud_IDE_backend.model.ExecutionResponse;
import com.ganesh.java_cloud_IDE_backend.model.SourceFile;
import org.springframework.stereotype.Service;
import jakarta.annotation.PreDestroy;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;

@Service
public class OptimizedJavaExecutionService {

    private static final int EXECUTION_TIMEOUT_SECONDS = 6;
    private static final int CONTAINER_POOL_SIZE = 1;

    private final BlockingQueue<String> containerPool = new LinkedBlockingQueue<>();
    private final Set<String> activeContainers = ConcurrentHashMap.newKeySet();
    private final ConcurrentHashMap<String, Path> compilationCache = new ConcurrentHashMap<>();
    private final ExecutorService asyncExecutor = Executors.newCachedThreadPool();
    private volatile boolean dockerAvailable = false;

    public OptimizedJavaExecutionService() {
        checkDockerAvailability();
        if (dockerAvailable) {
            initializeContainerPool();
        }
    }

    private void checkDockerAvailability() {
        try {
            ProcessBuilder pb = new ProcessBuilder("docker", "--version");
            Process process = pb.start();
            boolean finished = process.waitFor(5, TimeUnit.SECONDS);
            dockerAvailable = finished && process.exitValue() == 0;
            if (dockerAvailable) {
                System.out.println("✅ Docker is available");
            } else {
                System.err.println("❌ Docker is not available - will use fallback mode");
            }
        } catch (Exception e) {
            dockerAvailable = false;
        }
    }

    private void initializeContainerPool() {
        asyncExecutor.submit(() -> {
            for (int i = 0; i < CONTAINER_POOL_SIZE; i++) {
                try {
                    String containerId = createPersistentContainer();
                    if (containerId != null && !containerId.isEmpty()) {
                        containerPool.offer(containerId);
                    }
                } catch (Exception e) {
                    System.err.println("Failed to create container: " + e.getMessage());
                }
            }
        });
    }

    private String createPersistentContainer() throws Exception {
        ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "-d", "-i",
                "--cpus=0.5", "--memory=256m", "--network=none",
                "-v", "/tmp/workspace:/workspace",  // Add this line
                "--tmpfs", "/tmp:rw,noexec,nosuid,size=50m",  // Add temp filesystem
                "java-runner:25", "tail", "-f", "/dev/null"
        );
        pb.redirectErrorStream(true);
        Process process = pb.start();
        String containerId;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            containerId = reader.readLine();
        }
        if (process.waitFor(10, TimeUnit.SECONDS) && process.exitValue() == 0 && containerId != null) {
            activeContainers.add(containerId.trim());
            return containerId.trim();
        }
        throw new RuntimeException("Docker startup failed");
    }

    /**
     * Main entry point refactored to handle exceptions and return them to the frontend.
     */
    public ExecutionResponse execute(ExecutionRequest request) {
        try {
            if (request.getFiles() == null || request.getFiles().isEmpty()) {
                return new ExecutionResponse("", "No source files provided", 1);
            }

            // Calculate hash for caching
            String codeHash = calculateHash(request.getFiles());

            // Check compilation cache
            Path compiledDir = compilationCache.get(codeHash);
            if (compiledDir == null || !Files.exists(compiledDir)) {
                try {
                    compiledDir = compileAndCache(request.getFiles(), codeHash);
                } catch (RuntimeException e) {
                    // This captures the "javac" error messages found in your logs
                    return new ExecutionResponse("", "Compilation Error:\n" + e.getMessage(), 1);
                }
            }

            // Detect main class with robust pattern matching
            String mainClass;
            try {
                mainClass = detectMainClass(compiledDir);
            } catch (RuntimeException e) {
                return new ExecutionResponse("", e.getMessage(), 1);
            }

            // Execute with or without Docker
            if (dockerAvailable) {
                return executeWithDocker(compiledDir, mainClass, request);
            } else {
                return executeLocally(compiledDir, mainClass, request);
            }
        } catch (Exception e) {
            return new ExecutionResponse("", "Internal Server Error: " + e.getMessage(), 1);
        }
    }

    public Path compileAndCache(List<SourceFile> files, String hash) throws Exception {
        Path projectDir = Files.createTempDirectory("java-cache-" + hash.substring(0, 8));

        for (SourceFile file : files) {
            Path filePath = projectDir.resolve(file.getPath());
            Files.createDirectories(filePath.getParent());
            Files.writeString(filePath, file.getContent());
        }

        List<Path> javaFiles = new ArrayList<>();
        try (var stream = Files.walk(projectDir)) {
            stream.filter(p -> p.toString().endsWith(".java")).forEach(javaFiles::add);
        }

        if (javaFiles.isEmpty()) throw new RuntimeException("No Java files found");

        List<String> compileCommand = new ArrayList<>(List.of("javac", "-d", projectDir.toString()));
        javaFiles.forEach(p -> compileCommand.add(p.toString()));

        ProcessBuilder pb = new ProcessBuilder(compileCommand);
        pb.directory(projectDir.toFile());
        pb.redirectErrorStream(true);
        Process compileProcess = pb.start();

        String output = readStream(compileProcess.getInputStream());
        if (!compileProcess.waitFor(30, TimeUnit.SECONDS) || compileProcess.exitValue() != 0) {
            throw new RuntimeException(output);
        }

        compilationCache.put(hash, projectDir);
        return projectDir;
    }

//    private ExecutionResponse executeWithDocker(Path compiledDir, String mainClass, ExecutionRequest request) throws Exception {
//        String containerId = containerPool.poll(2, TimeUnit.SECONDS);
//        if (containerId == null) return executeLocally(compiledDir, mainClass, request);
//
//        try {
//            // Copy files
//            new ProcessBuilder("docker", "cp", compiledDir + "/.", containerId + ":/workspace/").start().waitFor();
//
//            // Run Java
//            ProcessBuilder execPb = new ProcessBuilder("docker", "exec", "-i", containerId, "bash", "-c", "cd /workspace && java " + mainClass);
//            execPb.redirectErrorStream(true);
//            Process process = execPb.start();
//
//            if (request.getInput() != null) {
//                try (OutputStream os = process.getOutputStream()) {
//                    os.write(request.getInput().getBytes());
//                }
//            }
//
//            String output = asyncExecutor.submit(() -> readStream(process.getInputStream())).get(EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
//            return new ExecutionResponse(output, "", process.waitFor() == 0 ? 0 : 1);
//
//        } catch (TimeoutException e) {
//            return new ExecutionResponse("", "Execution Timed Out", 1);
//        } finally {
//            containerPool.offer(containerId);
//        }
//    }
private ExecutionResponse executeWithDocker(
        Path compiledDir,
        String mainClass,
        ExecutionRequest request
) throws Exception {

    String containerId = containerPool.poll(2, TimeUnit.SECONDS);
    if (containerId == null) {
        return executeLocally(compiledDir, mainClass, request);
    }

    // 1️⃣ Create isolated workspace on host
    Path runDir = Files.createTempDirectory("java-run-");

    try {
        // 2️⃣ Copy compiled files into runDir (host side)
        Files.walk(compiledDir).forEach(source -> {
            try {
                Path target = runDir.resolve(compiledDir.relativize(source));
                if (Files.isDirectory(source)) {
                    Files.createDirectories(target);
                } else {
                    Files.copy(source, target, StandardCopyOption.REPLACE_EXISTING);
                }
            } catch (IOException e) {
                throw new UncheckedIOException(e);
            }
        });

        // 3️⃣ Run Java inside container with bind mount
        ProcessBuilder pb = new ProcessBuilder(
                "docker", "run", "--rm",
                "--cpus=0.5",
                "--memory=256m",
                "--network=none",
                "-v", runDir.toAbsolutePath() + ":/workspace",
                "java-runner:25",
                "bash", "-c",
                "cd /workspace && java " + mainClass
        );


        pb.redirectErrorStream(true);
        Process process = pb.start();

        // 4️⃣ Pass stdin if present
        if (request.getInput() != null && !request.getInput().isEmpty()) {
            try (OutputStream os = process.getOutputStream()) {
                os.write(request.getInput().getBytes());
            }
        }

        // 5️⃣ Capture output with timeout
        String output = asyncExecutor
                .submit(() -> readStream(process.getInputStream()))
                .get(EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);

        int exitCode = process.waitFor();
        return new ExecutionResponse(output, "", exitCode == 0 ? 0 : 1);

    } catch (TimeoutException e) {
        return new ExecutionResponse("", "Execution Timed Out", 1);
    } finally {
        // 6️⃣ Cleanup workspace
        deleteDirectory(runDir);

        // 7️⃣ Return container to pool
        containerPool.offer(containerId);
    }
}

    private ExecutionResponse executeLocally(Path compiledDir, String mainClass, ExecutionRequest request) throws Exception {
        ProcessBuilder pb = new ProcessBuilder("java", "-cp", compiledDir.toString(), mainClass);
        pb.redirectErrorStream(true);
        Process process = pb.start();

        if (request.getInput() != null) {
            try (OutputStream os = process.getOutputStream()) { os.write(request.getInput().getBytes()); }
        }

        try {
            String output = asyncExecutor.submit(() -> readStream(process.getInputStream())).get(EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            return new ExecutionResponse(output, "", process.waitFor() == 0 ? 0 : 1);
        } catch (TimeoutException e) {
            process.destroyForcibly();
            return new ExecutionResponse("", "Execution Timed Out", 1);
        }
    }

    /**
     * Refactored main detection using Regex to handle varying code styles.
     */
    public String detectMainClass(Path projectDir) throws Exception {
        List<Path> javaFiles = new ArrayList<>();
        try (var stream = Files.walk(projectDir)) {
            stream.filter(p -> p.toString().endsWith(".java")).forEach(javaFiles::add);
        }

        // Regex: public static void main (String[] args) or variants
        Pattern mainPattern = Pattern.compile("public\\s+static\\s+void\\s+main\\s*\\(");

        for (Path file : javaFiles) {
            String code = Files.readString(file);
            if (mainPattern.matcher(code).find()) {
                String pkg = "";
                int pkgStart = code.indexOf("package ");
                if (pkgStart >= 0) {
                    pkg = code.substring(pkgStart + 8, code.indexOf(";", pkgStart)).trim() + ".";
                }
                return pkg + file.getFileName().toString().replace(".java", "");
            }
        }
        throw new RuntimeException("No main method found. Please ensure your file contains 'public static void main(String[] args)'.");
    }

    private String readStream(InputStream is) {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(is))) {
            String line;
            while ((line = r.readLine()) != null) sb.append(line).append("\n");
        } catch (IOException ignored) {}
        return sb.toString();
    }

    private String calculateHash(List<SourceFile> files) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        files.stream().sorted(Comparator.comparing(SourceFile::getPath)).forEach(f -> {
            md.update(f.getPath().getBytes());
            md.update(f.getContent().getBytes());
        });
        StringBuilder hex = new StringBuilder();
        for (byte b : md.digest()) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    @PreDestroy
    public void cleanup() {
        for (String id : activeContainers) {
            try { new ProcessBuilder("docker", "stop", id).start(); } catch (Exception ignored) {}
        }
        asyncExecutor.shutdown();
    }
    private void deleteDirectory(Path dir) {
        try {
            Files.walk(dir)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try { Files.deleteIfExists(p); }
                        catch (IOException ignored) {}
                    });
        } catch (IOException ignored) {}
    }

}