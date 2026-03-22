import Link from 'next/link';
import { SessionSummary } from '@/types/agentlens';
import CostBadge from './CostBadge';
import TokenBar from './TokenBar';

interface SessionCardProps {
  session: SessionSummary;
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return `${m}m ${s}s`;
}

export default function SessionCard({ session }: SessionCardProps) {
  const inputTokens = Math.round(session.total_tokens * 0.7);
  const outputTokens = session.total_tokens - inputTokens;

  return (
    <Link href={`/s/${session.id}`} className="block group">
      <div className="bg-[#12121a] border border-gray-800 rounded-xl p-5 transition-all hover:border-[#7c4dff] hover:shadow-lg hover:shadow-purple-900/20">
        <div className="flex justify-between items-start mb-2">
          <h3 className="font-semibold text-white text-lg truncate max-w-[60%] group-hover:text-[#7c4dff] transition-colors">
            {session.name || `Session ${session.id.slice(0, 8)}`}
          </h3>
          <CostBadge cost={session.total_cost_usd} />
        </div>

        <div className="text-xs text-gray-500 mb-3 flex flex-wrap gap-x-3 gap-y-1">
          <span>{formatDate(session.created_at)}</span>
          <span className="text-gray-600">·</span>
          <span className="font-mono text-blue-400">{session.model_used || 'unknown model'}</span>
          <span className="text-gray-600">·</span>
          <span>{formatDuration(session.duration_seconds)}</span>
        </div>

        <TokenBar inputTokens={inputTokens} outputTokens={outputTokens} className="mb-3" />

        <div className="flex flex-wrap gap-4 text-xs text-gray-400">
          <span>{session.total_tokens.toLocaleString()} tokens</span>
          <span>{session.event_count} events</span>
        </div>
      </div>
    </Link>
  );
}
