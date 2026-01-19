
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
