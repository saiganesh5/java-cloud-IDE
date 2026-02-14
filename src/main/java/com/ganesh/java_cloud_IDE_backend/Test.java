package com.ganesh.java_cloud_IDE_backend;

import java.util.*;
import java.io.FileWriter;
public class Test{
    public static void main(String[] args){

        try(FileWriter writer = new FileWriter("C:\\Users\\Asus\\IdeaProjects\\java-cloud-IDE-backend\\src\\main\\java\\com\\ganesh\\java_cloud_IDE_backend\\req.txt")){
            writer.write("T");
            System.out.println("succefully wrote the file");
        }catch(Exception e){
            System.out.print("Error occured "+ e.getMessage());
        }

    }
}