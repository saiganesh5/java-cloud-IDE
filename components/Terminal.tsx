
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






// import React, { useEffect, useRef, useState } from 'react';
// import { LogLine } from '../App';
// import { ExtendedExecutionResult } from '../services/javaExecutionService';

// interface TerminalProps {
//   history: LogLine[];
//   setHistory: React.Dispatch<React.SetStateAction<LogLine[]>>;
//   addLog: (text: string, type: LogLine['type'], prompt?: string) => void;
//   isRunning: boolean;
//   currentDirectory: string;
//   onRun: (command: string, isJavaRun: boolean) => Promise<ExtendedExecutionResult | null>;
// }

// const HISTORY_STORAGE_KEY = 'javacloud_terminal_history';

// const Terminal: React.FC<TerminalProps> = (props) => {
//   const { 
//     history, setHistory, addLog, isRunning, currentDirectory = '.', onRun
//   } = props;

//   const [inputValue, setInputValue] = useState('');
//   const [commandHistory, setCommandHistory] = useState<string[]>(() => {
//     const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
//     return saved ? JSON.parse(saved) : [];
//   });
//   const [historyIdx, setHistoryIdx] = useState(-1);

//   const scrollRef = useRef<HTMLDivElement>(null);
//   const inputRef = useRef<HTMLInputElement>(null);

//   useEffect(() => {
//     localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(commandHistory.slice(0, 50)));
//   }, [commandHistory]);

//   useEffect(() => {
//     if (scrollRef.current) {
//       scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
//     }
//   }, [history]);

//   const getPromptString = () => {
//     const dir = (currentDirectory || '.').replace(/^\.\//, '');
//     const displayDir = dir === '.' || !dir ? '~' : '~/' + dir;
//     return `user@javacloud:${displayDir}$`;
//   };

//   const handleCommand = async (cmdLine: string) => {
//     const trimmed = cmdLine.trim();
//     const prompt = getPromptString();

//     if (!trimmed) {
//       addLog('', 'command', prompt);
//       return;
//     }

//     setCommandHistory(prev => [trimmed, ...prev.filter(c => c !== trimmed)]);
//     setHistoryIdx(-1);
//     addLog(trimmed, 'command', prompt);

//     if (trimmed === 'clear') {
//       setHistory([]);
//       return;
//     }

//     if (trimmed === 'help') {
//         addLog(`JavaCloud Terminal Help:
//   This is a real bash terminal running in a Docker container (simulated via AI if backend is down).
//   You can run commands like:
//     ls, pwd, mkdir, touch, rm, cat, javac, java, etc.
  
//   Changes to the file system will sync back to the IDE explorer automatically.`, 'output');
//         return;
//     }

//     try {
//       const result = await onRun(trimmed, false);
//       if (result) {
//         if (result.stdout) addLog(result.stdout, 'output');
//         if (result.stderr) addLog(result.stderr, 'error');
//         if (result.exitCode !== 0 && result.exitCode !== undefined) {
//             addLog(`Process exited with code ${result.exitCode}`, 'error');
//         }
//       }
//     } catch (e) {
//       addLog(`Terminal error: ${(e as Error).message}`, 'error');
//     }
//   };

//   const onKeyDown = (e: React.KeyboardEvent) => {
//     if (e.key === 'Enter') {
//       const val = inputValue;
//       setInputValue('');
//       handleCommand(val);
//     } else if (e.key === 'ArrowUp') {
//       e.preventDefault();
//       const nextIdx = historyIdx + 1;
//       if (nextIdx < commandHistory.length) {
//         setHistoryIdx(nextIdx);
//         setInputValue(commandHistory[nextIdx]);
//       }
//     } else if (e.key === 'ArrowDown') {
//       e.preventDefault();
//       const nextIdx = historyIdx - 1;
//       if (nextIdx >= 0) {
//         setHistoryIdx(nextIdx);
//         setInputValue(commandHistory[nextIdx]);
//       } else {
//         setHistoryIdx(-1);
//         setInputValue('');
//       }
//     } else if (e.ctrlKey && e.key === 'l') {
//         e.preventDefault();
//         setHistory([]);
//     }
//   };

//   return (
//     <div 
//       className="bg-[#1e1e1e] h-full flex flex-col font-mono text-sm overflow-hidden border-t border-[#333] shadow-[inset_0_4px_12px_rgba(0,0,0,0.5)]"
//       onClick={() => inputRef.current?.focus()}
//     >
//       <div className="px-4 py-2 bg-[#252526] flex justify-between items-center text-[10px] text-gray-500 border-b border-[#1e1e1e] uppercase tracking-widest font-bold select-none">
//         <div className="flex items-center">
//           <i className="fas fa-terminal mr-2 text-blue-500"></i>
//           <span>Docker Bash Terminal</span>
//         </div>
//         <div className="flex items-center space-x-4">
//            {isRunning && <span className="text-blue-400 animate-pulse normal-case font-medium">Executing...</span>}
//            <button onClick={(e) => { e.stopPropagation(); setHistory([]); }} className="hover:text-white transition-colors" title="Clear (Ctrl+L)">
//              <i className="fas fa-eraser"></i>
//            </button>
//         </div>
//       </div>

//       <div className="flex-1 overflow-y-auto p-4 space-y-1 scrollbar-thin scrollbar-thumb-[#333] selection:bg-blue-500/30" ref={scrollRef}>
//         {history.map((line, i) => (
//           <div key={i} className="whitespace-pre-wrap break-all leading-relaxed">
//             {line.type === 'command' && (
//               <div className="flex">
//                 <span className="text-green-500 font-bold mr-2 whitespace-nowrap">{line.prompt}</span>
//                 <span className="text-gray-100 font-medium">{line.text}</span>
//               </div>
//             )}
//             {(line.type === 'output' || line.type === 'code-output') && <div className="text-gray-300">{line.text}</div>}
//             {line.type === 'error' && <div className="text-red-400 font-bold">{line.text}</div>}
//             {line.type === 'system' && <div className="text-blue-400 opacity-60 italic text-xs">{line.text}</div>}
//           </div>
//         ))}

//         <div className="flex items-center min-h-[1.5rem]">
//           {!isRunning && (
//             <span className="text-green-500 font-bold mr-2 whitespace-nowrap">
//               {getPromptString()}
//             </span>
//           )}
//           {!isRunning && (
//             <input
//               ref={inputRef}
//               type="text"
//               className="flex-1 bg-transparent border-none outline-none text-gray-100 p-0 font-mono"
//               value={inputValue}
//               onChange={(e) => setInputValue(e.target.value)}
//               onKeyDown={onKeyDown}
//               autoFocus
//               spellCheck={false}
//               autoComplete="off"
//             />
//           )}
//         </div>
//         <div className="h-4" />
//       </div>
//     </div>
//   );
// };

// export default Terminal;


