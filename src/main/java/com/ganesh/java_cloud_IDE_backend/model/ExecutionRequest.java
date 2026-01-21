package com.ganesh.java_cloud_IDE_backend.model;

import java.util.List;

public class ExecutionRequest {
    private List<SourceFile> files;
    private String mainClass;

    private String input;

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
