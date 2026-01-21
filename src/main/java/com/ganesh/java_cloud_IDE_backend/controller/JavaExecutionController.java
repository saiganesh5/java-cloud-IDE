package com.ganesh.java_cloud_IDE_backend.controller;

import com.ganesh.java_cloud_IDE_backend.model.ExecutionRequest;
import com.ganesh.java_cloud_IDE_backend.model.ExecutionResponse;
import com.ganesh.java_cloud_IDE_backend.service.JavaExecutionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@CrossOrigin("*")
@RestController
@RequestMapping("/api/execute")
public class JavaExecutionController {

    private final JavaExecutionService service;
    private final ExecutorService executor;


    public JavaExecutionController(JavaExecutionService service,
                                   ExecutorService executor) {
        this.service = service;
        this.executor = executor;

    }

    @PostMapping("/java")
    public ExecutionResponse execute(@RequestBody ExecutionRequest request) throws Exception {
        Future<ExecutionResponse> future =
                executor.submit(() -> service.execute(request));

        try {
            return future.get(600, TimeUnit.SECONDS);
        } catch (TimeoutException e) {
            future.cancel(true);
            return new ExecutionResponse(
                    "",
                    "Execution timed out",
                    1
            );
        }

    }
}
