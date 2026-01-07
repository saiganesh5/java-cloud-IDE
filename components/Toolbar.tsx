
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
