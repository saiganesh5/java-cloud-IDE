/*
import { JavaFile, ExecutionResult } from '../types';

const EXECUTION_API = 'http://localhost:8080/api/execute/java';

export async function executeJavaCode(
    files: JavaFile[],
    activeFileId: string
): Promise<ExecutionResult> {

    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile) {
        throw new Error('No active file');
    }

    const response = await fetch(EXECUTION_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            code: activeFile.content,
            input: ''
        })
    });

    if (!response.ok) {
        throw new Error('Execution service failed');
    }

    return response.json();
}
*/
















import { ExecutionResult, JavaFile } from '../types';

const EXECUTION_API = 'http://localhost:8080/api/execute/java';

/**
 * Converts flat file list into backend SourceFile format
 */
function buildFilesPayload(files: JavaFile[]): { path: string; content: string }[] {
    return files.map(file => ({
        path: file.name, // ⚠️ flat for now (no folders yet)
        content: file.content
    }));
}

export async function executeJavaCode(
    files: JavaFile[],
    activeFileId: string
): Promise<ExecutionResult> {

    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile) {
        throw new Error('No active file selected');
    }

    const response = await fetch(EXECUTION_API, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            files: buildFilesPayload(files),
            mainClass: activeFile.name.replace(/\.java$/i, ''),
            input: ''
        })
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Execution failed: ${text}`);
    }

    return response.json();
}

















// import { ExecutionResult, JavaFile } from '../types';

// const EXECUTION_API = 'http://localhost:8080/api/execute/java';

// function buildFilesPayload(files: JavaFile[]) {
//     return files.map(file => ({
//         path: file.name,
//         content: file.content
//     }));
// }

// export async function executeJavaCode(
//     files: JavaFile[],
//     activeFileId: string,
//     input: string
// ): Promise<ExecutionResult> {

//     const activeFile = files.find(f => f.id === activeFileId);
//     if (!activeFile) {
//         throw new Error('No active file selected');
//     }

//     const response = await fetch(EXECUTION_API, {
//         method: 'POST',
//         headers: {
//             'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//             files: buildFilesPayload(files),
//             mainClass: activeFile.name.replace(/\.java$/i, ''),
//             input: input.endsWith('\n') ? input : input + '\n'
//         })
//     });

//     if (!response.ok) {
//         const text = await response.text();
//         throw new Error(`Execution failed: ${text}`);
//     }

//     return response.json();
// }
