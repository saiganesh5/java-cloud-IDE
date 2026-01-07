
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

export interface ExecutionResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export type Theme = 'vs-dark' | 'light';

export interface ClipboardItem {
  type: 'file' | 'folder';
  action: 'copy' | 'cut';
  id: string;
}
