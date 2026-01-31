package com.ganesh.java_cloud_IDE_backend.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@Configuration
public class ExecutionThreadPool {

    @Bean
    public ExecutorService executionExecutor() {
        int cores = Runtime.getRuntime().availableProcessors();
        System.out.println("cores"+"="+cores);
        return Executors.newFixedThreadPool(cores);
    }
}

