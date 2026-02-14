**Context window of ChatGPT for Cloudbased IDE**

<h2>**Project Structure**</h2>
```text
java-cloud-IDE-backend/
├── .idea/                          # IDE configuration files
├── .mvn/                           # Maven wrapper configuration
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/ganesh/java_cloud_IDE_backend/
│   │   │       ├── config/         # Configuration beans (Threads)
│   │   │       │   ├── ExecutionThreadPool.java
│   │   │       ├── controller/     # REST API Controllers
│   │   │       │   └── JavaExecutionController.java
│   │   │       ├── handler/        # WebSocket Handlers
│   │   │       ├── model/          # DTOs and Data Models
│   │   │       │   ├── ExecutionRequest.java
│   │   │       │   ├── ExecutionResponse.java
│   │   │       │   └── SourceFile.java
│   │   │       ├── service/        # Core business logic for execution
│   │   │       │   ├── JavaExecutionService.java
│   │   │       │   └── OptimizedJavaExecutionService.java
│   │   │       ├── JavaCloudIdeBackendApplication.java # Spring Boot Entry Point
│   │   └── resources/
│   │       ├── application.properties # App configuration
│   │       ├── static/
│   │       └── templates/
│   └── test/                       # Unit and Integration tests
├── target/                         # Compiled classes and build artifacts
├── Dockerfile                      # Docker image definition for execution environment
├── HELP.md
├── mvnw                            # Maven wrapper script (Unix)
├── mvnw.cmd                        # Maven wrapper script (Windows)
├── pom.xml                         # Project dependencies and build config
└── requirements.txt
```

<h3>**ExecutionThreadPool.java**</h3>
```java
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
```



<h3>**JavaExecutionController.java**</h3>

```java
package com.ganesh.java_cloud_IDE_backend.controller;

import com.ganesh.java_cloud_IDE_backend.model.ExecutionRequest;
import com.ganesh.java_cloud_IDE_backend.model.ExecutionResponse;
import com.ganesh.java_cloud_IDE_backend.service.OptimizedJavaExecutionService;
import org.springframework.web.bind.annotation.*;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

@CrossOrigin("*")
@RestController
@RequestMapping("/api/execute")
public class JavaExecutionController {

    private final OptimizedJavaExecutionService service;
    private final ExecutorService executor;


    public JavaExecutionController(OptimizedJavaExecutionService service,
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
```




<h3>**ExecutionRequest.java**</h3>
```java
package com.ganesh.java_cloud_IDE_backend.model;

import java.util.List;

public class ExecutionRequest {
    private List<SourceFile> files;
    private String mainClass;

    private String input;
    private String command;
    private String currentDirectory;

    public String getCommand() {
        return command;
    }

    public void setCommand(String command) {
        this.command = command;
    }

    public String getCurrentDirectory() {
        return currentDirectory;
    }

    public void setCurrentDirectory(String currentDirectory) {
        this.currentDirectory = currentDirectory;
    }



    public List<SourceFile> getFiles() {
        return files;
    }

    public void setFiles(List<SourceFile> files) {
        this.files = files;
    }

    public String getMainClass() {
        return mainClass;
    }

    public void setMainClass(String mainClass) {
        this.mainClass = mainClass;
    }

    public String getInput() {
        return input;
    }

    public void setInput(String input) {
        this.input = input;
    }
}
```


<h3>**ExecutionResponse.java**</h3>

