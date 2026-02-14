
export interface JavaProject {
  id: string;
  name: string;
  createdAt: number;
}

export interface JavaFolder {
  id: string;
  name: string;
  parentId: string | null;
  isOpen: boolean;
}

export interface JavaFile {
  id: string;
  name: string;
  content: string;
  updatedAt: number;
  folderId: string | null;
}

export interface FileSystemState {
  files: JavaFile[];
  folders: JavaFolder[];
}

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export interface ExtendedExecutionResult extends ExecutionResult {
  updatedFiles?: { path: string; content: string }[];
  newDirectory?: string;
}

export type Theme = 'vs-dark' | 'light';

export interface ClipboardItem {
  type: 'file' | 'folder';
  action: 'copy' | 'cut';
  id: string;
}
