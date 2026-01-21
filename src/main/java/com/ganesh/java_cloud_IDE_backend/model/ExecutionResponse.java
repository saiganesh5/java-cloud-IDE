package com.ganesh.java_cloud_IDE_backend.model;

public class ExecutionResponse {
    private final String stdout;
    private final String stderr;
    private final int exitCode;

    public ExecutionResponse(String stdOut,String stderr,int exitCode){
        this.stdout=stdOut;
        this.stderr=stderr;
        this.exitCode=exitCode;
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
}
