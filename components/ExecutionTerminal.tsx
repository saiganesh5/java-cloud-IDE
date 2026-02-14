import React, { useEffect, useRef, useState, useCallback } from "react";

interface Props {
    isRunning: boolean;
    files: { path: string; content: string }[];
    mainClass: string;
    onComplete: (exitCode: number) => void;
    onFilesChanged?: (files: { path: string; content: string }[]) => void;
    stopSignal: number;
}

export default function ExecutionTerminal({
    isRunning,
    files,
    mainClass,
    onComplete,
    onFilesChanged,
    stopSignal
}: Props) {
    // Output state now stores segments with types for styling
    const [output, setOutput] = useState<{ text: string, type: 'normal' | 'error' | 'success' }[]>([]);
    const [input, setInput] = useState("");
    const [connected, setConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const outputRef = useRef<HTMLDivElement>(null);
    const lastStopSignal = useRef(0);

    // Auto-scroll output
    useEffect(() => {
        if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [output]);

    // Handle stop signal
    useEffect(() => {
        if (stopSignal > lastStopSignal.current) {
            lastStopSignal.current = stopSignal;
            console.log("🛑 ExecutionTerminal: Stop signal received, stopSignal=", stopSignal);
            if (socketRef.current?.readyState === WebSocket.OPEN) {
                console.log("🛑 ExecutionTerminal: Sending stop message to backend");
                socketRef.current.send(JSON.stringify({ type: "stop" }));
            } else {
                console.log("❌ ExecutionTerminal: Socket not open, can't send stop");
            }
        }
    }, [stopSignal]);

    // Store files/mainClass in refs to avoid re-triggering effect when they change
    const filesRef = useRef(files);
    const mainClassRef = useRef(mainClass);
    const hasStartedRef = useRef(false);

    // Update refs when props change (but don't re-run effect)
    useEffect(() => {
        filesRef.current = files;
        mainClassRef.current = mainClass;
    }, [files, mainClass]);

    // Store callbacks in refs to avoid re-triggering the WebSocket effect
    const onCompleteRef = useRef(onComplete);
    const onFilesChangedRef = useRef(onFilesChanged);
    useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
    useEffect(() => { onFilesChangedRef.current = onFilesChanged; }, [onFilesChanged]);

    // Connect and start execution when isRunning becomes true
    useEffect(() => {
        if (!isRunning) {
            hasStartedRef.current = false;
            return;
        }

        // Prevent re-execution if already started
        if (hasStartedRef.current) return;
        if (filesRef.current.length === 0) return;

        hasStartedRef.current = true;

        // Clear previous output
        setOutput([]);

        const ws = new WebSocket("ws://localhost:8080/ws/client");
        socketRef.current = ws;
        console.log("🔌 Connecting to WebSocket:", ws.url);

        ws.onopen = () => {
            setConnected(true);
            console.log("✅ WebSocket connected!");
            // Send start message with files from ref
            const startMsg = {
                type: "start",
                files: filesRef.current,
                mainClass: mainClassRef.current
            };
            console.log("📤 Sending start message:", startMsg);
            ws.send(JSON.stringify(startMsg));
        };

        ws.onmessage = (event) => {
            console.log("📩 Received message:", event.data);
            const msg = JSON.parse(event.data);

            switch (msg.type) {
                case "output":
                    console.log("📝 Output:", msg.data);
                    setOutput(prev => [...prev, { text: msg.data, type: 'normal' }]);
                    break;
                case "error":
                    console.log("❌ Error:", msg.data);
                    setOutput(prev => [...prev, { text: `\n❌ Error: ${msg.data}\n`, type: 'error' }]);
                    break;
                case "files":
                    // Sync files back to IDE
                    if (onFilesChangedRef.current && msg.files) {
                        onFilesChangedRef.current(msg.files);
                    }
                    break;
                case "exit":
                    console.log("🏁 Exit code:", msg.code);
                    setOutput(prev => [...prev, { text: `\n\n ...Process exited with code ${msg.code}\n`, type: 'success' }]);
                    onCompleteRef.current(msg.code);
                    break;
            }
        };

        ws.onclose = () => {
            console.log("🔌 WebSocket closed");
            setConnected(false);
            // Reset running state when connection closes
            onCompleteRef.current(0);
        };

        ws.onerror = (err) => {
            console.error("❌ WebSocket error:", err);
            setOutput(prev => [...prev, { text: "\n❌ WebSocket connection failed. Is the backend running?\n", type: 'error' }]);
            onCompleteRef.current(1);
        };

        return () => {
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "stop" }));
                ws.close();
            }
        };
    }, [isRunning]);

    // Send input to process
    const handleSubmitInput = useCallback(() => {
        if (!input.trim() || !socketRef.current) return;

        const socket = socketRef.current;
        if (socket.readyState === WebSocket.OPEN) {
            // Send to process (don't echo - program output will show naturally)
            socket.send(JSON.stringify({
                type: "input",
                data: input + "\n"
            }));
            setInput("");
        }
    }, [input]);

    // Handle Enter key
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            e.preventDefault();
            handleSubmitInput();
        }
    };

    // Loading phase text
    const [loadingPhase, setLoadingPhase] = useState(0);
    const loadingMessages = [
        "Connecting to server...",
        "Compiling your code...",
        "Starting execution...",
    ];

    useEffect(() => {
        if (!isRunning || output.length > 0) return;
        const interval = setInterval(() => {
            setLoadingPhase(prev => (prev + 1) % loadingMessages.length);
        }, 2000);
        return () => clearInterval(interval);
    }, [isRunning, output]);

    // Reset loading phase when starting a new run
    useEffect(() => {
        if (isRunning) setLoadingPhase(0);
    }, [isRunning]);

    return (
        <div className="flex flex-col h-full bg-[#1e1e1e] text-white font-mono text-sm relative">
            {/* Clear button */}
            {output.length > 0 && (
                <button
                    onClick={() => setOutput([])}
                    className="absolute top-3 right-4 p-2 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-md transition-all z-10 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    title="Clear Output"
                    style={{ opacity: 1 }} // Force visible for now, or use group-hover logic if 'group' class added
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18"></path>
                        <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                        <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    </svg>
                </button>
            )}
            {/* Inline keyframes */}
            <style>{`
                @keyframes exec-spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes exec-pulse {
                    0%, 80%, 100% { opacity: 0.3; transform: scale(0.8); }
                    40% { opacity: 1; transform: scale(1); }
                }
                @keyframes exec-fade-in {
                    from { opacity: 0; transform: translateY(6px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>

            {/* Output area */}
            <div
                ref={outputRef}
                className="flex-1 overflow-auto p-3 whitespace-pre-wrap"
                style={{ minHeight: 0 }}
            >
                {output.length > 0 ? (
                    output.map((seg, i) => (
                        <span key={i} style={{
                            color: seg.type === 'error' ? '#ff5f57' :
                                seg.type === 'success' ? '#28c840' : 'inherit'
                        }}>
                            {seg.text}
                        </span>
                    ))
                ) : isRunning ? (
                    <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        gap: '16px',
                        animation: 'exec-fade-in 0.3s ease-out'
                    }}>
                        {/* Spinner */}
                        <div style={{
                            width: '32px',
                            height: '32px',
                            border: '3px solid rgba(96, 165, 250, 0.2)',
                            borderTop: '3px solid #60a5fa',
                            borderRadius: '50%',
                            animation: 'exec-spin 0.8s linear infinite'
                        }} />

                        {/* Phase message */}
                        <div style={{
                            color: '#a0aec0',
                            fontSize: '13px',
                            letterSpacing: '0.5px',
                            animation: 'exec-fade-in 0.3s ease-out',
                        }}
                            key={loadingPhase}
                        >
                            {loadingMessages[loadingPhase]}
                        </div>

                        {/* Pulsing dots */}
                        <div style={{ display: 'flex', gap: '6px' }}>
                            {[0, 1, 2].map(i => (
                                <div key={i} style={{
                                    width: '6px',
                                    height: '6px',
                                    borderRadius: '50%',
                                    backgroundColor: '#60a5fa',
                                    animation: `exec-pulse 1.2s ease-in-out ${i * 0.2}s infinite`
                                }} />
                            ))}
                        </div>
                    </div>
                ) : (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        height: '100%',
                        color: 'green',
                        fontSize: '15px',
                        fontWeight: 'bold'
                    }}>
                        Click 'Run Code' to execute
                    </div>
                )}
            </div>

            {/* Input area - only show when connected */}
            {connected && (
                <div className="flex border-t border-[#333] p-2 gap-2">
                    <span className="text-green-400">&gt;</span>
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Type input and press Enter..."
                        className="flex-1 bg-transparent outline-none text-white"
                        autoFocus
                    />
                    <button
                        onClick={handleSubmitInput}
                        className="px-3 py-1 bg-blue-600 rounded text-xs"
                    >
                        Send
                    </button>
                </div>
            )}
        </div>
    );
}
