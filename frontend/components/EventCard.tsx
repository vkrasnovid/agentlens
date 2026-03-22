'use client';

import { SessionEvent, EventType } from '@/types/agentlens';
import CostBadge from './CostBadge';

interface EventCardProps {
  event: SessionEvent;
  isExpanded: boolean;
  onToggle: () => void;
}

const EVENT_CONFIG: Record<EventType, { label: string; color: string; dot: string }> = {
  session_start: { label: 'Session Started', color: 'bg-purple-900/40 text-purple-300 border border-purple-700/50', dot: 'bg-purple-500' },
  api_request:   { label: 'API Request',     color: 'bg-blue-900/40 text-blue-300 border border-blue-700/50',     dot: 'bg-blue-500' },
  api_response:  { label: 'API Response',    color: 'bg-green-900/40 text-green-300 border border-green-700/50',  dot: 'bg-[#00c853]' },
  tool_call:     { label: 'Tool Call',       color: 'bg-amber-900/40 text-amber-300 border border-amber-700/50',  dot: 'bg-[#ffab40]' },
  tool_result:   { label: 'Tool Result',     color: 'bg-teal-900/40 text-teal-300 border border-teal-700/50',     dot: 'bg-teal-500' },
  error:         { label: 'Error',           color: 'bg-red-900/40 text-red-300 border border-red-700/50',        dot: 'bg-[#ff5252]' },
  session_end:   { label: 'Session Ended',   color: 'bg-purple-900/40 text-purple-300 border border-purple-700/50', dot: 'bg-purple-500' },
  message:       { label: 'Message',         color: 'bg-gray-800 text-gray-300 border border-gray-700',           dot: 'bg-gray-500' },
};

function formatTime(iso: string) {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  } catch {
    return iso;
  }
}

function truncate(str: string, maxLen = 120) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen) + '…' : str;
}

function getEventSummary(event: SessionEvent): React.ReactNode {
  switch (event.type) {
    case 'api_request': {
      const model = (event.model as string) || '';
      const tokens = event.input_tokens ?? (event.usage as Record<string, number>)?.input_tokens ?? null;
      return (
        <span className="text-gray-400 text-sm">
          {model && <span className="font-mono text-blue-400 mr-2">{model}</span>}
          {tokens != null && <span>{Number(tokens).toLocaleString()} input tokens</span>}
        </span>
      );
    }
    case 'api_response': {
      const tokens = event.output_tokens ?? (event.usage as Record<string, number>)?.output_tokens ?? null;
      const cost = event.cost_usd as number ?? null;
      return (
        <span className="text-gray-400 text-sm flex items-center gap-3">
          {tokens != null && <span>{Number(tokens).toLocaleString()} output tokens</span>}
          {cost != null && <CostBadge cost={cost} />}
        </span>
      );
    }
    case 'tool_call': {
      const name = (event.tool_name as string) || (event.name as string) || '';
      const input = event.tool_input ?? event.input;
      const preview = input ? truncate(JSON.stringify(input)) : '';
      return (
        <span className="text-gray-400 text-sm">
          {name && <span className="font-mono text-amber-300 mr-2">{name}</span>}
          {preview && <span className="text-gray-500">{preview}</span>}
        </span>
      );
    }
    case 'tool_result': {
      const content = event.content ?? event.result ?? event.output;
      const preview = content ? truncate(typeof content === 'string' ? content : JSON.stringify(content)) : '';
      return <span className="text-gray-500 text-sm">{preview}</span>;
    }
    case 'error': {
      const msg = (event.message as string) || (event.error as string) || JSON.stringify(event);
      return <span className="text-[#ff5252] text-sm">{truncate(msg)}</span>;
    }
    case 'session_start': {
      const model = (event.model as string) || '';
      return model ? <span className="font-mono text-blue-400 text-sm">{model}</span> : null;
    }
    case 'session_end': {
      const tokens = event.total_tokens as number ?? null;
      const cost = event.total_cost_usd as number ?? null;
      return (
        <span className="text-gray-400 text-sm flex items-center gap-3">
          {tokens != null && <span>{Number(tokens).toLocaleString()} total tokens</span>}
          {cost != null && <CostBadge cost={cost} />}
        </span>
      );
    }
    default:
      return null;
  }
}

export default function EventCard({ event, isExpanded, onToggle }: EventCardProps) {
  const config = EVENT_CONFIG[event.type] ?? EVENT_CONFIG.message;

  return (
    <div className="flex gap-3 group/card">
      {/* Timeline dot */}
      <div className="flex flex-col items-center pt-1.5 shrink-0">
        <div className={`w-2.5 h-2.5 rounded-full ${config.dot} ring-2 ring-[#0a0a0f]`} />
        <div className="w-px flex-1 bg-gray-800 mt-1.5" />
      </div>

      {/* Card */}
      <div
        className="flex-1 mb-3 bg-[#12121a] border border-gray-800 rounded-xl overflow-hidden cursor-pointer
          hover:border-gray-600 transition-colors"
        onClick={onToggle}
      >
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full whitespace-nowrap ${config.color}`}>
            {config.label}
          </span>
          <span className="text-xs text-gray-600 font-mono">{formatTime(event.timestamp)}</span>
          <div className="flex-1 min-w-0 truncate">
            {getEventSummary(event)}
          </div>
          <span className="text-gray-600 text-xs ml-auto shrink-0">
            {isExpanded ? '▲' : '▼'}
          </span>
        </div>

        {isExpanded && (
          <div className="border-t border-gray-800 bg-[#0d0d15] px-4 py-3">
            <pre className="text-xs text-gray-300 font-mono overflow-auto max-h-96 leading-relaxed whitespace-pre-wrap break-all">
              {JSON.stringify(event, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
