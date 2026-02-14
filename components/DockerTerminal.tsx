import { useEffect, useRef, useMemo, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import { JavaFile, JavaFolder } from "../types";

interface Props {
  projectId: string;
  files: JavaFile[];
  folders: JavaFolder[];
  onFilesChange?: (files: { path: string; content: string }[], directories?: string[]) => void;
  runCommand?: string;
  stopSignal?: number; // Increment to send Ctrl+C
}

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

function createFilesHash(files: { path: string; content: string }[]): string {
  return files
    .map(f => `${f.path}::${f.content}`)
    .sort()
    .join("|||");
}

export default function DockerTerminal({ projectId, files, folders, onFilesChange, runCommand, stopSignal }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  const initialSyncDone = useRef(false);
  const lastSyncedHash = useRef<string>("");
  const ignoreNextSync = useRef(false);
  const syncDebounceTimer = useRef<NodeJS.Timeout | null>(null);
  const lastRunCommand = useRef<string>("");
  const pendingCommand = useRef<string | null>(null);
  const terminalReady = useRef(false);

  const onFilesChangeRef = useRef(onFilesChange);
  const runCommandRef = useRef(runCommand);

  useEffect(() => {
    onFilesChangeRef.current = onFilesChange;
  }, [onFilesChange]);

  useEffect(() => {
    runCommandRef.current = runCommand;
  }, [runCommand]);

  const filesPayload = useMemo(() => {
    return files.map(file => ({
      path: getFilePath(file, folders),
      content: file.content
    }));
  }, [files, folders]);

  // Compute folder paths for sync (including empty folders)
  const foldersPayload = useMemo(() => {
    return folders.map(folder => {
      // Build folder path
      let path = folder.name;
      let parent = folders.find(p => p.id === folder.parentId);
      while (parent) {
        path = parent.name + '/' + path;
        parent = folders.find(p => p.id === parent!.parentId);
      }
      return path;
    });
  }, [folders]);

  // Execute runCommand when it changes
  useEffect(() => {
    if (!runCommand || runCommand === lastRunCommand.current) return;
    lastRunCommand.current = runCommand;

    const socket = socketRef.current;

    // If socket not ready, queue the command
    if (!socket || socket.readyState !== WebSocket.OPEN || !terminalReady.current) {
      console.log("⏳ Queuing command (terminal not ready):", runCommand);
      pendingCommand.current = runCommand;
      return;
    }

    // Execute immediately
    console.log("🚀 Executing command:", runCommand);
    socket.send(runCommand + "\n");
  }, [runCommand]);

  // Function to execute pending command
  const executePendingCommand = () => {
    if (!pendingCommand.current) return;

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;

    console.log("🚀 Executing queued command:", pendingCommand.current);
    socket.send(pendingCommand.current + "\n");
    pendingCommand.current = null;
  };

  const lastStopSignal = useRef(0);

  // Handle stop signal - send Ctrl+C
  useEffect(() => {
    // Only send if the signal actually changed (button was clicked)
    if (stopSignal === lastStopSignal.current) return;
    lastStopSignal.current = stopSignal;

    // Skip initial render when stopSignal is 0
    if (stopSignal === 0) return;

    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.log("❌ Cannot send Ctrl+C - socket not open");
      return;
    }

    console.log("🛑 Sending Ctrl+C to stop execution");
    // ASCII 3 is Ctrl+C (ETX - End of Text)
    socket.send("\x03");
  }, [stopSignal]);

  // Debounced sync to container
  const syncToContainer = () => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return;
    if (!initialSyncDone.current) return;
    if (ignoreNextSync.current) {
      ignoreNextSync.current = false;
      return;
    }

    const currentHash = createFilesHash(filesPayload);
    if (currentHash === lastSyncedHash.current) return;

    console.log("📤 Syncing frontend changes to container...");
    socket.send(JSON.stringify({
      type: "forceSync",
      files: filesPayload,
      directories: foldersPayload
    }));
    lastSyncedHash.current = currentHash;
  };

  // Watch for file changes with debounce
  useEffect(() => {
    if (!initialSyncDone.current) return;

    if (syncDebounceTimer.current) {
      clearTimeout(syncDebounceTimer.current);
    }

    syncDebounceTimer.current = setTimeout(() => {
      syncToContainer();
    }, 1000);

    return () => {
      if (syncDebounceTimer.current) {
        clearTimeout(syncDebounceTimer.current);
      }
    };
  }, [filesPayload]);

  // Only reconnect when projectId changes
  useEffect(() => {
    if (!containerRef.current) return;

    initialSyncDone.current = false;
    lastSyncedHash.current = "";
    ignoreNextSync.current = false;
    lastRunCommand.current = "";
    pendingCommand.current = null;
    terminalReady.current = false;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      scrollback: 5000,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, Monaco, 'Courier New', monospace",
      fontSize: 13,
      letterSpacing: 0.5,
      lineHeight: 1.35,
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: 'rgba(56, 139, 253, 0.3)',
        black: '#484f58',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#39c5cf',
        white: '#c9d1d9',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#56d364',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#56d4dd',
        brightWhite: '#f0f6fc'
      }
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const socket = new WebSocket(
      `ws://localhost:8081/terminal?project=${projectId}`
    );
    socketRef.current = socket;

    socket.onmessage = (event) => {
      const data = event.data;

      if (typeof data === 'string' && data.startsWith('{')) {
        try {
          const json = JSON.parse(data);
          if (json.type === "fileChange" && json.files && onFilesChangeRef.current) {
            console.log("📁 Received", json.files.length, "files and", json.directories?.length || 0, "directories from container");
            lastSyncedHash.current = createFilesHash(json.files);
            ignoreNextSync.current = true;
            onFilesChangeRef.current(json.files, json.directories || []);
            return;
          }
        } catch {
          // Not JSON
        }
      }

      // Detect clear screen escape sequences and force proper reset
      if (typeof data === 'string' &&
        (data.includes('\x1b[H\x1b[2J') || data.includes('\x1b[2J\x1b[H') || data.includes('\x1bc'))) {
        // Clear command detected - use reset for full terminal clear
        term.reset();
        fitAddonRef.current?.fit();
        return;
      }

      term.write(data);
    };

    socket.onopen = () => {
      setConnectionStatus('connected');
      socket.send(JSON.stringify({
        type: "sync",
        files: filesPayload,
        directories: foldersPayload
      }));

      setTimeout(() => {
        initialSyncDone.current = true;
        lastSyncedHash.current = createFilesHash(filesPayload);
        terminalReady.current = true;

        // Execute any pending command
        executePendingCommand();
      }, 1500);

      setTimeout(() => {
        term.focus();
        fitAddon.fit();
      }, 100);
    };

    socket.onclose = () => {
      setConnectionStatus('disconnected');
    };

    socket.onerror = () => {
      setConnectionStatus('disconnected');
    };

    // Track current command for special handling
    let commandBuffer = "";

    term.onData((data) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(data);

        // Track command for clear detection
        if (data === "\r" || data === "\n") {
          // Enter pressed - check if command was "clear"
          const cmd = commandBuffer.trim().toLowerCase();
          if (cmd === "clear") {
            // Force xterm.js to clear properly after a small delay
            setTimeout(() => {
              term.clear();
              fitAddonRef.current?.fit();
            }, 50);
          }
          commandBuffer = "";
        } else if (data === "\x7f" || data === "\b") {
          // Backspace
          commandBuffer = commandBuffer.slice(0, -1);
        } else if (data.charCodeAt(0) >= 32) {
          // Printable character
          commandBuffer += data;
        } else if (data === "\x03") {
          // Ctrl+C - reset buffer
          commandBuffer = "";
        }
      }
    });

    term.onResize(({ cols, rows }) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });
    observer.observe(containerRef.current);
    resizeObserverRef.current = observer;

    return () => {
      terminalReady.current = false;
      if (syncDebounceTimer.current) {
        clearTimeout(syncDebounceTimer.current);
      }
      observer.disconnect();
      socket.close();
      term.dispose();
    };
  }, [projectId]);

  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>
      {/* Terminal header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '6px 12px',
        background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
        borderBottom: '1px solid #21262d',
        gap: '10px',
        flexShrink: 0,
        userSelect: 'none',
      }}>
        {/* Traffic light dots */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ff5f57', boxShadow: '0 0 4px rgba(255,95,87,0.4)' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#febc2e', boxShadow: '0 0 4px rgba(254,188,46,0.4)' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28c840', boxShadow: '0 0 4px rgba(40,200,64,0.4)' }} />
        </div>

        {/* Terminal title */}
        <div style={{
          flex: 1,
          textAlign: 'center',
          fontSize: '12px',
          color: '#8b949e',
          fontFamily: "'Inter', -apple-system, sans-serif",
          letterSpacing: '0.3px'
        }}>
          ⚡ Bash Terminal
        </div>

        {/* Connection indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: connectionStatus === 'connected' ? '#28c840' : connectionStatus === 'connecting' ? '#febc2e' : '#ff5f57',
            boxShadow: connectionStatus === 'connected'
              ? '0 0 6px rgba(40,200,64,0.6)'
              : connectionStatus === 'connecting'
                ? '0 0 6px rgba(254,188,46,0.6)'
                : '0 0 6px rgba(255,95,87,0.6)',
            animation: connectionStatus === 'connecting' ? 'term-pulse 1.5s ease-in-out infinite' : undefined
          }} />
          <span style={{ fontSize: '10px', color: '#6e7681', fontFamily: "'Inter', sans-serif" }}>
            {connectionStatus === 'connected' ? 'Connected' : connectionStatus === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      </div>

      <style>{`
        @keyframes term-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      {/* Terminal container */}
      <div
        ref={containerRef}
        style={{ flex: 1, padding: '4px 2px 0', overflow: 'hidden' }}
      />
    </div>
  );
}
