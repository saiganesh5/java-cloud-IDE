//package com.ganesh.java_cloud_IDE_backend.model;
//
//public class ExecutionResponse {
//    private final String stdout;
//    private final String stderr;
//    private final int exitCode;
//
//    public ExecutionResponse(String stdOut,String stderr,int exitCode){
//        this.stdout=stdOut;
//        this.stderr=stderr;
//        this.exitCode=exitCode;
//    }
//
//    public String getStdout() {
//        return stdout;
//    }
//
//    public String getStderr() {
//        return stderr;
//    }
//
//    public int getExitCode() {
//        return exitCode;
//    }
//}


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

