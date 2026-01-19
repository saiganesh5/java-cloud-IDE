
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { JavaFile, JavaFolder, JavaProject, ClipboardItem } from '../types';
import { getFileTypeInfo } from '../constants';

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
