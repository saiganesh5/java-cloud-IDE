interface Props {
  result: any;
  isRunning: boolean;
}

export default function OutputTerminal({ result, isRunning }: Props) {
  return (
    <div className="bg-[#111] text-gray-200 h-full p-3 overflow-auto font-mono text-sm">
      {isRunning && <div>Running...</div>}
      {!isRunning && result && (
        <pre>
          {result.stdout}
          {result.stderr && `\n${result.stderr}`}
        </pre>
      )}
      {!isRunning && !result && <div>No output</div>}
    </div>
  );
}
