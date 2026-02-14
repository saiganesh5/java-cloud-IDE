package com.ganesh.java_cloud_IDE_backend.handler;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jspecify.annotations.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class InteractiveExecutionHandler extends TextWebSocketHandler {

    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, ProcessSession> sessions = new ConcurrentHashMap<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        System.out.println("🔌 WebSocket connection opened: " + session.getId());
        super.afterConnectionEstablished(session);
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        System.out.println("🔌 WebSocket connection closed: " + session.getId() + " status: " + status);
        ProcessSession ps = sessions.remove(session.getId());
        if (ps != null) {
            ps.destroy();
        }
    }

    @Override
    protected void handleTextMessage(@NonNull WebSocketSession session, TextMessage message) throws Exception {
        System.out.println("📩 Received WebSocket message: " + message.getPayload());
        JsonNode json = mapper.readTree(message.getPayload());
        String type = json.get("type").asText();
        System.out.println("📨 Message type: " + type);

        switch (type) {
            case "start" -> handleStart(session, json);
            case "input" -> handleInput(session, json);
            case "stop" -> handleStop(session);
        }
    }

    private void handleStart(WebSocketSession session, JsonNode json) throws Exception {
        // Kill any existing process
        ProcessSession existing = sessions.get(session.getId());
        if (existing != null) {
            existing.destroy();
        }

        // Create temp directory for files
        Path projectDir = Files.createTempDirectory("java-exec-");

        try {
            // Write source files
            JsonNode files = json.get("files");
            for (JsonNode file : files) {
                String path = file.get("path").asText();
                String content = file.get("content").asText();
                Path filePath = projectDir.resolve(path);
                Files.createDirectories(filePath.getParent());
                Files.writeString(filePath, content);
            }

            // Discover Java files
            List<Path> javaFiles;
            try (var stream = Files.walk(projectDir)) {
                javaFiles = stream
                        .filter(p -> p.toString().endsWith(".java"))
                        .toList();
            }

            if (javaFiles.isEmpty()) {
                sendMessage(session, "error", "No Java files found");
                sendExit(session, 1);
                return;
            }

            // Detect main class and its source file location
            MainClassInfo mainInfo;
            if (json.has("mainClass") && !json.get("mainClass").asText().isEmpty()) {
                mainInfo = new MainClassInfo(json.get("mainClass").asText(), null);
            } else {
                mainInfo = detectMainClassWithLocation(javaFiles, projectDir);
            }

            // Build compile command
            String compileCmd = javaFiles.stream()
                    .map(p -> projectDir.relativize(p).toString().replace("\\", "/"))
                    .reduce("javac", (a, b) -> a + " " + b);

            // Build run command - if class is in subdirectory without package, cd there
            // first
            String runCmd;
            if (mainInfo.directory != null && !mainInfo.directory.isEmpty()) {
                runCmd = "cd " + mainInfo.directory + " && java " + mainInfo.className;
            } else {
                runCmd = "java " + mainInfo.className;
            }

            // Start Docker process with interactive stdin
            ProcessBuilder pb = new ProcessBuilder(
                    "docker", "run", "--rm", "-i",
                    "--cpus=0.5",
                    "--memory=256m",
                    "--network=none",
                    "-v", projectDir.toAbsolutePath().toString().replace("\\", "/") + ":/workspace",
                    "-w", "/workspace",
                    "java-runner:25",
                    "bash", "-c",
                    compileCmd + " && " + runCmd);

            pb.redirectErrorStream(true);
            Process process = pb.start();

            // Store session
            ProcessSession ps = new ProcessSession(process, projectDir);
            sessions.put(session.getId(), ps);

            // Stream output in background thread
            Thread outputThread = new Thread(() -> {
                try (BufferedReader reader = new BufferedReader(
                        new InputStreamReader(process.getInputStream()))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sendOutput(session, line + "\n");
                    }
                } catch (IOException e) {
                    // Stream closed
                }

                // Process finished
                try {
                    int exitCode = process.waitFor();

                    // Sync files back to frontend before cleanup
                    syncFilesToFrontend(session, ps.projectDir);

                    sendExit(session, exitCode);
                } catch (InterruptedException e) {
                    sendExit(session, 1);
                }

                // Cleanup
                ps.cleanup();
                sessions.remove(session.getId());
            });
            outputThread.setDaemon(true);
            outputThread.start();

        } catch (Exception e) {
            sendMessage(session, "error", e.getMessage());
            sendExit(session, 1);
            cleanupDir(projectDir);
        }
    }

    private void handleInput(WebSocketSession session, JsonNode json) throws Exception {
        ProcessSession ps = sessions.get(session.getId());
        if (ps != null && ps.process.isAlive()) {
            String input = json.get("data").asText();
            ps.process.getOutputStream().write(input.getBytes());
            ps.process.getOutputStream().flush();
        }
    }

    private void handleStop(WebSocketSession session) {
        ProcessSession ps = sessions.get(session.getId());
        if (ps != null) {
            ps.destroy();
            sessions.remove(session.getId());
            sendExit(session, 130); // Ctrl+C exit code
        }
    }

    private void sendOutput(WebSocketSession session, String data) {
        sendMessage(session, "output", data);
    }

    private void sendExit(WebSocketSession session, int code) {
        try {
            String msg = mapper.writeValueAsString(Map.of("type", "exit", "code", code));
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(msg));
            }
        } catch (Exception ignored) {
        }
    }

    private void sendMessage(WebSocketSession session, String type, String data) {
        try {
            String msg = mapper.writeValueAsString(Map.of("type", type, "data", data));
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(msg));
            }
        } catch (Exception ignored) {
        }
    }

    private void syncFilesToFrontend(WebSocketSession session, Path projectDir) {
        try {
            List<Map<String, String>> files = new ArrayList<>();

            try (var stream = Files.walk(projectDir)) {
                stream.filter(Files::isRegularFile)
                        .filter(p -> !p.toString().endsWith(".class")) // Skip compiled files
                        .forEach(p -> {
                            try {
                                String content = Files.readString(p);
                                String relativePath = projectDir.relativize(p).toString().replace("\\", "/");
                                files.add(Map.of("path", relativePath, "content", content));
                            } catch (IOException e) {
                                // Skip binary/unreadable files
                            }
                        });
            }

            // Send files message
            String msg = mapper.writeValueAsString(Map.of("type", "files", "files", files));
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(msg));
            }
        } catch (Exception e) {
            // Log but don't fail
            System.err.println("Failed to sync files: " + e.getMessage());
        }
    }

    // Helper record to hold class name and its directory
    private record MainClassInfo(String className, String directory) {
    }

    private MainClassInfo detectMainClassWithLocation(List<Path> javaFiles, Path projectDir) throws Exception {
        Pattern packagePattern = Pattern.compile("package\\s+([a-zA-Z0-9_.]+)\\s*;");
        Pattern classPattern = Pattern.compile("public\\s+class\\s+(\\w+)");
        Pattern mainPattern = Pattern.compile("public\\s+static\\s+void\\s+main\\s*\\(");

        for (Path file : javaFiles) {
            String code = Files.readString(file);

            if (mainPattern.matcher(code).find()) {
                Matcher pkgMatcher = packagePattern.matcher(code);
                Matcher classMatcher = classPattern.matcher(code);

                if (classMatcher.find()) {
                    String className = classMatcher.group(1);

                    if (pkgMatcher.find()) {
                        // Has package declaration - use fully qualified name
                        return new MainClassInfo(pkgMatcher.group(1) + "." + className, null);
                    } else {
                        // No package - check if file is in subdirectory
                        Path relativePath = projectDir.relativize(file);
                        String relativeDir = relativePath.getParent() != null
                                ? relativePath.getParent().toString().replace("\\", "/")
                                : null;
                        return new MainClassInfo(className, relativeDir);
                    }
                }
            }
        }

        throw new RuntimeException("No main method found");
    }

    private void cleanupDir(Path dir) {
        try {
            Files.walk(dir)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (Exception ignored) {
                        }
                    });
        } catch (Exception ignored) {
        }
    }

    private static class ProcessSession {
        final Process process;
        final Path projectDir;

        ProcessSession(Process process, Path projectDir) {
            this.process = process;
            this.projectDir = projectDir;
        }

        void destroy() {
            if (process.isAlive()) {
                // First try graceful shutdown (SIGINT equivalent)
                process.destroy();

                // Wait a bit for graceful exit
                try {
                    if (!process.waitFor(2, java.util.concurrent.TimeUnit.SECONDS)) {
                        // Force kill if still running
                        process.destroyForcibly();
                    }
                } catch (InterruptedException e) {
                    process.destroyForcibly();
                }
            }
        }

        void cleanup() {
            destroy();
            try {
                Files.walk(projectDir)
                        .sorted(Comparator.reverseOrder())
                        .forEach(p -> {
                            try {
                                Files.deleteIfExists(p);
                            } catch (Exception ignored) {
                            }
                        });
            } catch (Exception ignored) {
            }
        }
    }
}
