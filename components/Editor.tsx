
import React, { useEffect, useRef } from 'react';
import * as monaco from 'https://cdn.jsdelivr.net/npm/monaco-editor@0.43.0/+esm';

interface EditorProps {
  content: string;
  onChange: (value: string) => void;
  language: string;
  theme: string;
}

const Editor: React.FC<EditorProps> = ({ content, onChange, language, theme }) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const monacoInstance = useRef<any>(null);

  useEffect(() => {
    if (editorRef.current) {
      // Create the editor instance
      monacoInstance.current = monaco.editor.create(editorRef.current, {
        value: content,
        language: language,
        theme: theme,
        automaticLayout: true,
        fontSize: 14,
        minimap: { enabled: true },
        fontFamily: "'Fira Code', 'Courier New', monospace",
        scrollBeyondLastLine: false,
        padding: { top: 10 },
        tabSize: 4,
        insertSpaces: true,
      });

      // Listen for content changes
      const subscription = monacoInstance.current.onDidChangeModelContent(() => {
        const newValue = monacoInstance.current.getValue();
        onChange(newValue);
      });

      return () => {
        subscription.dispose();
        if (monacoInstance.current) {
          monacoInstance.current.dispose();
        }
      };
    }
  }, [language, theme]); // Re-initialize only if structural properties change

  // Sync content when it changes externally but without a key reset (fallback)
  useEffect(() => {
    if (monacoInstance.current) {
      const currentVal = monacoInstance.current.getValue();
      if (currentVal !== content) {
        monacoInstance.current.setValue(content);
      }
    }
  }, [content]);

  return <div ref={editorRef} className="h-full w-full" />;
};

export default Editor;