```java

package com.ganesh.java_cloud_IDE_backend.model;

import java.util.List;

public class ExecutionResponse {
    private final String stdout;
    private final String stderr;
    private final int exitCode;
    private List<SourceFile> updatedFiles;
    private String newDirectory;

    public ExecutionResponse(String stdout, String stderr, int exitCode) {
        this.stdout = stdout;
        this.stderr = stderr;
        this.exitCode = exitCode;
    }

    public ExecutionResponse(String stdout, String stderr, int exitCode, List<SourceFile> updatedFiles, String newDirectory) {
        this.stdout = stdout;
        this.stderr = stderr;
        this.exitCode = exitCode;
        this.updatedFiles = updatedFiles;
        this.newDirectory = newDirectory;
    }

    public String getStdout() {
        return stdout;
    }

    public String getStderr() {
        return stderr;
    }

    public int getExitCode() {
        return exitCode;
    }

    public List<SourceFile> getUpdatedFiles() {
        return updatedFiles;
    }

    public void setUpdatedFiles(List<SourceFile> updatedFiles) {
        this.updatedFiles = updatedFiles;
    }

    public String getNewDirectory() {
        return newDirectory;
    }

    public void setNewDirectory(String newDirectory) {
        this.newDirectory = newDirectory;
    }
}
```


<h3>**SourceFile.java**</h3>

```java
package com.ganesh.java_cloud_IDE_backend.model;

public class SourceFile {
    private String path;
    private String content;

    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getPath() {
        return path;
    }

    public void setPath(String path) {
        this.path = path;
    }
}
```



<h3>**OptimizedJavaExecutionService**</h3>

