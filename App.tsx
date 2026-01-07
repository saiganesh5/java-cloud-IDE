
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Terminal from './components/Terminal';
import Toolbar from './components/Toolbar';
import Tabs from './components/Tabs';
import { JavaFile, JavaFolder, ExecutionResult, ClipboardItem } from './types';
import { INITIAL_FILES, INITIAL_FOLDERS, NEW_FILE_TEMPLATE, getFileTypeInfo } from './constants';
import { executeJavaCode } from './services/geminiService';

const STORAGE_KEY = 'javacloud_v1_storage';
const SIDEBAR_WIDTH_KEY = 'javacloud_sidebar_width';

const App: React.FC = () => {
  // Load initial state from localStorage if available
  const [folders, setFolders] = useState<JavaFolder[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).folders;
      } catch (e) { return INITIAL_FOLDERS; }
    }
    return INITIAL_FOLDERS;
  });

  const [files, setFiles] = useState<JavaFile[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved).files;
      } catch (e) { return INITIAL_FILES; }
    }
    return INITIAL_FILES;
  });

  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : 280;
  });

  const [activeFileId, setActiveFileId] = useState<string>(files[0]?.id || '');
  const [openFileIds, setOpenFileIds] = useState<string[]>(files[0] ? [files[0].id] : []);
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminalHeight, setTerminalHeight] = useState<number>(200);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const activeFile = files.find(f => f.id === activeFileId) || null;

  // Refs to always have current state inside the interval without re-subscribing the effect
  const stateRef = useRef({ files, folders });
  useEffect(() => {
    stateRef.current = { files, folders };
  }, [files, folders]);

  // Auto-save logic: Every 30 seconds
  useEffect(() => {
    const save = () => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
      setLastSaved(new Date());
    };

    const interval = setInterval(save, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = (id: string) => {
    setActiveFileId(id);
    if (!openFileIds.includes(id)) {
      setOpenFileIds(prev => [...prev, id]);
    }
  };

  const handleCloseFile = (id: string) => {
    const newOpenFiles = openFileIds.filter(fId => fId !== id);
    setOpenFileIds(newOpenFiles);
    
    if (activeFileId === id) {
      if (newOpenFiles.length > 0) {
        setActiveFileId(newOpenFiles[newOpenFiles.length - 1]);
      } else {
        setActiveFileId('');
      }
    }
  };

  const handleFileChange = (content: string) => {
    setFiles(prev => prev.map(f => 
      f.id === activeFileId ? { ...f, content, updatedAt: Date.now() } : f
    ));
  };

  const handleCreateFile = (name: string, folderId: string | null) => {
    const isJava = name.toLowerCase().endsWith('.java');
    const className = name.replace(/\.java$/i, '').replace(/[^a-zA-Z0-9]/g, '_');
    
    const newFile: JavaFile = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      content: isJava ? NEW_FILE_TEMPLATE(className) : '',
      updatedAt: Date.now(),
      folderId,
    };
    setFiles(prev => [...prev, newFile]);
    handleFileSelect(newFile.id);
    if (folderId) setFolders(prev => prev.map(f => f.id === folderId ? { ...f, isOpen: true } : f));
  };

  const handleCreateFolder = (name: string, parentId: string | null) => {
    const newFolder: JavaFolder = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      parentId,
      isOpen: true,
    };
    setFolders(prev => [...prev, newFolder]);
  };

  const handleMoveItem = (id: string, type: 'file' | 'folder', targetFolderId: string | null) => {
    if (type === 'folder') {
      if (id === targetFolderId) return;
      let current = targetFolderId;
      while (current !== null) {
        if (current === id) return;
        const parent = folders.find(f => f.id === current)?.parentId;
        current = parent || null;
      }
      setFolders(prev => prev.map(f => f.id === id ? { ...f, parentId: targetFolderId } : f));
    } else {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, folderId: targetFolderId } : f));
    }
  };

  const handlePaste = (targetFolderId: string | null) => {
    if (!clipboard) return;
    if (clipboard.action === 'cut') {
      handleMoveItem(clipboard.id, clipboard.type, targetFolderId);
      setClipboard(null);
    } else {
      if (clipboard.type === 'file') {
        const sourceFile = files.find(f => f.id === clipboard.id);
        if (sourceFile) {
          const nameParts = sourceFile.name.split('.');
          const ext = nameParts.length > 1 ? nameParts.pop() : '';
          const name = nameParts.join('.');
          const newFile = { 
            ...sourceFile, 
            id: Math.random().toString(36).substr(2, 9), 
            folderId: targetFolderId,
            name: `${name}_copy${ext ? `.${ext}` : ''}`
          };
          setFiles(prev => [...prev, newFile]);
          handleFileSelect(newFile.id);
        }
      } else {
        const sourceFolder = folders.find(f => f.id === clipboard.id);
        if (sourceFolder) {
          const newFolderId = Math.random().toString(36).substr(2, 9);
          const newFolder = { ...sourceFolder, id: newFolderId, parentId: targetFolderId, name: `${sourceFolder.name}_copy` };
          setFolders(prev => [...prev, newFolder]);
          const folderFiles = files.filter(f => f.folderId === sourceFolder.id);
          const clonedFiles = folderFiles.map(f => ({
            ...f,
            id: Math.random().toString(36).substr(2, 9),
            folderId: newFolderId
          }));
          setFiles(prev => [...prev, ...clonedFiles]);
        }
      }
    }
  };

  const handleDeleteFolder = (id: string) => {
    if (!confirm("Delete folder and all contents?")) return;
    const getNestedFolderIds = (folderId: string): string[] => {
      const children = folders.filter(f => f.parentId === folderId);
      return [folderId, ...children.flatMap(c => getNestedFolderIds(c.id))];
    };
    const idsToDelete = getNestedFolderIds(id);
    setFolders(prev => prev.filter(f => !idsToDelete.includes(f.id)));
    setFiles(prev => {
      const remainingFiles = prev.filter(f => !f.folderId || !idsToDelete.includes(f.folderId));
      const removedActive = activeFileId && !remainingFiles.find(f => f.id === activeFileId);
      if (removedActive) {
        const nextActive = remainingFiles[0]?.id || '';
        setActiveFileId(nextActive);
        setOpenFileIds(prevOpen => prevOpen.filter(pId => remainingFiles.some(rf => rf.id === pId)));
      }
      return remainingFiles;
    });
  };

  const handleRenameFolder = (id: string, newName: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
  };

  const handleImportFiles = async (fileList: FileList) => {
    const importedFiles: JavaFile[] = [];
    const readFiles = Array.from(fileList).map(file => {
      return new Promise<void>((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          importedFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            name: file.name,
            content: (e.target?.result as string) || '',
            updatedAt: Date.now(),
            folderId: null
          });
          resolve();
        };
        reader.readAsText(file);
      });
    });
    await Promise.all(readFiles);
    if (importedFiles.length > 0) {
      setFiles(prev => [...prev, ...importedFiles]);
      handleFileSelect(importedFiles[0].id);
    }
  };

  const runCode = async () => {
    if (!activeFileId || !activeFile?.name.toLowerCase().endsWith('.java')) return;
    // Immediate save before execution
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
    setLastSaved(new Date());
    
    setIsRunning(true);
    setExecutionResult(null);
    try {
      const result = await executeJavaCode(files, activeFileId);
      setExecutionResult(result);
    } catch (error) {
      setExecutionResult({ stdout: "", stderr: "Internal error", exitCode: 1 });
    } finally {
      setIsRunning(false);
    }
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isResizingTerminal) {
      const newHeight = window.innerHeight - e.clientY;
      if (newHeight > 60 && newHeight < window.innerHeight - 150) {
        setTerminalHeight(newHeight);
      }
    }
    if (isResizingSidebar) {
      const newWidth = e.clientX;
      if (newWidth > 150 && newWidth < window.innerWidth - 300) {
        setSidebarWidth(newWidth);
      }
    }
  }, [isResizingTerminal, isResizingSidebar]);

  const handleMouseUp = useCallback(() => {
    if (isResizingSidebar) {
      localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
    }
    setIsResizingTerminal(false);
    setIsResizingSidebar(false);
  }, [isResizingSidebar, sidebarWidth]);

  useEffect(() => {
    if (isResizingTerminal || isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingTerminal, isResizingSidebar, handleMouseMove, handleMouseUp]);

  return (
    <div className={`flex h-screen w-screen bg-[#1e1e1e] overflow-hidden font-sans ${isResizingSidebar ? 'cursor-col-resize select-none' : ''} ${isResizingTerminal ? 'cursor-row-resize select-none' : ''}`}>
      {/* Side Panel (Explorer with Integrated Search) */}
      <div 
        className="flex flex-col border-r border-[#333] flex-shrink-0"
        style={{ width: `${sidebarWidth}px` }}
      >
        <Sidebar 
          files={files} 
          folders={folders}
          activeFileId={activeFileId} 
          clipboard={clipboard}
          onFileSelect={handleFileSelect}
          onFileCreate={handleCreateFile}
          onFolderCreate={handleCreateFolder}
          onFileDelete={(id) => {
            setFiles(prev => prev.filter(f => f.id !== id));
            handleCloseFile(id);
          }}
          onFolderDelete={handleDeleteFolder}
          onToggleFolder={(id) => setFolders(prev => prev.map(f => f.id === id ? { ...f, isOpen: !f.isOpen } : f))}
          onFileRename={(id, name) => setFiles(prev => prev.map(f => f.id === id ? { ...f, name } : f))}
          onFolderRename={handleRenameFolder}
          onImportFiles={handleImportFiles}
          onMoveItem={handleMoveItem}
          onSetClipboard={setClipboard}
          onPaste={handlePaste}
        />
      </div>

      {/* Horizontal Resize Handle */}
      <div 
        className={`w-1 cursor-col-resize hover:bg-blue-500/50 transition-colors z-[70] flex-shrink-0 ${isResizingSidebar ? 'bg-blue-500' : 'bg-[#1e1e1e]'}`}
        onMouseDown={(e) => { e.preventDefault(); setIsResizingSidebar(true); }}
      />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Toolbar 
          onRun={runCode} 
          isRunning={isRunning} 
          activeFile={activeFile} 
          lastSaved={lastSaved}
        />

        <div className="flex-1 flex flex-col min-h-0 relative">
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <Tabs 
              files={files}
              openFileIds={openFileIds}
              activeFileId={activeFileId}
              onSelect={setActiveFileId}
              onClose={handleCloseFile}
            />
            <div className="flex-1 relative overflow-hidden bg-[#1e1e1e]">
              {activeFile ? (
                <Editor 
                  key={activeFile.id}
                  content={activeFile.content}
                  onChange={handleFileChange}
                  language={getFileTypeInfo(activeFile.name).language}
                  theme="vs-dark"
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-600 select-none">
                  <i className="fas fa-code text-5xl mb-4 opacity-20"></i>
                  <p className="italic text-sm">Select a file from the explorer to open it</p>
                </div>
              )}
            </div>
          </div>

          {/* Vertical Resize Handle (Terminal) */}
          <div 
            className={`h-1 cursor-ns-resize hover:bg-blue-500/50 transition-colors z-[60] bg-[#333] ${isResizingTerminal ? 'bg-blue-500' : ''}`}
            onMouseDown={(e) => { e.preventDefault(); setIsResizingTerminal(true); }}
          />

          <div style={{ height: `${terminalHeight}px` }} className="flex flex-col flex-shrink-0">
            <Terminal 
              result={executionResult} 
              isRunning={isRunning}
              onClear={() => setExecutionResult(null)}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
