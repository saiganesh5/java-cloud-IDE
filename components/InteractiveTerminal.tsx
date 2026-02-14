// import React, { useEffect, useRef } from 'react';
// import { Terminal as XTerminal } from 'xterm';
// import { FitAddon } from 'xterm-addon-fit';
// import 'xterm/css/xterm.css'; // Essential for proper rendering
// import { JavaFile } from '../types';

// interface InteractiveTerminalProps {
//   files: JavaFile[];
//   activeFileId: string;
//   isRunning: boolean;
// }

// const InteractiveTerminal: React.FC<InteractiveTerminalProps> = ({ files, activeFileId, isRunning }) => {
//   const terminalRef = useRef<HTMLDivElement>(null);
//   const xtermRef = useRef<XTerminal | null>(null);
//   const wsRef = useRef<WebSocket | null>(null);

//   // Initialize Terminal UI
//   useEffect(() => {
//     const term = new XTerminal({
//       cursorBlink: true,
//       theme: {
//         background: '#1e1e1e', // Matches your current IDE background
//         foreground: '#cccccc',
//         selectionBackground: '#264f78',
//       },
//       fontSize: 13,
//       fontFamily: "'Fira Code', monospace",
//       convertEol: true, // Ensures \n works like \r\n
//     });

//     const fitAddon = new FitAddon();
//     term.loadAddon(fitAddon);

//     if (terminalRef.current) {
//       term.open(terminalRef.current);
//       fitAddon.fit();
//       xtermRef.current = term;
//     }

//     // Capture typing from user and send to Backend System.in
//     term.onData((data) => {
//       if (wsRef.current?.readyState === WebSocket.OPEN) {
//         wsRef.current.send(data);
//       }
//     });

//     // Cleanup
//     return () => {
//       term.dispose();
//       if (wsRef.current) wsRef.current.close();
//     };
//   }, []);

//   // Handle Code Execution Trigger
//   useEffect(() => {
//     if (isRunning && activeFileId) {
//       // Clear terminal for a new run
//       xtermRef.current?.clear();
      
//       // Connect to the WebSocket endpoint we created in Spring Boot
//       const ws = new WebSocket('ws://localhost:8080/terminal');
//       wsRef.current = ws;

//       ws.onmessage = (event) => {
//         // Feed backend output directly into the xterm engine
//         xtermRef.current?.write(event.data);
//       };

//       ws.onopen = () => {
//         // Send the initial payload to trigger compilation and execution
//         const payload = {
//           files: files.map(f => ({ path: f.name, content: f.content })),
//           mainClass: files.find(f => f.id === activeFileId)?.name.replace('.java', ''),
//           input: "" // Optional for interactive mode
//         };
//         ws.send(JSON.stringify(payload));
//       };

//       ws.onclose = () => {
//         wsRef.current = null;
//       };
//     }
//   }, [isRunning, activeFileId]);

//   return (
//     <div className="bg-[#1e1e1e] h-full flex flex-col overflow-hidden">
//       <div className="px-4 py-2 bg-[#252526] flex items-center text-[11px] text-gray-400 border-b border-[#333] uppercase font-semibold">
//         <i className="fas fa-terminal mr-2 text-blue-400"></i>
//         <span>Output Terminal</span>
//       </div>
//       <div className="flex-1 p-2 overflow-hidden">
//         <div ref={terminalRef} className="h-full w-full" />
//       </div>
//     </div>
//   );
// };

// export default InteractiveTerminal;


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