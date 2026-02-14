import React, { useCallback, useEffect, useState } from 'react';
import './App.css';
import DockerTerminal from "./components/DockerTerminal";
import Editor from './components/Editor';
import ExecutionTerminal from "./components/ExecutionTerminal";
import Sidebar from './components/Sidebar';
import Tabs from './components/Tabs';
import Toolbar from './components/Toolbar';
import { NEW_FILE_TEMPLATE, getFileTypeInfo } from './constants';
import { ClipboardItem, JavaFile, JavaFolder, JavaProject } from './types';

const PROJECT_LIST_KEY = 'javacloud_projects_list';
const ACTIVE_PROJECT_ID_KEY = 'javacloud_active_project_id';
const SIDEBAR_WIDTH_KEY = 'javacloud_sidebar_width';

// Helper to build file path from folder hierarchy
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



const App: React.FC = () => {
  // --- PROJECT MANAGEMENT ---
  const [terminalMode, setTerminalMode] = useState<"OUTPUT" | "BASH">("OUTPUT");
  const [terminalCommand, setTerminalCommand] = useState("");
  const [stopSignal, setStopSignal] = useState(0);
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
  const [isLoaded, setIsLoaded] = useState(false);

  // Load project data when activeProjectId changes
  useEffect(() => {
    setIsLoaded(false);

    const storageKey = `javacloud_project_data_${activeProjectId}`;
    const saved = localStorage.getItem(storageKey);

    let loadedFiles: JavaFile[] = [];
    let loadedFolders: JavaFolder[] = [];

    if (saved) {
      try {
        const data = JSON.parse(saved);
        loadedFolders = data.folders || [];
        loadedFiles = data.files || [];
      } catch (e) {
        loadedFolders = [];
        loadedFiles = [];
      }
    } else {
      loadedFiles = [
        {
          id: Math.random().toString(36).substr(2, 9),
          name: 'Main.java',
          content: NEW_FILE_TEMPLATE('Main'),
          updatedAt: Date.now(),
          folderId: null
        }
      ];
      loadedFolders = [];
    }

    setFolders(loadedFolders);
    setFiles(loadedFiles);

    // Load and validate activeFileId and openFileIds
    const savedActiveFile = localStorage.getItem(`javacloud_active_file_${activeProjectId}`) || '';
    const savedOpenFilesRaw = localStorage.getItem(`javacloud_open_files_${activeProjectId}`);
    let savedOpenFiles: string[] = [];
    if (savedOpenFilesRaw) {
      try { savedOpenFiles = JSON.parse(savedOpenFilesRaw); } catch { savedOpenFiles = []; }
    }

    // Validate IDs against loaded files
    const validFileIds = new Set(loadedFiles.map(f => f.id));
    const validActiveFile = validFileIds.has(savedActiveFile) ? savedActiveFile : '';
    const validOpenFiles = savedOpenFiles.filter(id => validFileIds.has(id));

    setActiveFileId(validActiveFile);
    setOpenFileIds(validOpenFiles);

    localStorage.setItem(ACTIVE_PROJECT_ID_KEY, activeProjectId);
    setIsLoaded(true);
  }, [activeProjectId]);

  // Proactive save on any change
  useEffect(() => {
    if (isLoaded && activeProjectId) {
      const storageKey = `javacloud_project_data_${activeProjectId}`;
      localStorage.setItem(storageKey, JSON.stringify({ files, folders }));
      setLastSaved(new Date());
    }
  }, [files, folders, activeProjectId, isLoaded]);

  // Persist project list
  useEffect(() => {
    localStorage.setItem(PROJECT_LIST_KEY, JSON.stringify(projects));
  }, [projects]);

  // --- UI STATE ---
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : 280;
  });

  // Load activeFileId and openFileIds from localStorage per project
  const [activeFileId, setActiveFileId] = useState<string>(() => {
    const saved = localStorage.getItem(`javacloud_active_file_${activeProjectId}`);
    return saved || '';
  });
  const [openFileIds, setOpenFileIds] = useState<string[]>(() => {
    const saved = localStorage.getItem(`javacloud_open_files_${activeProjectId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch { return []; }
    }
    return [];
  });

  // Save activeFileId to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(`javacloud_active_file_${activeProjectId}`, activeFileId);
  }, [activeFileId, activeProjectId]);

  // Save openFileIds to localStorage when they change
  useEffect(() => {
    localStorage.setItem(`javacloud_open_files_${activeProjectId}`, JSON.stringify(openFileIds));
  }, [openFileIds, activeProjectId]);

  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [terminalHeight, setTerminalHeight] = useState<number>(200);
  const [clipboard, setClipboard] = useState<ClipboardItem | null>(null);
  const [isResizingTerminal, setIsResizingTerminal] = useState(false);
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const activeFile = files.find(f => f.id === activeFileId) || null;

  const handleCreateProject = useCallback((name: string) => {
    const newProject: JavaProject = {
      id: Math.random().toString(36).substr(2, 9),
      name: name.trim() || 'Untitled Project',
      createdAt: Date.now()
    };

    setProjects(prev => [...prev, newProject]);
    setActiveProjectId(newProject.id);
  }, []);

  const handleProjectSwitch = useCallback((id: string) => {
    setActiveProjectId(id);
  }, []);

  const handleProjectDelete = useCallback((projectId: string) => {
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
  }, [projects, activeProjectId]);

  const handleFileSelect = useCallback((id: string) => {
    setActiveFileId(id);
    setOpenFileIds(prev => prev.includes(id) ? prev : [...prev, id]);
  }, []);

  const handleCloseFile = useCallback((id: string) => {
    setOpenFileIds(prev => {
      const newOpenFiles = prev.filter(fId => fId !== id);
      if (activeFileId === id) {
        if (newOpenFiles.length > 0) {
          setActiveFileId(newOpenFiles[newOpenFiles.length - 1]);
        } else {
          setActiveFileId('');
        }
      }
      return newOpenFiles;
    });
  }, [activeFileId]);

  const handleFileChange = useCallback((content: string) => {
    setFiles(prev => prev.map(f =>
      f.id === activeFileId ? { ...f, content, updatedAt: Date.now() } : f
    ));
  }, [activeFileId]);

  const handleCreateFile = useCallback((name: string, folderId: string | null) => {
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
    if (folderId) {
      setFolders(prev => prev.map(f => f.id === folderId ? { ...f, isOpen: true } : f));
    }
  }, [handleFileSelect]);

  const handleCreateFolder = useCallback((name: string, parentId: string | null) => {
    const newFolder: JavaFolder = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      parentId,
      isOpen: true,
    };
    setFolders(prev => {
      let updated = [...prev, newFolder];
      if (parentId) {
        updated = updated.map(f => f.id === parentId ? { ...f, isOpen: true } : f);
      }
      return updated;
    });
  }, []);

  const handleMoveItem = useCallback((id: string, type: 'file' | 'folder', targetFolderId: string | null) => {
    if (type === 'folder') {
      if (id === targetFolderId) return;
      setFolders(prev => {
        let current = targetFolderId;
        while (current !== null) {
          if (current === id) return prev; // Avoid cycles
          const parent = prev.find(f => f.id === current)?.parentId;
          current = parent || null;
        }
        return prev.map(f => f.id === id ? { ...f, parentId: targetFolderId } : f);
      });
    } else {
      setFiles(prev => prev.map(f => f.id === id ? { ...f, folderId: targetFolderId } : f));
    }
  }, []);

  const handlePaste = useCallback((targetFolderId: string | null) => {
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
  }, [clipboard, files, folders, handleFileSelect, handleMoveItem]);

  const handleDeleteFolder = useCallback((folderId: string) => {
    if (!confirm("Delete folder and all its contents?")) return;

    setFolders(prevFolders => {
      // Find all nested IDs within the current functional update scope
      const getNestedIds = (fid: string, all: JavaFolder[]): string[] => {
        const children = all.filter(f => f.parentId === fid);
        return [fid, ...children.flatMap(c => getNestedIds(c.id, all))];
      };

      const idsToRemove = getNestedIds(folderId, prevFolders);

      // Remove files inside these folders and clean up tab UI state
      setFiles(prevFiles => {
        const affectedFileIds = prevFiles
          .filter(f => f.folderId && idsToRemove.includes(f.folderId))
          .map(f => f.id);

        if (affectedFileIds.length > 0) {
          setOpenFileIds(prevTabs => prevTabs.filter(id => !affectedFileIds.includes(id)));
          setActiveFileId(prevActive => affectedFileIds.includes(prevActive) ? '' : prevActive);
        }

        return prevFiles.filter(f => !f.folderId || !idsToRemove.includes(f.folderId));
      });

      return prevFolders.filter(f => !idsToRemove.includes(f.id));
    });
  }, []);

  const handleRenameFolder = useCallback((id: string, newName: string) => {
    setFolders(prev => prev.map(f => f.id === id ? { ...f, name: newName } : f));
  }, []);

  const handleImportFiles = useCallback(async (fileList: FileList) => {
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
  }, [handleFileSelect]);

  // Handle file changes from Docker container
  const handleFilesChangeFromContainer = useCallback((containerFiles: { path: string; content: string }[], directories?: string[]) => {
    // First, ensure all directories exist (including empty ones)
    if (directories && directories.length > 0) {
      setFolders(prevFolders => {
        const newFolders = [...prevFolders];
        const folderMap = new Map<string, string>();

        // Build map of existing folders by path
        for (const folder of prevFolders) {
          let path = folder.name;
          let parent = prevFolders.find(p => p.id === folder.parentId);
          while (parent) {
            path = parent.name + '/' + path;
            parent = prevFolders.find(p => p.id === parent!.parentId);
          }
          folderMap.set(path, folder.id);
        }

        // Create any missing directories
        for (const dirPath of directories) {
          const parts = dirPath.split('/');
          let currentPath = '';
          let currentParentId: string | null = null;

          for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!folderMap.has(currentPath)) {
              const newId = Math.random().toString(36).substr(2, 9);
              folderMap.set(currentPath, newId);
              newFolders.push({
                id: newId,
                name: part,
                parentId: currentParentId,
                isOpen: true
              });
              currentParentId = newId;
            } else {
              currentParentId = folderMap.get(currentPath)!;
            }
          }
        }

        return newFolders;
      });
    }

    // Build set of container paths for quick lookup
    const containerFilePaths = new Set(containerFiles.map(cf => cf.path));
    const containerDirPaths = new Set(directories || []);

    // Update existing files, add new ones, and REMOVE deleted ones
    setFiles(prevFiles => {
      // First, filter out files that no longer exist in container
      const remainingFiles = prevFiles.filter(f => {
        const filePath = getFilePath(f, folders);
        return containerFilePaths.has(filePath);
      });

      const updatedFiles = [...remainingFiles];
      let hasChanges = false;

      for (const cf of containerFiles) {
        const pathParts = cf.path.split('/');
        const fileName = pathParts.pop()!;
        const folderPath = pathParts.join('/');

        // Find existing file by matching path
        const existingIndex = updatedFiles.findIndex(f => {
          const existingPath = getFilePath(f, folders);
          return existingPath === cf.path;
        });

        if (existingIndex >= 0) {
          // Only update if content actually changed
          if (updatedFiles[existingIndex].content !== cf.content) {
            updatedFiles[existingIndex] = {
              ...updatedFiles[existingIndex],
              content: cf.content,
              updatedAt: Date.now()
            };
            hasChanges = true;
          }
        } else {
          // Create new file - find or create folder
          let targetFolderId: string | null = null;

          if (folderPath) {
            // Find folder by path
            const folder = folders.find(f => {
              // Build folder path
              let path = f.name;
              let parent = folders.find(p => p.id === f.parentId);
              while (parent) {
                path = parent.name + '/' + path;
                parent = folders.find(p => p.id === parent!.parentId);
              }
              return path === folderPath;
            });
            targetFolderId = folder?.id || null;
          }

          // Add new file
          updatedFiles.push({
            id: Math.random().toString(36).substr(2, 9),
            name: fileName,
            content: cf.content,
            updatedAt: Date.now(),
            folderId: targetFolderId
          });
          hasChanges = true;
        }
      }

      // Only return new array if there were actual changes
      if (hasChanges || remainingFiles.length !== prevFiles.length) {
        return updatedFiles;
      }
      return prevFiles;
    });

    // Remove folders that no longer exist in container
    if (directories !== undefined) {
      setFolders(prevFolders => {
        return prevFolders.filter(folder => {
          // Build folder path
          let path = folder.name;
          let parent = prevFolders.find(p => p.id === folder.parentId);
          while (parent) {
            path = parent.name + '/' + path;
            parent = prevFolders.find(p => p.id === parent!.parentId);
          }
          return containerDirPaths.has(path);
        });
      });
    }

    // Close tabs for deleted files
    setOpenFileIds(prev => prev.filter(id => {
      // Check if this file still exists
      return containerFilePaths.has(getFilePath(
        { id, name: '', content: '', updatedAt: 0, folderId: null }, folders
      )) || true; // Keep if we can't verify
    }));

    console.log(`📁 Synced ${containerFiles.length} files and ${directories?.length || 0} directories from container`);
  }, [folders]);

  // Inside App.tsx

  const runCode = async () => {
    if (!activeFileId || !activeFile?.name.toLowerCase().endsWith('.java')) return;

    // Use Spring Boot WebSocket for execution
    setTerminalMode("OUTPUT");
    setIsRunning(true);
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
          onProjectDelete={handleProjectDelete}
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
          onStop={() => setStopSignal(s => s + 1)}
          isRunning={isRunning}
          activeFile={activeFile}
          lastSaved={lastSaved}
          terminalMode={terminalMode}
          onToggleTerminal={() =>
            setTerminalMode(prev => prev === "BASH" ? "OUTPUT" : "BASH")
          }
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
              {!isLoaded ? (
                <div className="flex items-center justify-center h-full">
                  <i className="fas fa-spinner fa-spin text-3xl opacity-20"></i>
                </div>
              ) : activeFile ? (
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

          <div style={{ height: terminalHeight }}>
            {terminalMode === "OUTPUT" && (
              <ExecutionTerminal
                isRunning={isRunning}
                files={files.map(f => ({ path: getFilePath(f, folders), content: f.content }))}
                mainClass=""
                onComplete={(code) => setIsRunning(false)}
                onFilesChanged={handleFilesChangeFromContainer}
                stopSignal={stopSignal}
              />
            )}

            {terminalMode === "BASH" && (
              <DockerTerminal
                key={activeProjectId}
                projectId={activeProjectId}
                files={files}
                folders={folders}
                onFilesChange={handleFilesChangeFromContainer}
                runCommand={terminalCommand}
                stopSignal={stopSignal}
              />
            )}
          </div>


        </div>
      </div>
    </div>
  );
};

export default App;
