package com.ganesh.java_cloud_IDE_backend.config;

import com.ganesh.java_cloud_IDE_backend.handler.TerminalWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final TerminalWebSocketHandler terminalHandler;

    public WebSocketConfig(TerminalWebSocketHandler terminalHandler) {
        this.terminalHandler = terminalHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Register the handler and allow cross-origin requests from your frontend
        registry.addHandler(terminalHandler, "/terminal")
                .setAllowedOrigins("*");
    }
}

