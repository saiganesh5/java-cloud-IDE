
import { GoogleGenAI, Type } from "@google/genai";
import { JavaFile, ExecutionResult } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

export const executeJavaCode = async (files: JavaFile[], mainFileId: string): Promise<ExecutionResult> => {
  const mainFile = files.find(f => f.id === mainFileId);
  const otherFiles = files.filter(f => f.id !== mainFileId);

  const prompt = `
    You are a Java 21 Execution Engine. Your task is to simulate the compilation and execution of the provided Java files.
    
    MAIN FILE (EntryPoint):
    Filename: ${mainFile?.name}
    Content:
    \`\`\`java
    ${mainFile?.content}
    \`\`\`

    SUPPORTING FILES:
    ${otherFiles.map(f => `Filename: ${f.name}\nContent:\n\`\`\`java\n${f.content}\n\`\`\``).join('\n\n')}

    Analyze the code carefully. 
    1. Check for compilation errors (syntax, missing imports, class mismatches).
    2. If it compiles, simulate the exact output that would appear in a terminal (stdout).
    3. If there's an exception, provide the stack trace in stderr.
    4. Return a JSON object with stdout, stderr, and exitCode.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stdout: { type: Type.STRING, description: "Standard output of the program" },
            stderr: { type: Type.STRING, description: "Errors or stack traces" },
            exitCode: { type: Type.INTEGER, description: "Status code (0 for success, non-zero for error)" }
          },
          required: ["stdout", "stderr", "exitCode"]
        }
      }
    });

    const result = JSON.parse(response.text || '{"stdout": "", "stderr": "Error: Empty response from engine", "exitCode": 1}');
    return result as ExecutionResult;
  } catch (error) {
    console.error("Execution error:", error);
    return {
      stdout: "",
      stderr: `Java Runtime Error: Failed to communicate with execution engine.\n${(error as Error).message}`,
      exitCode: 1
    };
  }
};
