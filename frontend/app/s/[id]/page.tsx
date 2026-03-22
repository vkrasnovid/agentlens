'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import type { SessionDetail, SessionEvent } from '@/types/agentlens';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

const badgeConfig: Record<string, { label: string; className: string }> = {
  session_start: { label: 'SESSION START', className: 'bg-purple-900/60 text-purple-300 border border-purple-700' },
  session_end:   { label: 'SESSION END',   className: 'bg-purple-900/60 text-purple-300 border border-purple-700' },
  api_request:   { label: 'API REQUEST',   className: 'bg-blue-900/60 text-blue-300 border border-blue-700' },
  api_response:  { label: 'API RESPONSE',  className: 'bg-green-900/60 text-green-300 border border-green-700' },
  tool_call:     { label: 'TOOL CALL',     className: 'bg-amber-900/60 text-amber-300 border border-amber-700' },
  tool_result:   { label: 'TOOL RESULT',   className: 'bg-teal-900/60 text-teal-300 border border-teal-700' },
  error:         { label: 'ERROR',         className: 'bg-red-900/60 text-red-300 border border-red-700' },
  message:       { label: 'MESSAGE',       className: 'bg-gray-800 text-gray-300 border border-gray-600' },
};

function EventRow({ event, index }: { event: SessionEvent; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const badge = badgeConfig[event.type] ?? { label: event.type.toUpperCase(), className: 'bg-gray-800 text-gray-300 border border-gray-600' };

  const timeStr = event.timestamp
    ? new Date(event.timestamp).toLocaleTimeString(undefined, { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3 })
    : `+${index}`;

  // Build a clean display object (exclude verbose fields shown inline)
  const detailData: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(event)) {
    if (!['type', 'timestamp', 'content_preview'].includes(k) && v !== undefined) {
      detailData[k] = v;
    }
  }

  return (
    <div
      className={`border-b border-white/5 last:border-0 transition-colors ${expanded ? 'bg-white/[0.03]' : 'hover:bg-white/[0.02]'}`}
    >
      <button
        className="w-full text-left px-6 py-3 flex items-start gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Time */}
        <span className="text-gray-600 text-xs mt-0.5 w-28 shrink-0 font-mono">
          {timeStr}
        </span>

        {/* Badge */}
        <span className={`event-badge shrink-0 ${badge.className}`}>
          {badge.label}
        </span>

        {/* Content preview */}
        <span className="text-gray-400 text-sm flex-1 truncate font-sans text-left">
          {event.tool_name && (
            <span className="text-[#ffab40] mr-2 font-mono">{event.tool_name}</span>
          )}
          {event.model && (
            <span className="text-gray-600 mr-2 text-xs">[{event.model}]</span>
          )}
          {event.content_preview || event.error || ''}
        </span>

        {/* Right-side stats */}
        <div className="flex items-center gap-3 shrink-0">
          {event.cost_usd != null && (
            <span className="text-[#00c853] text-xs font-mono">
              ${event.cost_usd.toFixed(5)}
            </span>
          )}
          {event.total_tokens != null && (
            <span className="text-gray-600 text-xs font-mono">
              {event.total_tokens.toLocaleString()}t
            </span>
          )}
          {event.input_tokens != null && event.output_tokens == null && (
            <span className="text-gray-600 text-xs font-mono">
              {event.input_tokens.toLocaleString()}t in
            </span>
          )}
          {event.output_tokens != null && (
            <span className="text-gray-600 text-xs font-mono">
              {event.output_tokens.toLocaleString()}t out
            </span>
          )}
          <span className={`text-gray-600 text-xs transition-transform ${expanded ? 'rotate-90' : ''}`}>
            ▶
          </span>
        </div>
      </button>

      {/* Expanded JSON */}
      {expanded && (
        <div className="px-6 pb-4">
          <pre className="bg-[#0a0a0f] border border-white/10 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed">
            {JSON.stringify(detailData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function SessionPage() {
  const params = useParams();
  const id = params?.id as string;

  const [data, setData] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetch(`${API_URL}/api/sessions/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, [id]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, []);

  const totalCost = data?.metadata?.total_cost_usd
    ?? data?.events?.reduce((s, e) => s + (e.cost_usd ?? 0), 0)
    ?? 0;

  const totalTokens = data?.metadata?.total_tokens
    ?? data?.events?.reduce((s, e) => s + (e.total_tokens ?? 0), 0)
    ?? 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">
      {/* Sticky header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0f]/95 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center gap-4">
          <Link
            href="/sessions"
            className="text-gray-500 hover:text-white transition-colors text-sm shrink-0"
          >
            ← Back
          </Link>

          <span className="text-white/20">|</span>

          <span className="text-gray-400 text-sm truncate flex-1 font-mono">
            {data?.metadata?.name || id}
          </span>

          {/* Stats */}
          {!loading && !error && (
            <div className="flex items-center gap-4 shrink-0">
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600 text-xs font-sans">Cost:</span>
                <span className="text-[#00c853] text-sm font-bold">
                  ${totalCost.toFixed(5)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600 text-xs font-sans">Tokens:</span>
                <span className="text-[#7c4dff] text-sm font-bold">
                  {totalTokens.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-gray-600 text-xs font-sans">Events:</span>
                <span className="text-[#ffab40] text-sm font-bold">
                  {data?.events?.length ?? 0}
                </span>
              </div>
            </div>
          )}

          <button
            onClick={handleCopyLink}
            className="shrink-0 text-xs text-gray-500 hover:text-white border border-white/10 hover:border-white/30 px-3 py-1.5 rounded transition-colors font-sans"
          >
            {copied ? '✓ Copied' : 'Copy link'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {/* Session metadata */}
        {data?.metadata && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="bg-[#13131a] border border-white/10 rounded-xl p-4">
              <p className="text-gray-600 text-xs font-sans mb-1">Model</p>
              <p className="text-white text-sm font-bold truncate">{data.metadata.model_used || '—'}</p>
            </div>
            <div className="bg-[#13131a] border border-white/10 rounded-xl p-4">
              <p className="text-gray-600 text-xs font-sans mb-1">Duration</p>
              <p className="text-white text-sm font-bold">
                {(() => {
                  const ms = data.metadata.duration_ms ?? (data.metadata.duration_seconds ?? 0) * 1000;
                  const s = Math.round(ms / 1000);
                  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
                })()}
              </p>
            </div>
            <div className="bg-[#13131a] border border-white/10 rounded-xl p-4">
              <p className="text-gray-600 text-xs font-sans mb-1">Total cost</p>
              <p className="text-[#00c853] text-sm font-bold">${data.metadata.total_cost_usd.toFixed(5)}</p>
            </div>
            <div className="bg-[#13131a] border border-white/10 rounded-xl p-4">
              <p className="text-gray-600 text-xs font-sans mb-1">Created</p>
              <p className="text-white text-sm font-bold">
                {new Date(data.metadata.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-[#13131a] border border-white/10 rounded-xl overflow-hidden">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="px-6 py-4 border-b border-white/5 animate-pulse flex gap-3">
                <div className="h-4 w-24 bg-white/10 rounded"></div>
                <div className="h-4 w-20 bg-white/10 rounded"></div>
                <div className="h-4 flex-1 bg-white/10 rounded"></div>
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-800/50 rounded-xl p-6 text-center">
            <p className="text-red-400 font-sans text-sm mb-1">Failed to load session</p>
            <p className="text-red-600 font-mono text-xs">{error}</p>
          </div>
        )}

        {/* Timeline */}
        {!loading && !error && data && (
          <div className="bg-[#13131a] border border-white/10 rounded-xl overflow-hidden">
            {/* Timeline header */}
            <div className="flex items-center gap-3 px-6 py-3 bg-[#0d0d14] border-b border-white/10">
              <span className="text-gray-600 text-xs w-28">TIME</span>
              <span className="text-gray-600 text-xs w-28">TYPE</span>
              <span className="text-gray-600 text-xs flex-1">DETAILS</span>
              <span className="text-gray-600 text-xs">COST / TOKENS</span>
            </div>

            {data.events.length === 0 ? (
              <div className="py-16 text-center text-gray-600 font-sans text-sm">
                No events recorded in this session.
              </div>
            ) : (
              data.events.map((event, i) => (
                <EventRow key={i} event={event} index={i} />
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