```java
package com.ganesh.java_cloud_IDE_backend.service;

import com.ganesh.java_cloud_IDE_backend.model.ExecutionRequest;
import com.ganesh.java_cloud_IDE_backend.model.ExecutionResponse;
import com.ganesh.java_cloud_IDE_backend.model.SourceFile;
import jakarta.annotation.PreDestroy;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.regex.Pattern;

@Service
public class OptimizedJavaExecutionService {

    private static final int EXECUTION_TIMEOUT_SECONDS = 6;

    private final ConcurrentHashMap<String, Path> compilationCache = new ConcurrentHashMap<>();
    private final ExecutorService asyncExecutor = Executors.newCachedThreadPool();
    private volatile boolean dockerAvailable = false;

    public OptimizedJavaExecutionService() {
        checkDockerAvailability();
    }

    /* --------------------------------------------------------
       Docker availability check
       -------------------------------------------------------- */
    private void checkDockerAvailability() {
        try {
            Process process = new ProcessBuilder("docker", "--version").start();
            dockerAvailable = process.waitFor(5, TimeUnit.SECONDS)
                    && process.exitValue() == 0;
            if (dockerAvailable) {
                System.out.println("✅ Docker available for execution");
            } else {
                System.err.println("⚠️ Docker unavailable – using local execution");
            }
        } catch (Exception e) {
            dockerAvailable = false;
        }
    }

    /* --------------------------------------------------------
       Public entry point (Run Code button)
       -------------------------------------------------------- */
    public ExecutionResponse execute(ExecutionRequest request) {
        try {
            if (request.getFiles() == null || request.getFiles().isEmpty()) {
                return new ExecutionResponse("", "No source files provided", 1);
            }

            // 1️⃣ Hash files for caching
            String codeHash = calculateHash(request.getFiles());

            // 2️⃣ Compile (with cache)
            Path compiledDir = compilationCache.get(codeHash);
            if (compiledDir == null || !Files.exists(compiledDir)) {
                compiledDir = compileAndCache(request.getFiles(), codeHash);
            }

            // 3️⃣ Detect main class
            String mainClass = detectMainClass(compiledDir);

            // 4️⃣ Execute
            return dockerAvailable
                    ? executeWithDocker(compiledDir, mainClass, request)
                    : executeLocally(compiledDir, mainClass, request);

        } catch (Exception e) {
            return new ExecutionResponse("", "Execution error: " + e.getMessage(), 1);
        }
    }

    /* --------------------------------------------------------
       Compilation with caching
       -------------------------------------------------------- */
    private Path compileAndCache(List<SourceFile> files, String hash) throws Exception {
        Path projectDir = Files.createTempDirectory("java-cache-" + hash.substring(0, 8));

        // Write files
        for (SourceFile file : files) {
            Path filePath = projectDir.resolve(file.getPath());
            Files.createDirectories(filePath.getParent());
            Files.writeString(filePath, file.getContent());
        }

        // Collect .java files
        List<Path> javaFiles = new ArrayList<>();
        try (var stream = Files.walk(projectDir)) {
            stream.filter(p -> p.toString().endsWith(".java")).forEach(javaFiles::add);
        }

        if (javaFiles.isEmpty()) {
            throw new RuntimeException("No Java files found");
        }

        List<String> compileCmd = new ArrayList<>(List.of(
                "javac", "-d", projectDir.toString()
        ));
        javaFiles.forEach(p -> compileCmd.add(p.toString()));

        ProcessBuilder pb = new ProcessBuilder(compileCmd);
        pb.directory(projectDir.toFile());
        pb.redirectErrorStream(true);

        Process process = pb.start();
        String output = readStream(process.getInputStream());

        if (!process.waitFor(30, TimeUnit.SECONDS) || process.exitValue() != 0) {
            throw new RuntimeException("Compilation failed:\n" + output);
        }

        compilationCache.put(hash, projectDir);
        return projectDir;
    }

    /* --------------------------------------------------------
       Docker execution (ephemeral container)
       -------------------------------------------------------- */
    private ExecutionResponse executeWithDocker(
            Path compiledDir,
            String mainClass,
            ExecutionRequest request
    ) throws Exception {

        Path runDir = Files.createTempDirectory("java-run-");

        try {
            // Copy compiled classes
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

            if (request.getInput() != null && !request.getInput().isEmpty()) {
                try (OutputStream os = process.getOutputStream()) {
                    os.write(request.getInput().getBytes());
                }
            }

            String output = asyncExecutor
                    .submit(() -> readStream(process.getInputStream()))
                    .get(EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            int exitCode = process.waitFor();
            return new ExecutionResponse(output, "", exitCode == 0 ? 0 : 1);

        } catch (TimeoutException e) {
            return new ExecutionResponse("", "Execution timed out", 1);
        } finally {
            deleteDirectory(runDir);
        }
    }

    /* --------------------------------------------------------
       Local execution fallback
       -------------------------------------------------------- */
    private ExecutionResponse executeLocally(
            Path compiledDir,
            String mainClass,
            ExecutionRequest request
    ) throws Exception {

        ProcessBuilder pb = new ProcessBuilder(
                "java", "-cp", compiledDir.toString(), mainClass
        );
        pb.redirectErrorStream(true);

        Process process = pb.start();

        if (request.getInput() != null && !request.getInput().isEmpty()) {
            try (OutputStream os = process.getOutputStream()) {
                os.write(request.getInput().getBytes());
            }
        }

        try {
            String output = asyncExecutor
                    .submit(() -> readStream(process.getInputStream()))
                    .get(EXECUTION_TIMEOUT_SECONDS, TimeUnit.SECONDS);

            int exitCode = process.waitFor();
            return new ExecutionResponse(output, "", exitCode == 0 ? 0 : 1);

        } catch (TimeoutException e) {
            process.destroyForcibly();
            return new ExecutionResponse("", "Execution timed out", 1);
        }
    }

    /* --------------------------------------------------------
       Main class detection
       -------------------------------------------------------- */
    private String detectMainClass(Path projectDir) throws Exception {
        Pattern mainPattern = Pattern.compile(
                "public\\s+static\\s+void\\s+main\\s*\\("
        );

        try (var stream = Files.walk(projectDir)) {
            for (Path file : (Iterable<Path>) stream
                    .filter(p -> p.toString().endsWith(".java"))::iterator) {

                String code = Files.readString(file);
                if (mainPattern.matcher(code).find()) {
                    String pkg = "";
                    int pkgIdx = code.indexOf("package ");
                    if (pkgIdx >= 0) {
                        pkg = code.substring(pkgIdx + 8, code.indexOf(";", pkgIdx)).trim() + ".";
                    }
                    return pkg + file.getFileName().toString().replace(".java", "");
                }
            }
        }
        throw new RuntimeException("No main method found");
    }

    /* --------------------------------------------------------
       Utilities
       -------------------------------------------------------- */
    private String readStream(InputStream is) {
        StringBuilder sb = new StringBuilder();
        try (BufferedReader br = new BufferedReader(new InputStreamReader(is))) {
            String line;
            while ((line = br.readLine()) != null) {
                sb.append(line).append("\n");
            }
        } catch (IOException ignored) {}
        return sb.toString();
    }

    private String calculateHash(List<SourceFile> files) throws Exception {
        MessageDigest md = MessageDigest.getInstance("SHA-256");
        files.stream()
                .sorted(Comparator.comparing(SourceFile::getPath))
                .forEach(f -> {
                    md.update(f.getPath().getBytes());
                    md.update(f.getContent().getBytes());
                });

        StringBuilder hex = new StringBuilder();
        for (byte b : md.digest()) {
            hex.append(String.format("%02x", b));
        }
        return hex.toString();
    }

    private void deleteDirectory(Path dir) {
        try {
            Files.walk(dir)
                    .sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {}
                    });
        } catch (IOException ignored) {}
    }

    @PreDestroy
    public void shutdown() {
        asyncExecutor.shutdownNow();
    }
}
```

