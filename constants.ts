
import { JavaFile, JavaFolder } from './types';

export const INITIAL_FOLDERS: JavaFolder[] = [
  {
    id: 'f1',
    name: 'utils',
    parentId: null,
    isOpen: true
  }
];

export const INITIAL_FILES: JavaFile[] = [
  {
    id: '1',
    name: 'Main.java',
    content: `public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, JavaCloud IDE!");
        
        Calculator calc = new Calculator();
        int result = calc.add(10, 5);
        System.out.println("10 + 5 = " + result);
    }
}`,
    updatedAt: Date.now(),
    folderId: null,
  },
  {
    id: '2',
    name: 'Calculator.java',
    content: `public class Calculator {
    public int add(int a, int b) {
        return a + b;
    }
}`,
    updatedAt: Date.now(),
    folderId: 'f1',
  }
];

export const NEW_FILE_TEMPLATE = (className: string) => `public class ${className} {
    public static void main(String[] args) {
        // Your code here
    }
}`;

export const getFileTypeInfo = (fileName: string) => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'java':
      return { icon: 'fab fa-java', color: 'text-orange-500', language: 'java' };
    case 'js':
    case 'jsx':
      return { icon: 'fab fa-js', color: 'text-yellow-400', language: 'javascript' };
    case 'ts':
    case 'tsx':
      return { icon: 'fas fa-code', color: 'text-blue-400', language: 'typescript' };
    case 'py':
      return { icon: 'fab fa-python', color: 'text-blue-500', language: 'python' };
    case 'html':
      return { icon: 'fab fa-html5', color: 'text-orange-600', language: 'html' };
    case 'css':
      return { icon: 'fab fa-css3-alt', color: 'text-blue-500', language: 'css' };
    case 'json':
      return { icon: 'fas fa-file-code', color: 'text-yellow-500', language: 'json' };
    case 'md':
      return { icon: 'fab fa-markdown', color: 'text-blue-300', language: 'markdown' };
    case 'c':
      return { icon: 'fas fa-c', color: 'text-blue-600', language: 'c' };
    case 'cpp':
      return { icon: 'fas fa-plus-circle', color: 'text-blue-700', language: 'cpp' };
    case 'txt':
      return { icon: 'fas fa-file-alt', color: 'text-gray-400', language: 'plaintext' };
    default:
      return { icon: 'fas fa-file-lines', color: 'text-gray-400', language: 'plaintext' };
  }
};
