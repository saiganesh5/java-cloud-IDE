# JavaCloud IDE

JavaCloud IDE is a web-based Java development environment that allows users to write, manage, and execute Java programs directly from the browser. It provides a lightweight IDE experience with secure, containerized code execution and real-time terminal output.

---

## Features

- Web-based Java code editor with support for multi-file projects  
- File and folder management (create, rename, delete, drag-and-drop)  
- Tab-based editor with autosave and project persistence  
- Secure Java code compilation and execution using Docker containers  
- Real-time terminal output displaying STDOUT, STDERR, and exit codes  
- Asynchronous execution with timeout and resource limits  
- Interactive terminal experience similar to a local IDE  

---

## Architecture Overview

### Frontend
- Built using React and TypeScript
- Provides editor, file explorer, tabs, toolbar, and terminal UI
- Communicates with backend via REST APIs
- Persists projects using browser LocalStorage

### Backend
- Developed using Java and Spring Boot
- Exposes REST APIs for Java code execution
- Uses thread pools for concurrent request handling
- Executes code inside Docker containers for isolation and security
- Enforces execution time limits and resource constraints

---

## Technologies Used

### Languages
- Java  
- TypeScript  

### Frontend
- React.js  
- Tailwind CSS  
- Xterm.js  

### Backend
- Spring Boot  
- REST APIs  
- WebSockets  

### DevOps / Execution
- Docker  
- OpenJDK (Eclipse Temurin)  

### Concurrency
- Java ExecutorService  
- Multithreading  

---

## Execution Flow

1. User writes or edits Java files in the browser editor  
2. Frontend sends source files and main class metadata to backend API  
3. Backend spins up a Docker container for isolated execution  
4. Java code is compiled and executed inside the container  
5. Execution output (STDOUT, STDERR, exit code) is returned to frontend  
6. Results are displayed in the interactive terminal  

---

## Security Considerations

- Code execution is fully sandboxed using Docker containers  
- CPU and memory limits are enforced per execution  
- Network access is restricted during execution  
- Execution timeout prevents infinite loops and resource abuse  

---

## Setup Instructions

### Prerequisites
- Node.js  
- Java (JDK 21 or higher recommended)  
- Docker  
- Maven or Gradle  

### Backend Setup
1. Navigate to the backend directory  
2. Build and run the Spring Boot application  
3. Ensure Docker is running on the system  

### Frontend Setup
1. Navigate to the frontend directory  
2. Install dependencies  
3. Start the development server  

---

## Use Cases

- Practicing Java programming online  
- Demonstrating containerized code execution  
- Learning backend execution pipelines and sandboxing  
- Building scalable online coding platforms  

---

## Future Enhancements

- User authentication and cloud-based project storage  
- Support for multiple programming languages  
- Live input handling during execution  
- Deployment to cloud infrastructure  

---

## Author

Sai Ganesh Dhara