<h3>**JavaCloudIdeBackendApplication.java**</h3>

```java
package com.ganesh.java_cloud_IDE_backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication
public class JavaCloudIdeBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(JavaCloudIdeBackendApplication.class, args);
		IO.println();
	}

}
```



<h3>**application.properties**</h3>

```sql
spring.application.name=java-cloud-IDE-backend
```



<h3>**Dockerfile**</h3>
```dockerfile
FROM eclipse-temurin:25-jdk

WORKDIR /workspace

RUN useradd -m -s /bin/bash runner && \
    chown -R runner:runner /workspace

USER runner

CMD ["sh"]

```



<h3>**pom.xml**</h3>
```xml
<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
	xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 https://maven.apache.org/xsd/maven-4.0.0.xsd">
	<modelVersion>4.0.0</modelVersion>
	<parent>
		<groupId>org.springframework.boot</groupId>
		<artifactId>spring-boot-starter-parent</artifactId>
		<version>3.5.9</version>
		<relativePath/> <!-- lookup parent from repository -->
	</parent>
	<groupId>com.ganesh</groupId>
	<artifactId>java-cloud-IDE-backend</artifactId>
	<version>0.0.1-SNAPSHOT</version>
	<name>java-cloud-IDE-backend</name>
	<description>Demo project for Spring Boot</description>
	<url/>
	<licenses>
		<license/>
	</licenses>
	<developers>
		<developer/>
	</developers>
	<scm>
		<connection/>
		<developerConnection/>
		<tag/>
		<url/>
	</scm>
	<properties>
		<java.version>25</java.version>
	</properties>
	<dependencies>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-websocket</artifactId>
		</dependency>
		<dependency>
			<groupId>jakarta.annotation</groupId>
			<artifactId>jakarta.annotation-api</artifactId>
			<version>2.1.1</version>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-graphql</artifactId>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-web</artifactId>
		</dependency>

		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-devtools</artifactId>
			<scope>runtime</scope>
			<optional>true</optional>
		</dependency>
		<dependency>
			<groupId>org.springframework.boot</groupId>
			<artifactId>spring-boot-starter-test</artifactId>
			<scope>test</scope>
		</dependency>
		<dependency>
			<groupId>org.springframework.graphql</groupId>
			<artifactId>spring-graphql-test</artifactId>
			<scope>test</scope>
		</dependency>
        <dependency>
            <groupId>org.springframework.boot</groupId>
            <artifactId>spring-boot-starter-actuator</artifactId>
        </dependency>
    </dependencies>

	<build>
		<plugins>
			<plugin>
				<groupId>org.springframework.boot</groupId>
				<artifactId>spring-boot-maven-plugin</artifactId>
			</plugin>
		</plugins>
	</build>

</project>

```
