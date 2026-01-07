
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar';
import Editor from './components/Editor';
import Terminal from './components/Terminal';
import Toolbar from './components/Toolbar';
import Tabs from './components/Tabs';
import { JavaFile, JavaFolder, JavaProject, ExecutionResult, ClipboardItem } from './types';
import { INITIAL_FILES, INITIAL_FOLDERS, NEW_FILE_TEMPLATE, getFileTypeInfo } from './constants';
import { executeJavaCode } from './services/geminiService';

const PROJECT_LIST_KEY = 'javacloud_projects_list';
const ACTIVE_PROJECT_ID_KEY = 'javacloud_active_project_id';
const SIDEBAR_WIDTH_KEY = 'javacloud_sidebar_width';

const App: React.FC = () => {
  // --- PROJECT MANAGEMENT ---
  const [projects, setProjects] = useState<JavaProject[]>(() => {
    const saved = localStorage.getItem(PROJECT_LIST_KEY);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [{ id: 'default', name: 'Default Project', createdAt: Date.now() }];
  });

  const [activeProjectId, setActiveProjectId] = useState<string>(() => {
    return localStorage.getItem(ACTIVE_PROJECT_ID_KEY) || 'default';
  });

  // --- PROJECT DATA (FILES/FOLDERS) ---
  const [folders, setFolders] = useState<JavaFolder[]>([]);
  const [files, setFiles] = useState<JavaFile[]>([]);

  // Refs for auto-saving
  const stateRef = useRef({ files, folders });
  useEffect(() => {
    stateRef.current = { files, folders };
  }, [files, folders]);

  const saveCurrentProjectState = useCallback(() => {
    const storageKey = `javacloud_project_data_${activeProjectId}`;
    localStorage.setItem(storageKey, JSON.stringify(stateRef.current));
  }, [activeProjectId]);

  // Load project data when activeProjectId changes
  useEffect(() => {
    // 1. Reset file UI state to prevent state leaking between projects
    setActiveFileId('');
    setOpenFileIds([]);

    const storageKey = `javacloud_project_data_${activeProjectId}`;
    const saved = localStorage.getItem(storageKey);
    
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setFolders(data.folders || []);
        setFiles(data.files || []);
      } catch (e) {
        setFolders([]);
        setFiles([]);
      }
    } else {
      // Initialize new project with default Main.java
      const defaultFiles = [
        {
          id: Math.random().toString(36).substr(2, 9),
          name: 'Main.java',
          content: NEW_FILE_TEMPLATE('Main'),
          updatedAt: Date.now(),
          folderId: null
        }
      ];
      setFolders([]);
      setFiles(defaultFiles);
    }
    localStorage.setItem(ACTIVE_PROJECT_ID_KEY, activeProjectId);
  }, [activeProjectId]);

  // Persist project list
  useEffect(() => {
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(projects));
  }, [projects]);

  // --- UI STATE ---
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : 280;
  });

  const [activeFileId, setActiveFileId] = useState<string>('');
  const [openFileIds, setOpenFileIds] = useState<string[]>([]);

  // Auto-set active file when project finishes loading or files change
  useEffect(() => {
    if (files.length > 0 && !activeFileId) {
      setActiveFileId(files[0].id);
      setOpenFileIds([files[0].id]);
    }
  }, [files, activeFileId]);

  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminalHeight, setTerminalHeight] = useState<number>(200);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const activeFile = files.find(f => f.id === activeFileId) || null;

  // Auto-save logic: Every 30 seconds
  useEffect(() => {
    const save = () => {
      saveCurrentProjectState();
      setLastSaved(new Date());
    };

    const interval = setInterval(save, 30000);
    return () => clearInterval(interval);
  }, [saveCurrentProjectState]);

  const handleCreateProject = (name: string) => {
    // Save current before switching
    saveCurrentProjectState();

    const newProject: JavaProject = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim() || 'Untitled Project',
      createdAt: Date.now()
    };
    
    // Update state
    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
    
    // Immediate save the new list to avoid race conditions
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify([...projects, newProject]));
    setLastSaved(new Date());
  };

  const handleProjectSwitch = (id: string) => {
    saveCurrentProjectState();
    setActiveProjectId(id);
  };

  const handleDeleteProject = (projectId: string) => {
    if (projects.length <= 1) {
      alert("You must have at least one project.");
      return;
    }
    if (!confirm("Are you sure you want to delete this project and all its files?")) return;
    
    setProjects(prev => prev.filter(p => p.id !== projectId));
    localStorage.removeItem(`javacloud_project_data_${projectId}`);
    
    if (activeProjectId === projectId) {
      const remaining = projects.filter(p => p.id !== projectId);
      setActiveProjectId(remaining[0].id);
    }
  };

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
    saveCurrentProjectState();
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
      <div 
        className="flex flex-col border-r border-[#333] flex-shrink-0"
        style={{ width: `${sidebarWidth}px` }}
      >
        <Sidebar 
          projects={projects}
          activeProjectId={activeProjectId}
          onProjectSelect={handleProjectSwitch}
          onProjectCreate={handleCreateProject}
          onProjectDelete={handleDeleteProject}
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
                  key={`${activeProjectId}-${activeFile.id}`}
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
