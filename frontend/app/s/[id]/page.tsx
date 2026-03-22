'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { SessionDetail, SessionEvent } from '@/types/agentlens';
import EventCard from '@/components/EventCard';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CostBadge from '@/components/CostBadge';
import { use } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface PageProps {
  params: Promise<{ id: string }>;
}

function ShareButton({ sessionId }: { sessionId: string }) {
  const [copied, setCopied] = useState(false);

  const handleShare = useCallback(() => {
    const url = typeof window !== 'undefined' ? window.location.href : `${API_URL}/s/${sessionId}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [sessionId]);

  return (
    <button
      onClick={handleShare}
      className="flex items-center gap-2 bg-[#12121a] hover:bg-[#1a1a2e] border border-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      {copied ? (
        <>
          <span className="text-[#00c853]">✓</span>
          <span className="text-[#00c853]">Copied!</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
          </svg>
          Share
        </>
      )}
    </button>
  );
}

function getTotalCost(events: SessionEvent[]): number {
  const endEvent = events.find(e => e.type === 'session_end');
  if (endEvent?.total_cost_usd != null) return endEvent.total_cost_usd as number;
  return events.reduce((sum, e) => {
    const cost = (e.cost_usd as number) ?? 0;
    return sum + cost;
  }, 0);
}

function getSessionModel(events: SessionEvent[]): string {
  const startEvent = events.find(e => e.type === 'session_start');
  if (startEvent?.model) return startEvent.model as string;
  const req = events.find(e => e.type === 'api_request' && e.model);
  return (req?.model as string) ?? '';
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SessionPage({ params }: PageProps) {
  const { id } = use(params);
  const [session, setSession] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedEvents, setExpandedEvents] = useState<Set<number>>(new Set());

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`${API_URL}/api/sessions/${id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setSession(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load session');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  const toggleEvent = useCallback((index: number) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const events = session?.events ?? [];
  const totalCost = getTotalCost(events);
  const model = session?.metadata?.model_used ?? getSessionModel(events);
  const firstEvent = events[0];
  const sessionDate = firstEvent?.timestamp ?? session?.metadata?.created_at ?? '';

  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-[#0a0a0f]/95 backdrop-blur-sm border-b border-gray-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/sessions"
              className="text-gray-500 hover:text-gray-300 transition-colors shrink-0 text-sm flex items-center gap-1"
            >
              ← Sessions
            </Link>
            <span className="text-gray-700 shrink-0">/</span>
            <span className="font-mono text-gray-400 text-sm truncate">{id.slice(0, 16)}…</span>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {!loading && session && (
              <>
                <span className="text-sm text-gray-500 hidden sm:block">
                  Total cost:{' '}
                  <CostBadge cost={totalCost} />
                </span>
                <ShareButton sessionId={id} />
              </>
            )}
          </div>
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {loading && (
          <>
            <div className="h-8 bg-gray-800 rounded w-64 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-800 rounded w-48 mb-8 animate-pulse" />
            <LoadingSkeleton count={5} type="event" />
          </>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-700/40 rounded-xl p-6 text-center mt-8">
            <p className="text-red-400 font-semibold mb-1">Failed to load session</p>
            <p className="text-red-500/70 text-sm">{error}</p>
            <Link href="/sessions" className="text-[#7c4dff] hover:underline text-sm mt-3 inline-block">
              ← Back to sessions
            </Link>
          </div>
        )}

        {!loading && session && (
          <>
            {/* Session meta */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-white mb-1 break-all">
                {session.metadata?.name || `Session ${id.slice(0, 8)}`}
              </h1>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
                {sessionDate && <span>{formatDate(sessionDate)}</span>}
                {model && <span className="font-mono text-blue-400">{model}</span>}
                <span>{events.length} events</span>
                <span>
                  Total cost: <CostBadge cost={totalCost} />
                </span>
              </div>
            </div>

            {/* Timeline */}
            {events.length === 0 ? (
              <div className="text-center py-16 text-gray-600">No events in this session.</div>
            ) : (
              <div className="relative">
                {events.map((event, i) => (
                  <EventCard
                    key={i}
                    event={event}
                    isExpanded={expandedEvents.has(i)}
                    onToggle={() => toggleEvent(i)}
                  />
                ))}
                {/* End cap for timeline */}
                <div className="ml-1.25 w-px h-4 bg-transparent" />
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
