package com.ganesh.java_cloud_IDE_backend.config;

import com.ganesh.java_cloud_IDE_backend.handler.InteractiveExecutionHandler;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.socket.config.annotation.EnableWebSocket;
import org.springframework.web.socket.config.annotation.WebSocketConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketHandlerRegistry;
import org.springframework.web.socket.server.standard.ServletServerContainerFactoryBean;

@Configuration
@EnableWebSocket
public class WebSocketConfig implements WebSocketConfigurer {

    private final InteractiveExecutionHandler executionHandler;

    public WebSocketConfig(InteractiveExecutionHandler executionHandler) {
        this.executionHandler = executionHandler;
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        registry.addHandler(executionHandler, "/ws/client")
                .setAllowedOrigins("*");
    }

    @Bean
    public ServletServerContainerFactoryBean createWebSocketContainer() {
        ServletServerContainerFactoryBean container = new ServletServerContainerFactoryBean();
        container.setMaxTextMessageBufferSize(1024 * 1024); // 1 MB
        container.setMaxBinaryMessageBufferSize(1024 * 1024); // 1 MB
        return container;
    }
}
