
import { GoogleGenAI, Type } from "@google/genai";
import { ExtendedExecutionResult, JavaFile } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const simulateJavaWithGemini = async (
  files: JavaFile[],
  folders: any[],
  mainFileId: string,
  input: string = ""
): Promise<ExtendedExecutionResult> => {
  const mainFile = files.find(f => f.id === mainFileId);

  const prompt = `
    You are a Java 21 Execution Engine running in a Linux container. 
    Simulate the execution of this Java project.
    
    MAIN FILE: ${mainFile?.name}
    INPUT: ${input || "None"}
    FILES:
    ${files.map(f => `Path: ${f.name}\nContent:\n${f.content}`).join('\n\n')}

    Analyze the code. If it compiles, return the stdout. If it crashes, return the stderr.
    Also, if the code creates or modifies files, include them in the 'updatedFiles' array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stdout: { type: Type.STRING },
            stderr: { type: Type.STRING },
            exitCode: { type: Type.INTEGER },
            updatedFiles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  path: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["path", "content"]
              }
            }
          },
          required: ["stdout", "stderr", "exitCode"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as ExtendedExecutionResult;
  } catch (error) {
    return {
      stdout: "",
      stderr: `Simulation Error: ${(error as Error).message}`,
      exitCode: 1
    };
  }
};

export const simulateTerminalWithGemini = async (
  files: JavaFile[],
  folders: any[],
  command: string,
  currentDirectory: string,
  input: string = ""
): Promise<ExtendedExecutionResult> => {
  const prompt = `
    You are a Bash terminal in a Docker container (Ubuntu/Temurin).
    CURRENT DIRECTORY: ${currentDirectory}
    COMMAND: ${command}
    STDIN: ${input}
    
    CURRENT FILESYSTEM:
    ${files.map(f => `Path: ${f.name}`).join('\n')}

    Execute the command. 
    1. Provide stdout/stderr.
    2. If the command changes directory (cd), provide the 'newDirectory'.
    3. If the command modifies/creates/deletes files (touch, mkdir, rm, javac, etc.), 
       provide the FULL list of remaining/new files in the 'updatedFiles' array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash-exp",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stdout: { type: Type.STRING },
            stderr: { type: Type.STRING },
            exitCode: { type: Type.INTEGER },
            newDirectory: { type: Type.STRING },
            updatedFiles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  path: { type: Type.STRING },
                  content: { type: Type.STRING }
                },
                required: ["path", "content"]
              }
            }
          },
          required: ["stdout", "stderr", "exitCode"]
        }
      }
    });

    return JSON.parse(response.text || '{}') as ExtendedExecutionResult;
  } catch (error) {
    return {
      stdout: "",
      stderr: `Terminal Simulation Error: ${(error as Error).message}`,
      exitCode: 1
    };
  }
};

// Keep original for compatibility if needed elsewhere
export const executeJavaCode = simulateJavaWithGemini;
