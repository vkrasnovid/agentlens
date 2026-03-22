interface TokenBarProps {
  inputTokens: number;
  outputTokens: number;
  className?: string;
}

export default function TokenBar({ inputTokens, outputTokens, className = '' }: TokenBarProps) {
  const total = inputTokens + outputTokens;
  if (total === 0) return null;

  const inputPct = Math.round((inputTokens / total) * 100);
  const outputPct = 100 - inputPct;

  return (
    <div className={`w-full ${className}`}>
      <div className="flex justify-between text-xs text-gray-400 mb-1">
        <span>Input: {inputTokens.toLocaleString()}</span>
        <span>Output: {outputTokens.toLocaleString()}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden bg-gray-800 flex">
        <div
          className="h-full bg-blue-500 transition-all"
          style={{ width: `${inputPct}%` }}
          title={`Input: ${inputTokens} tokens (${inputPct}%)`}
        />
        <div
          className="h-full bg-[#00c853] transition-all"
          style={{ width: `${outputPct}%` }}
          title={`Output: ${outputTokens} tokens (${outputPct}%)`}
        />
      </div>
      <div className="flex gap-3 mt-1 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-blue-500 inline-block" />
          Input
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-sm bg-[#00c853] inline-block" />
          Output
        </span>
      </div>
    </div>
  );
}
