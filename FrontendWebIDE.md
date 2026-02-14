**Front-end Structure**

```text
/.env.local
/.gitignore
/App.tsx
/constants.ts
/FrontendWebIDE.md
/global.d.ts
/index.html
/index.tsx
/metadata.json
/package.json
/README.md
/tsconfig.json
/types.ts
/vite.config.ts
/components
/components/Editor.tsx
/components/InteractiveTerminal.tsx
/components/Search.tsx
/components/Sidebar.tsx
/components/Tabs.tsx
/components/Terminal.tsx
/components/Toolbar.tsx
/services
/services/geminiService.ts
/services/javaExecutionService.ts
```


<h3>**Editor.tsx**</h3>
```typescript

import * as monaco from 'monaco-editor';
import React, { useEffect, useRef } from 'react';

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
```



<h3>**InteractiveTerminal.tsx**</h3>
```typescript
import React, { useEffect, useRef } from 'react';
import { Terminal as XTerminal } from 'xterm';
import { FitAddon } from 'xterm-addon-fit';
import 'xterm/css/xterm.css';

interface InteractiveTerminalProps {
    result: any;
    isRunning: boolean;
    onClear: () => void;
}

const InteractiveTerminal: React.FC<InteractiveTerminalProps> = ({ result, isRunning, onClear }) => {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerminal | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);

    // Initialize Terminal UI
    useEffect(() => {
        const term = new XTerminal({
            cursorBlink: true,
            theme: {
                background: '#1e1e1e',
                foreground: '#cccccc',
                selectionBackground: '#264f78',
                cursor: '#ffffff',
            },
            fontSize: 13,
            fontFamily: "'Fira Code', 'Courier New', monospace",
            convertEol: true,
            scrollback: 1000,
        });

        const fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        fitAddonRef.current = fitAddon;

        if (terminalRef.current) {
            term.open(terminalRef.current);

            // Wait for the terminal to be fully rendered before fitting
            setTimeout(() => {
                fitAddon.fit();
            }, 0);

            xtermRef.current = term;

            term.writeln('\x1b[36mJavaCloud Terminal Ready\x1b[0m');
            term.writeln('Click "Run Code" to execute your program.\r\n');
        }

        // Handle window resize and container resize
        const resizeObserver = new ResizeObserver(() => {
            if (fitAddonRef.current && xtermRef.current) {
                setTimeout(() => {
                    fitAddonRef.current?.fit();
                }, 0);
            }
        });

        if (terminalRef.current) {
            resizeObserver.observe(terminalRef.current);
        }

        return () => {
            resizeObserver.disconnect();
            term.dispose();
        };
    }, []);

    // Display REST API results in terminal
    useEffect(() => {
        if (result && xtermRef.current) {
            xtermRef.current.clear();

            if (result.stdout) {
                xtermRef.current.writeln('\x1b[32m--- STDOUT ---\x1b[0m');
                result.stdout.split('\n').forEach((line: string) => {
                    xtermRef.current?.writeln(line);
                });
                xtermRef.current.writeln('');
            }

            if (result.stderr) {
                xtermRef.current.writeln('\x1b[31m--- STDERR ---\x1b[0m');
                result.stderr.split('\n').forEach((line: string) => {
                    xtermRef.current?.writeln('\x1b[31m' + line + '\x1b[0m');
                });
                xtermRef.current.writeln('');
            }

            const exitColor = result.exitCode === 0 ? '\x1b[32m' : '\x1b[31m';
            xtermRef.current.writeln(`${exitColor}Process exited with code: ${result.exitCode}\x1b[0m`);
        }
    }, [result]);

    // Show running indicator
    useEffect(() => {
        if (isRunning && xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.writeln('\x1b[33m⚡ Compiling and running your code...\x1b[0m\r\n');
        }
    }, [isRunning]);

    const handleClear = () => {
        if (xtermRef.current) {
            xtermRef.current.clear();
            xtermRef.current.writeln('\x1b[36mTerminal cleared\x1b[0m\r\n');
        }
        onClear();
    };

    return (
        <div className="bg-[#1e1e1e] h-full flex flex-col overflow-hidden">
        <div className="px-4 py-2 bg-[#252526] flex items-center justify-between text-[11px] text-gray-400 border-b border-[#333] uppercase font-semibold flex-shrink-0">
        <div className="flex items-center">
        <i className="fas fa-terminal mr-2 text-blue-400"></i>
            <span>Output Terminal</span>
    </div>
    <button
    onClick={handleClear}
    className="px-2 py-1 hover:bg-[#333] rounded text-xs normal-case transition-colors"
    title="Clear Output"
    >
    <i className="fas fa-trash-alt mr-1"></i>
    Clear
    </button>
    </div>
    <div className="flex-1 overflow-hidden">
    <div ref={terminalRef} className="h-full w-full" />
        </div>
        </div>
);
};

export default InteractiveTerminal;
```



<h3>**Search.tsx**</h3>
```typescript
// This component has been deprecated and its functionality moved to Sidebar.tsx
export default {};
```



<h3>**Sidebar.tsx**</h3>
```typescript
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getFileTypeInfo } from '../constants';
import { ClipboardItem, JavaFile, JavaFolder, JavaProject } from '../types';

interface SidebarProps {
  projects: JavaProject[];
  activeProjectId: string;
  onProjectSelect: (id: string) => void;
  onProjectCreate: (name: string) => void;
  onProjectDelete: (id: string) => void;
  files: JavaFile[];
  folders: JavaFolder[];
  activeFileId: string;
  clipboard: ClipboardItem | null;
  onFileSelect: (id: string) => void;
  onFileCreate: (name: string, folderId: string | null) => void;
  onFolderCreate: (name: string, parentId: string | null) => void;
  onFileDelete: (id: string) => void;
  onFolderDelete: (id: string) => void;
  onToggleFolder: (id: string) => void;
  onFileRename: (id: string, newName: string) => void;
  onFolderRename: (id: string, newName: string) => void;
  onImportFiles: (files: FileList) => void;
  onMoveItem: (id: string, type: 'file' | 'folder', targetFolderId: string | null) => void;
  onSetClipboard: (item: ClipboardItem | null) => void;
  onPaste: (targetFolderId: string | null) => void;
}

const ContextMenu: React.FC<{
  x: number;
  y: number;
  type: 'file' | 'folder' | 'root';
  itemId: string | null;
  onClose: () => void;
  actions: {
    label: string;
    icon: string;
    onClick: () => void;
    danger?: boolean;
    disabled?: boolean;
  }[];
}> = ({ x, y, actions, onClose }) => {
  useEffect(() => {
    const handleClick = () => onClose();
    window.addEventListener('click', handleClick);
    return () => window.removeEventListener('click', handleClick);
  }, [onClose]);

  return (
    <div 
      className="fixed z-[100] bg-[#252526] border border-[#454545] shadow-2xl py-1 min-w-[160px] rounded"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {actions.map((action, i) => (
        <button
          key={i}
          disabled={action.disabled}
          onClick={() => { action.onClick(); onClose(); }}
          className={`w-full text-left px-3 py-1.5 text-xs flex items-center hover:bg-[#094771] transition-colors ${
            action.danger ? 'text-red-400' : 'text-gray-300'
          } ${action.disabled ? 'opacity-30 cursor-not-allowed' : ''}`}
        >
          <i className={`fas ${action.icon} w-4 mr-2 opacity-70`}></i>
          {action.label}
        </button>
      ))}
    </div>
  );
};

const Sidebar: React.FC<SidebarProps> = (props) => {
  const { 
    projects, activeProjectId, onProjectSelect, onProjectCreate, onProjectDelete,
    files, folders, activeFileId, clipboard, 
    onFileSelect, onFileCreate, onFolderCreate, 
    onFileDelete, onFolderDelete, onToggleFolder, 
    onFileRename, onFolderRename, onImportFiles,
    onMoveItem, onSetClipboard, onPaste
  } = props;

  // Search State
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Project Manager State
  const [isProjectDropdownOpen, setIsProjectDropdownOpen] = useState(false);
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  // File System State
  const [isCreatingFile, setIsCreatingFile] = useState<{parentId: string | null} | null>(null);
  const [isCreatingFolder, setIsCreatingFolder] = useState<{parentId: string | null} | null>(null);
  const [newEntryName, setNewEntryName] = useState('');
  const [editing, setEditing] = useState<{id: string, type: 'file' | 'folder', name: string} | null>(null);
  const [menu, setMenu] = useState<{x: number, y: number, type: 'file' | 'folder' | 'root', id: string | null} | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeProject = useMemo(() => projects.find(p => p.id === activeProjectId), [projects, activeProjectId]);

  const handleCreateProjectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      onProjectCreate(newProjectName.trim());
      setNewProjectName('');
      setIsAddingProject(false);
      setIsProjectDropdownOpen(false);
    }
  };

  const searchResults = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    const query = searchQuery.toLowerCase();
    
    const fileResults = files.filter(f => {
      const nameMatch = f.name.toLowerCase().includes(query);
      const contentMatch = f.content.toLowerCase().includes(query);
      return nameMatch || contentMatch;
    }).map(f => {
      const lines = f.content.split('\n');
      const matchingLineIdx = lines.findIndex(l => l.toLowerCase().includes(query));
      const previewText = matchingLineIdx !== -1 ? lines[matchingLineIdx].trim() : '';
      return { ...f, type: 'file' as const, previewText, matchingLineIdx: matchingLineIdx + 1 };
    });

    const folderResults = folders.filter(f => f.name.toLowerCase().includes(query))
      .map(f => ({ ...f, type: 'folder' as const, previewText: '', matchingLineIdx: 0 }));

    return [...folderResults, ...fileResults];
  }, [files, folders, searchQuery]);

  const handleContextMenu = (e: React.MouseEvent, type: 'file' | 'folder' | 'root', id: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setMenu({ x: e.clientX, y: e.clientY, type, id });
  };

  const getMenuActions = () => {
    if (!menu) return [];
    const isPasteDisabled = !clipboard;
    
    const baseActions = [
      { label: 'New File', icon: 'fa-file-plus', onClick: () => {
          if (menu.id) {
            const f = folders.find(folder => folder.id === menu.id);
            if (f && !f.isOpen) onToggleFolder(menu.id);
          }
          setIsCreatingFile({ parentId: menu.id });
          setIsCreatingFolder(null);
      }},
      { label: 'New Folder', icon: 'fa-folder-plus', onClick: () => {
          if (menu.id) {
            const f = folders.find(folder => folder.id === menu.id);
            if (f && !f.isOpen) onToggleFolder(menu.id);
          }
          setIsCreatingFolder({ parentId: menu.id });
          setIsCreatingFile(null);
      }},
      { label: 'Paste', icon: 'fa-paste', disabled: isPasteDisabled, onClick: () => onPaste(menu.id) },
    ];

    if (menu.type === 'root') return baseActions;

    const itemActions = [
      { label: 'Copy', icon: 'fa-copy', onClick: () => onSetClipboard({ type: menu.type as any, action: 'copy', id: menu.id! }) },
      { label: 'Cut', icon: 'fa-cut', onClick: () => onSetClipboard({ type: menu.type as any, action: 'cut', id: menu.id! }) },
      { label: 'Rename', icon: 'fa-i-cursor', onClick: () => {
          const name = menu.type === 'file' ? files.find(f => f.id === menu.id)?.name : folders.find(f => f.id === menu.id)?.name;
          setEditing({ id: menu.id!, type: menu.type as any, name: name || '' });
      }},
      { label: 'Delete', icon: 'fa-trash', danger: true, onClick: () => menu.type === 'file' ? onFileDelete(menu.id!) : onFolderDelete(menu.id!) },
    ];

    return menu.type === 'folder' ? [...baseActions, ...itemActions] : itemActions;
  };

  const handleDragStart = (e: React.DragEvent, id: string, type: 'file' | 'folder') => {
    e.dataTransfer.setData('sourceId', id);
    e.dataTransfer.setData('sourceType', type);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDrop = (e: React.DragEvent, targetFolderId: string | null) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverId(null);
    const id = e.dataTransfer.getData('sourceId');
    const type = e.dataTransfer.getData('sourceType') as 'file' | 'folder';
    if (id) {
      onMoveItem(id, type, targetFolderId);
    }
  };

  const renderTree = (parentId: string | null, level: number = 0) => {
    const currentFolders = folders.filter(f => f.parentId === parentId);
    const currentFiles = files.filter(f => f.folderId === parentId);

    return (
      <div className={`flex flex-col min-h-[4px]`}>
        {currentFolders.map(folder => (
          <div key={folder.id} className="flex flex-col">
            <div 
              draggable
              onDragStart={(e) => handleDragStart(e, folder.id, 'folder')}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (dragOverId !== folder.id) setDragOverId(folder.id);
              }}
              onDragLeave={() => setDragOverId(null)}
              onDrop={(e) => handleDrop(e, folder.id)}
              onContextMenu={(e) => handleContextMenu(e, 'folder', folder.id)}
              className={`group flex items-center px-4 py-1 cursor-pointer text-sm transition-all ${
                clipboard?.id === folder.id && clipboard.action === 'cut' ? 'opacity-40' : ''
              } ${dragOverId === folder.id ? 'bg-[#094771] shadow-[inset_0_0_0_1px_#007acc]' : 'hover:bg-[#2a2d2e]'}`}
              style={{ paddingLeft: `${level * 12 + 12}px` }}
              onClick={() => onToggleFolder(folder.id)}
            >
              <i className={`fas fa-chevron-${folder.isOpen ? 'down' : 'right'} mr-2 text-[10px] w-3 text-center opacity-60`}></i>
              <i className={`fas fa-folder${folder.isOpen ? '-open' : ''} mr-2 text-yellow-500/80`}></i>
              {editing?.id === folder.id && editing.type === 'folder' ? (
                <input
                  autoFocus
                  className="bg-[#3c3c3c] text-white flex-1 outline-none px-1 text-xs"
                  value={editing.name}
                  onChange={(e) => setEditing({...editing, name: e.target.value})}
                  onBlur={() => { onFolderRename(folder.id, editing.name); setEditing(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && (onFolderRename(folder.id, editing.name), setEditing(null))}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 truncate text-gray-400">{folder.name}</span>
              )}
            </div>
            {folder.isOpen && renderTree(folder.id, level + 1)}
          </div>
        ))}

        {currentFiles.map(file => {
          const { icon, color } = getFileTypeInfo(file.name);
          return (
            <div 
              key={file.id}
              draggable
              onDragStart={(e) => handleDragStart(e, file.id, 'file')}
              onContextMenu={(e) => handleContextMenu(e, 'file', file.id)}
              className={`group flex items-center px-4 py-1 cursor-pointer text-sm transition-colors ${
                activeFileId === file.id ? 'bg-[#37373d] text-white' : 'text-gray-400 hover:bg-[#2a2d2e]'
              } ${clipboard?.id === file.id && clipboard.action === 'cut' ? 'opacity-40' : ''}`}
              style={{ paddingLeft: `${level * 12 + 28}px` }}
              onClick={() => onFileSelect(file.id)}
            >
              <i className={`${icon} ${color} mr-2 w-4 text-center`}></i>
              {editing?.id === file.id && editing.type === 'file' ? (
                <input
                  autoFocus
                  className="bg-[#3c3c3c] text-white flex-1 outline-none px-1 text-xs"
                  value={editing.name}
                  onChange={(e) => setEditing({...editing, name: e.target.value})}
                  onBlur={() => { onFileRename(file.id, editing.name); setEditing(null); }}
                  onKeyDown={(e) => e.key === 'Enter' && (onFileRename(file.id, editing.name), setEditing(null))}
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="flex-1 truncate">{file.name}</span>
              )}
            </div>
          );
        })}

        {(isCreatingFile?.parentId === parentId || isCreatingFolder?.parentId === parentId) && (
          <form 
            onSubmit={(e) => {
                e.preventDefault();
                if (!newEntryName.trim()) return;
                if (isCreatingFile) {
                  onFileCreate(newEntryName.includes('.') ? newEntryName : `${newEntryName}.java`, isCreatingFile.parentId);
                } else {
                  onFolderCreate(newEntryName, isCreatingFolder.parentId);
                }
                setIsCreatingFile(null); setIsCreatingFolder(null); setNewEntryName('');
            }} 
            className="px-4 py-1" 
            style={{ paddingLeft: `${(level + 1) * 12 + 12}px` }}
          >
            <div className="flex items-center">
              <i className={`fas ${isCreatingFile ? 'fa-file-code text-orange-400' : 'fa-folder text-yellow-500'} mr-2 text-xs`}></i>
              <input
                autoFocus
                className="w-full bg-[#3c3c3c] text-white text-xs px-2 py-0.5 border border-blue-500 outline-none"
                value={newEntryName}
                onChange={(e) => setNewEntryName(e.target.value)}
                onBlur={() => { setIsCreatingFile(null); setIsCreatingFolder(null); setNewEntryName(''); }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </form>
        )}
      </div>
    );
  };

  return (
    <div 
      className="bg-[#252526] h-full flex flex-col select-none overflow-hidden"
      onContextMenu={(e) => handleContextMenu(e, 'root', null)}
    >
      {/* Project Selector Header */}
      <div className="bg-[#1e1e1e] p-2 relative z-50">
        <button 
          onClick={() => {
            setIsProjectDropdownOpen(!isProjectDropdownOpen);
            setIsAddingProject(false);
          }}
          className="w-full flex items-center justify-between px-3 py-1.5 bg-[#252526] hover:bg-[#333] transition-colors rounded text-xs text-gray-300 font-semibold shadow-inner"
        >
          <div className="flex items-center truncate">
            <i className="fas fa-layer-group mr-2 text-blue-500 opacity-70"></i>
            <span className="truncate">{activeProject?.name || 'Select Project'}</span>
          </div>
          <i className={`fas fa-chevron-${isProjectDropdownOpen ? 'up' : 'down'} text-[10px] ml-2 opacity-50`}></i>
        </button>

        {isProjectDropdownOpen && (
          <div className="absolute left-2 right-2 top-11 bg-[#252526] border border-[#454545] shadow-2xl rounded mt-1 overflow-hidden">
            <div className="max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-[#333]">
              {projects.map(p => (
                <div key={p.id} className={`group flex items-center justify-between px-3 py-2 text-xs cursor-pointer ${p.id === activeProjectId ? 'bg-[#094771] text-white' : 'text-gray-400 hover:bg-[#2d2d2d]'}`}>
                  <div className="flex-1 truncate" onClick={() => { onProjectSelect(p.id); setIsProjectDropdownOpen(false); }}>
                    {p.name}
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onProjectDelete(p.id); }}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-400 transition-all ml-2"
                  >
                    <i className="fas fa-trash-alt text-[10px]"></i>
                  </button>
                </div>
              ))}
            </div>
            
            {isAddingProject ? (
              <form onSubmit={handleCreateProjectSubmit} className="p-2 border-t border-[#333]">
                <input
                  autoFocus
                  className="w-full bg-[#3c3c3c] text-white text-xs px-2 py-1.5 border border-blue-500 outline-none rounded-sm mb-2"
                  placeholder="Project Name..."
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Escape' && setIsAddingProject(false)}
                />
                <div className="flex space-x-2">
                  <button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-[10px] py-1 rounded">Create</button>
                  <button type="button" onClick={() => setIsAddingProject(false)} className="flex-1 bg-[#444] hover:bg-[#555] text-white text-[10px] py-1 rounded">Cancel</button>
                </div>
              </form>
            ) : (
              <button 
                onClick={() => setIsAddingProject(true)}
                className="w-full border-t border-[#333] px-3 py-2 text-xs text-blue-400 hover:bg-[#2d2d2d] transition-colors flex items-center justify-center"
              >
                <i className="fas fa-plus mr-2"></i>
                Create Project
              </button>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex justify-between items-center border-b border-[#333]">
        <h2 className="text-[10px] font-bold uppercase tracking-widest text-gray-500">Files</h2>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => setIsSearching(!isSearching)} 
            className={`p-1 rounded text-gray-400 hover:text-white transition-colors ${isSearching ? 'bg-[#094771] text-white' : 'hover:bg-[#333]'}`}
            title="Search Project"
          >
            <i className="fas fa-search text-xs"></i>
          </button>
          <button onClick={() => { setIsCreatingFile({ parentId: null }); setIsCreatingFolder(null); }} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white" title="New File"><i className="fas fa-file-circle-plus text-xs"></i></button>
          <button onClick={() => { setIsCreatingFolder({ parentId: null }); setIsCreatingFile(null); }} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white" title="New Folder"><i className="fas fa-folder-plus text-xs"></i></button>
          <button onClick={() => fileInputRef.current?.click()} className="p-1 hover:bg-[#333] rounded text-gray-400 hover:text-white" title="Import"><i className="fas fa-file-import text-xs"></i></button>
          <input type="file" ref={fileInputRef} className="hidden" multiple accept=".java,.js,.py,.html,.css,.json,.md,.c,.cpp,.txt" onChange={(e) => e.target.files && onImportFiles(e.target.files)} />
        </div>
      </div>

      {isSearching && (
        <div className="px-4 py-3 bg-[#252526] border-b border-[#333] shadow-md animate-in slide-in-from-top duration-200">
          <div className="relative group">
            <input
              autoFocus
              type="text"
              placeholder="Search files, folders or content..."
              className="w-full bg-[#3c3c3c] text-white text-xs pl-2 pr-12 py-1.5 outline-none border border-transparent focus:border-blue-500 transition-colors rounded-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center space-x-1">
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-gray-500 hover:text-white p-1">
                   <i className="fas fa-times-circle text-[10px]"></i>
                </button>
              )}
              <button 
                onClick={() => { setIsSearching(false); setSearchQuery(''); }} 
                className="text-gray-500 hover:text-red-400 p-1"
                title="Close Search"
              >
                 <i className="fas fa-circle-xmark text-xs"></i>
              </button>
            </div>
          </div>
        </div>
      )}

      <div 
        className={`flex-1 overflow-y-auto py-2 transition-colors relative scrollbar-thin scrollbar-thumb-[#333] ${dragOverId === 'root' ? 'bg-[#094771]/10' : ''}`}
        onDragOver={(e) => { e.preventDefault(); if (dragOverId !== 'root') setDragOverId('root'); }}
        onDragLeave={() => setDragOverId(null)}
        onDrop={(e) => handleDrop(e, null)}
      >
        {isSearching && searchQuery.length >= 2 ? (
          <div className="flex flex-col space-y-1">
            {searchResults.length > 0 ? (
              searchResults.map(res => {
                const isFolder = res.type === 'folder';
                const { icon, color } = isFolder 
                  ? { icon: 'fas fa-folder', color: 'text-yellow-500' }
                  : getFileTypeInfo(res.name);
                  
                return (
                  <div key={res.id} className="flex flex-col">
                    <div 
                      onClick={() => {
                        if (isFolder) {
                          onToggleFolder(res.id);
                          setIsSearching(false);
                          setSearchQuery('');
                        } else {
                          onFileSelect(res.id);
                        }
                      }}
                      className="flex items-center px-4 py-1.5 hover:bg-[#2a2d2e] cursor-pointer group border-l-2 border-transparent hover:border-blue-500"
                    >
                      <i className={`${icon} ${color} mr-2 text-xs w-4 text-center`}></i>
                      <span className="text-xs text-gray-300 truncate font-semibold">{res.name}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-4 py-10 text-center text-gray-600 text-xs italic">
                No matching results found.
              </div>
            )}
          </div>
        ) : (
          renderTree(null)
        )}
        <div className="h-20" />
      </div>

      {menu && (
        <ContextMenu 
          x={menu.x} 
          y={menu.y} 
          type={menu.type} 
          itemId={menu.id} 
          actions={getMenuActions()} 
          onClose={() => setMenu(null)} 
        />
      )}
    </div>
  );
};

export default Sidebar;

```



<h3>**Tabs.tsx**</h3>
```typescript

import React from 'react';
import { getFileTypeInfo } from '../constants';
import { JavaFile } from '../types';

interface TabsProps {
  files: JavaFile[];
  openFileIds: string[];
  activeFileId: string;
  onSelect: (id: string) => void;
  onClose: (id: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ files, openFileIds, activeFileId, onSelect, onClose }) => {
  const openFiles = openFileIds
    .map(id => files.find(f => f.id === id))
    .filter((f): f is JavaFile => !!f);

  if (openFiles.length === 0) return null;

  return (
    <div className="flex bg-[#252526] overflow-x-auto no-scrollbar border-b border-[#1e1e1e]">
      {openFiles.map(file => {
        const isActive = file.id === activeFileId;
        const { icon, color } = getFileTypeInfo(file.name);
        
        return (
          <div
            key={file.id}
            onClick={() => onSelect(file.id)}
            className={`flex items-center min-w-[120px] max-w-[200px] h-9 px-3 cursor-pointer border-r border-[#1e1e1e] group transition-colors ${
              isActive ? 'bg-[#1e1e1e] text-white' : 'text-gray-400 hover:bg-[#2d2d2d]'
            }`}
          >
            <i className={`${icon} ${color} mr-2 text-xs flex-shrink-0`}></i>
            <span className="text-xs truncate flex-1">{file.name}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(file.id);
              }}
              className={`ml-2 p-0.5 rounded hover:bg-[#454545] opacity-0 group-hover:opacity-100 transition-opacity ${
                isActive ? 'opacity-100' : ''
              }`}
            >
              <i className="fas fa-xmark text-[10px]"></i>
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default Tabs;

```



<h3>**Terminal.tsx**</h3>
```typescript

import React from 'react';
import { ExecutionResult } from '../types';

interface TerminalProps {
  result: ExecutionResult | null;
  isRunning: boolean;
  onClear: () => void;
}

const Terminal: React.FC<TerminalProps> = ({ result, isRunning, onClear }) => {
  return (
    <div className="bg-[#1e1e1e] h-full flex flex-col overflow-hidden">
      <div className="px-4 py-2 bg-[#252526] flex justify-between items-center text-[11px] text-gray-400 border-b border-[#333] uppercase tracking-wider font-semibold select-none">
        <div className="flex items-center">
          <span className="mr-4">Terminal</span>
          {isRunning && (
            <div className="flex items-center text-blue-400 normal-case font-normal">
              <i className="fas fa-spinner fa-spin mr-2"></i>
              Execution in progress...
            </div>
          )}
        </div>
        <button 
          onClick={onClear}
          className="hover:text-white transition-colors"
          title="Clear Terminal"
        >
          <i className="fas fa-ban"></i>
        </button>
      </div>

      <div className="flex-1 p-4 font-mono text-sm overflow-y-auto whitespace-pre-wrap selection:bg-blue-900 scrollbar-thin scrollbar-thumb-[#333] scrollbar-track-transparent">
        {result ? (
          <>
            {result.stdout && (
              <div className="text-gray-200 leading-relaxed">{result.stdout}</div>
            )}
            {result.stderr && (
              <div className="text-red-400 mt-2 leading-relaxed">
                <div className="font-bold mb-1 opacity-80 uppercase text-[10px] tracking-widest border-b border-red-900/30 pb-1">Error Stream</div>
                {result.stderr}
              </div>
            )}
            <div className={`mt-6 pt-2 border-t border-[#333] text-[10px] uppercase tracking-widest font-bold ${result.exitCode === 0 ? 'text-green-500' : 'text-red-500'}`}>
              [Process completed with exit code {result.exitCode}]
            </div>
          </>
        ) : (
          <div className="text-gray-600 italic select-none">No active session output. Run a .java file to see results.</div>
        )}
      </div>
    </div>
  );
};

export default Terminal;
```



<h3>**Toolbar.tsx**</h3>
```typescript

import React from 'react';
import { JavaFile } from '../types';
import { getFileTypeInfo } from '../constants';

interface ToolbarProps {
  onRun: () => void;
  isRunning: boolean;
  activeFile: JavaFile | null;
  lastSaved?: Date | null;
}

const Toolbar: React.FC<ToolbarProps> = ({ onRun, isRunning, activeFile, lastSaved }) => {
  const fileName = activeFile?.name || '';
  const fileInfo = getFileTypeInfo(fileName);
  const isJava = fileName.toLowerCase().endsWith('.java');
  
  const formattedTime = lastSaved 
    ? lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : '';

  return (
    <div className="h-12 bg-[#2d2d2d] flex items-center justify-between px-4 border-b border-[#1e1e1e]">
      <div className="flex items-center space-x-4 overflow-hidden">
        <div className="flex items-center space-x-2 text-gray-400 overflow-hidden">
          {/* Dynamic icon based on file type */}
          <i className={`${fileInfo.icon} ${fileInfo.color} text-lg w-6 text-center flex-shrink-0`}></i>
          <span className="text-xs font-medium tracking-tight bg-[#3c3c3c] px-2 py-0.5 rounded truncate">
            {activeFile?.name || 'No file selected'}
          </span>
          {activeFile && !isJava && (
            <span className="text-[10px] text-yellow-500/50 hidden sm:inline uppercase font-bold tracking-tighter whitespace-nowrap">
              (Static File)
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center space-x-3 flex-shrink-0">
        {lastSaved && (
          <div className="flex items-center text-[10px] text-gray-500 bg-[#333] px-2 py-1 rounded-sm mr-2 select-none animate-in fade-in duration-500">
            <i className="fas fa-check-circle text-green-500/70 mr-1.5"></i>
            <span className="hidden sm:inline mr-1">Saved</span>
            <span>{formattedTime}</span>
          </div>
        )}

        <button
          onClick={onRun}
          disabled={isRunning || !activeFile || !isJava}
          title={!activeFile ? "Select a file" : (!isJava ? "Only .java files can be executed" : "Run Code")}
          className={`flex items-center space-x-2 px-4 py-1.5 rounded-sm text-sm font-semibold transition-all ${
            isRunning || !activeFile || !isJava
              ? 'bg-[#333] text-gray-500 cursor-not-allowed opacity-50' 
              : 'bg-green-600 hover:bg-green-500 text-white shadow-lg active:transform active:scale-95'
          }`}
        >
          {isRunning ? (
            <i className="fas fa-spinner fa-spin"></i>
          ) : (
            <i className="fas fa-play text-[10px]"></i>
          )}
          <span>{isRunning ? 'Running...' : 'Run Code'}</span>
        </button>
        
        <div className="h-6 w-[1px] bg-[#444] mx-2"></div>
        
        <button className="text-gray-400 hover:text-white transition-colors p-1" title="Settings">
          <i className="fas fa-cog"></i>
        </button>
      </div>
    </div>
  );
};

export default Toolbar;

```



<h3>**javaExecutionService.ts**</h3>
```typescript
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
```



<h3>**App.tsx**</h3>
```typescript
import React, { useCallback, useEffect, useState } from 'react';
import Editor from './components/Editor';
import InteractiveTerminal from './components/InteractiveTerminal';
import Sidebar from './components/Sidebar';
import Tabs from './components/Tabs';
import Toolbar from './components/Toolbar';
import { NEW_FILE_TEMPLATE, getFileTypeInfo } from './constants';
import { executeJavaCode } from './services/javaExecutionService';
import { ClipboardItem, ExecutionResult, JavaFile, JavaFolder, JavaProject } from './types';

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
    const [isLoaded, setIsLoaded] = useState(false);

    // Load project data when activeProjectId changes
    useEffect(() => {
        setIsLoaded(false);
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

    const [activeFileId, setActiveFileId] = useState<string>('');
    const [openFileIds, setOpenFileIds] = useState<string[]>([]);

    // Auto-set active file when project finishes loading
    useEffect(() => {
        if (isLoaded && files.length > 0 && !activeFileId) {
            setActiveFileId(files[0].id);
            setOpenFileIds([files[0].id]);
        }
    }, [isLoaded, files.length, activeFileId]);

    const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
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

    // Inside App.tsx

    const runCode = async () => {
        if (!activeFileId || !activeFile?.name.toLowerCase().endsWith('.java')) return;
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

    <div style={{ height: `${terminalHeight}px` }} className="flex flex-col flex-shrink-0">
    <InteractiveTerminal
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
```




<h3>**Constants.ts**</h3>
```typescript

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

```



<h3>**index.html**</h3>
```html

<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JavaCloud IDE</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<script type="importmap">
{
  "imports": {
    "react/": "https://esm.sh/react@^19.2.3/",
    "react": "https://esm.sh/react@^19.2.3",
    "react-dom/": "https://esm.sh/react-dom@^19.2.3/",
    "@google/genai": "https://esm.sh/@google/genai@^1.34.0"
  }
}
</script>
<link rel="stylesheet" href="/index.css">
</head>
<body class="bg-[#1e1e1e] text-gray-200 overflow-hidden">
    <div id="root"></div>
<script type="module" src="/index.tsx"></script>
</body>
</html>

```




<h3>**index.tsx**</h3>
```typescript

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

```



<h3>**metadata.json**</h3>
```json
{
  "name": "JavaCloud IDE",
  "description": "A professional-grade cloud-based Java development environment with integrated Monaco editor, file CRUD operations, and AI-powered code execution simulation.",
  "requestFramePermissions": []
}
```



<h3>**package.json**</h3>
```json
{
  "name": "javacloud-ide",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@google/genai": "^1.34.0",
    "@tailwindcss/vite": "^4.1.18",
    "monaco-editor": "^0.55.1",
    "react": "^19.2.3",
    "react-dom": "^19.2.3",
    "tailwindcss": "^4.1.18",
    "xterm": "^5.3.0",
    "xterm-addon-fit": "^0.8.0"
  },
  "devDependencies": {
    "@types/node": "^22.14.0",
    "@types/xterm": "^2.0.3",
    "@vitejs/plugin-react": "^5.0.0",
    "typescript": "~5.8.2",
    "vite": "^6.2.0"
  }
}

```




<h3>**tsconfig.json**</h3>
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "experimentalDecorators": true,
    "useDefineForClassFields": false,
    "module": "ESNext",
    "lib": [
      "ES2022",
      "DOM",
      "DOM.Iterable"
    ],
    "skipLibCheck": true,
    "types": [
      "node"
    ],
    "moduleResolution": "bundler",
    "isolatedModules": true,
    "moduleDetection": "force",
    "allowJs": true,
    "jsx": "react-jsx",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowImportingTsExtensions": true,
    "noEmit": true
  }
}
```



<h3>**types.ts**</h3>
```typescript

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

export type Theme = 'vs-dark' | 'light';

export interface ClipboardItem {
  type: 'file' | 'folder';
  action: 'copy' | 'cut';
  id: string;
}

```





<h3>**vite.config.json**</h3>
```typescript
import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

```