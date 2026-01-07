
import React from 'react';
import { JavaFile } from '../types';
import { getFileTypeInfo } from '../constants';

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
