package com.ganesh.java_cloud_IDE_backend.handler;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.ganesh.java_cloud_IDE_backend.model.ExecutionRequest;
import com.ganesh.java_cloud_IDE_backend.service.OptimizedJavaExecutionService;
import org.jspecify.annotations.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.*;

@Component
public class TerminalWebSocketHandler extends TextWebSocketHandler {

    private final OptimizedJavaExecutionService executionService;
    private final Map<String, Process> activeProcesses = new ConcurrentHashMap<>();
    private final ExecutorService threadPool = Executors.newCachedThreadPool();
    private final ObjectMapper objectMapper = new ObjectMapper();

    public TerminalWebSocketHandler(OptimizedJavaExecutionService executionService) {
        this.executionService = executionService;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        session.sendMessage(new TextMessage("\r\n\033[1;34mConnected to JavaCloud Terminal\033[0m\r\n"));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String payload = message.getPayload();

        // 1. Check if we are receiving an initial execution request (JSON)
        if (payload.startsWith("{") && payload.contains("files")) {
            startExecution(session, payload);
            return;
        }

        // 2. Otherwise, treat payload as user input for a running process
        Process process = activeProcesses.get(session.getId());
        if (process != null && process.isAlive()) {
            OutputStream os = process.getOutputStream();
            os.write(payload.getBytes(StandardCharsets.UTF_8));
            os.flush(); // Essential for Scanner to receive data immediately
        }
    }

    private void startExecution(WebSocketSession session, String payload) {
        threadPool.submit(() -> {
            try {
                ExecutionRequest request = objectMapper.readValue(payload, ExecutionRequest.class);
                session.sendMessage(new TextMessage("Compiling...\r\n"));

                // Reuse your existing compilation logic
                // We assume detectMainClass is updated to be robust as discussed previously
                String codeHash = calculateHash(request.getFiles());
                Path projectDir = executionService.compileAndCache(request.getFiles(), codeHash);
                String mainClass = executionService.detectMainClass(projectDir);

                // Start the process
                ProcessBuilder pb = new ProcessBuilder("java", "-cp", projectDir.toString(), mainClass);
                pb.directory(projectDir.toFile());
                pb.redirectErrorStream(true); // Merge stderr into stdout for easier handling

                Process process = pb.start();
                activeProcesses.put(session.getId(), process);

                session.sendMessage(new TextMessage("Running " + mainClass + "...\r\n\r\n"));

                // Attach listener to process output
                attachProcessListener(session, process);

                // Wait for process to exit and cleanup
                int exitCode = process.waitFor();
                session.sendMessage(new TextMessage("\r\n\033[1;30mProcess finished with exit code " + exitCode + "\033[0m\r\n"));
                activeProcesses.remove(session.getId());

            } catch (Exception e) {
                sendErrorMessage(session, e.getMessage());
            }
        });
    }

    private void attachProcessListener(WebSocketSession session, Process process) {
        threadPool.submit(() -> {
            try (InputStream is = process.getInputStream()) {
                byte[] buffer = new byte[1024]; // Corrected: Outside try parentheses
                int read;
                while (process.isAlive() && (read = is.read(buffer)) != -1) {
                    if (session.isOpen()) {
                        session.sendMessage(new TextMessage(new String(buffer, 0, read, StandardCharsets.UTF_8)));
                    }
                }
            } catch (IOException e) {
                // Log error
            }
        });
    }

    private void sendErrorMessage(WebSocketSession session, String error) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage("\r\n\033[1;31mError: " + error + "\033[0m\r\n"));
            }
        } catch (IOException ignored) {}
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, @NonNull CloseStatus status) {
        Process process = activeProcesses.remove(session.getId());
        if (process != null && process.isAlive()) {
            process.destroyForcibly(); // Prevent zombie processes
        }
    }

    // Helper to reuse hash logic from your service
    private String calculateHash(java.util.List<com.ganesh.java_cloud_IDE_backend.model.SourceFile> files) throws Exception {
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        files.stream().sorted(java.util.Comparator.comparing(com.ganesh.java_cloud_IDE_backend.model.SourceFile::getPath))
                .forEach(f -> {
                    md.update(f.getPath().getBytes());
                    md.update(f.getContent().getBytes());
                });
        StringBuilder hex = new StringBuilder();
        for (byte b : md.digest()) hex.append(String.format("%02x", b));
        return hex.toString();
    }
}