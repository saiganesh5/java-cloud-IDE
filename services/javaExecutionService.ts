import { ExecutionResult, ExtendedExecutionResult, JavaFile, JavaFolder } from '../types';

const EXECUTION_API = 'http://localhost:8080/api/execute/java';

/**
 * Builds the full path for a file by walking up the folder hierarchy
 */
function getFilePath(file: JavaFile, folders: JavaFolder[]): string {
    const pathParts: string[] = [file.name];
    let currentFolderId = file.folderId;

    while (currentFolderId) {
        const folder = folders.find(f => f.id === currentFolderId);
        if (folder) {
            pathParts.unshift(folder.name);
            currentFolderId = folder.parentId;
        } else {
            break;
        }
    }

    return pathParts.join('/');
}

/**
 * Converts file list into backend SourceFile format with full paths
 */
function buildFilesPayload(
    files: JavaFile[],
    folders: JavaFolder[]
): { path: string; content: string }[] {
    return files.map(file => ({
        path: getFilePath(file, folders),
        content: file.content
    }));
}

/**
 * Executes Java code via backend
 * Supports Scanner input via `input` parameter
 */
export async function executeJavaCode(
    files: JavaFile[],
    folders: JavaFolder[],
    activeFileId: string,
    input: string = ''
): Promise<ExtendedExecutionResult> {

    const activeFile = files.find(f => f.id === activeFileId);
    if (!activeFile) {
        throw new Error('No active file selected');
    }

    // Build the main class name including package path
    const mainClassPath = getFilePath(activeFile, folders)
        .replace(/\.java$/i, '')
        .replace(/\//g, '.');

    try {
        const response = await fetch(EXECUTION_API, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                files: buildFilesPayload(files, folders),
                mainClass: mainClassPath,
                input: input
            })
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`Execution failed: ${text}`);
        }

        return await response.json();
    } catch (error) {
        // Return error as execution result if fetch fails
        if (error instanceof TypeError && error.message === 'Failed to fetch') {
            return {
                stdout: '',
                stderr: 'Backend server unreachable. Make sure the Java backend is running on localhost:8080',
                exitCode: 1
            };
        }
        throw error;
    }
}
