# Java Cloud IDE Backend

A robust and scalable backend for a Java-based Cloud IDE, built with Spring Boot. This service provides both RESTful and WebSocket-based execution environments for Java code, supporting multi-file projects, interactive input/output, and sandboxed execution using Docker.

## Features

- **Multi-File Java Support:** Compile and execute Java projects consisting of multiple source files and packages.
- **Dual Execution Modes:**
  - **REST API:** For stateless, one-off code execution.
  - **WebSocket (Interactive):** For real-time, interactive execution with support for standard input (`System.in`) and output (`System.out`).
- **Sandboxed Execution:** Supports running Java code inside a Docker container for security and isolation.
- **Optimized Performance:**
  - **Caching:** Caches compiled class files to speed up subsequent executions of the same code.
  - **Thread Pooling:** Efficiently manages concurrent execution requests using a dedicated thread pool.
- **Modern Java Support:** Configured for Java 21 with preview features enabled.

## Tech Stack

- **Framework:** Spring Boot 3.5.9
- **Language:** Java 21
- **Communication:**
  - REST API (Spring Web)
  - WebSockets (Spring WebSocket)
- **Containerization:** Docker (for sandboxed execution)
- **Build Tool:** Maven

## How It Works

### Execution Flow

1. **Request Reception:** The backend receives a request containing a list of source files (path and content).
2. **Project Setup:** Files are written to a temporary directory, preserving the directory structure for packages.
3. **Compilation:**
   - The system calculates a hash of the source files.
   - If a cached version exists, it reuses the compiled classes.
   - Otherwise, it compiles the files using `javac`.
4. **Execution:**
   - **REST Mode:** Executes the `main` class and returns the full output and error logs once finished.
   - **WebSocket Mode:** Starts the process and streams output/errors back to the client in real-time. It also listens for input from the client and pipes it to the process's standard input.
5. **Isolation:** If Docker is available, the execution happens inside a lightweight Docker container (`eclipse-temurin:25-jdk`) to ensure the host system remains secure. If Docker is not present, it falls back to local execution.
6. **Cleanup:** Temporary directories and processes are cleaned up after execution.

## Getting Started

### Prerequisites

- **Java 21 JDK** or higher.
- **Maven** 3.8+.
- **Docker** (Optional, but recommended for sandboxed execution).

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/java-cloud-IDE-backend.git
   cd java-cloud-IDE-backend
   ```

2. **Build the project:**
   ```bash
   ./mvnw clean install
   ```

3. **Run the application:**
   ```bash
   ./mvnw spring-boot:run
   ```
   The server will start on `http://localhost:8080`.

## API Documentation

### REST API

**Endpoint:** `POST /api/execute/java`

**Request Body:**
```json
{
  "files": [
    {
      "path": "Main.java",
      "content": "public class Main { public static void main(String[] args) { System.out.println(\"Hello, Cloud IDE!\"); } }"
    }
  ],
  "mainClass": "Main"
}
```

**Response Body:**
```json
{
  "output": "Hello, Cloud IDE!\n",
  "error": "",
  "exitCode": 0
}
```

### WebSocket API

**Endpoint:** `ws://localhost:8080/ws/execute`

**Message Format (JSON):**

1. **Start Execution:**
   ```json
   {
     "type": "START",
     "files": [
       {
         "path": "Main.java",
         "content": "..."
       }
     ],
     "mainClass": "Main"
   }
   ```

2. **Send Input:**
   ```json
   {
     "type": "INPUT",
     "data": "user input text"
   }
   ```

3. **Stop Execution:**
   ```json
   {
     "type": "STOP"
   }
   ```

**Server Responses:**
- `{"type": "OUTPUT", "data": "..."}`
- `{"type": "EXIT", "data": "exit_code"}`
- `{"type": "ERROR", "data": "..."}`

## Docker Integration

The project includes a `Dockerfile` used for the execution sandbox. Ensure Docker is running on your machine for the backend to automatically pick it up and use it for isolation.

The default image used is `eclipse-temurin:25-jdk`.

## Configuration

Configuration can be found in `src/main/resources/application.properties`.

Key properties:
- `server.port`: Port on which the backend runs (default: 8080).
- `spring.main.allow-bean-definition-overriding`: Set to `true`.
