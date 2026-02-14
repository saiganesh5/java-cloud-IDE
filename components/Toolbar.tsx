import { JavaFile } from "../types";
import React from "react";

interface ToolbarProps {
  onRun: () => void;
  onStop: () => void;
  isRunning: boolean;
  activeFile: JavaFile | null;
  lastSaved?: Date | null;
  terminalMode: "OUTPUT" | "BASH";
  onToggleTerminal: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  onRun,
  onStop,
  isRunning,
  activeFile,
  lastSaved,
  terminalMode,
  onToggleTerminal
}) => {
  const canRun = !isRunning && activeFile?.name.endsWith('.java');

  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-[#333] bg-[#1e1e1e] text-sm">

      {/* Run Button - disabled when running */}
      <button
        onClick={onRun}
        disabled={!canRun}
        className="bg-green-600 px-3 py-1 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isRunning ? "Running..." : "Run Code"}
      </button>

      {/* Stop Button - always visible, disabled when not running */}
      <button
        onClick={onStop}
        disabled={!isRunning}
        className="bg-red-600 px-3 py-1 rounded text-white disabled:opacity-50 disabled:cursor-not-allowed"
        title="Stop execution (sends Ctrl+C)"
      >
        Stop
      </button>

      <button
        onClick={onToggleTerminal}
        className="bg-[#333] px-3 py-1 rounded text-white"
      >
        {terminalMode === "BASH" ? "Close Terminal" : "Open Terminal"}
      </button>

      {lastSaved && (
        <span className="ml-auto text-xs text-gray-400">
          Saved at {lastSaved.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default Toolbar;
