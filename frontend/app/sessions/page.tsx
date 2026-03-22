'use client';

import { useEffect, useState } from 'react';
import type { SessionSummary } from '@/types/agentlens';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function SkeletonCard() {
  return (
    <div className="bg-[#13131a] border border-white/10 rounded-xl p-5 animate-pulse">
      <div className="flex items-start justify-between mb-4">
        <div className="h-5 w-48 bg-white/10 rounded"></div>
        <div className="h-4 w-24 bg-white/10 rounded"></div>
      </div>
      <div className="grid grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-3">
            <div className="h-3 w-12 bg-white/10 rounded mb-2"></div>
            <div className="h-5 w-16 bg-white/10 rounded"></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/sessions`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setSessions(Array.isArray(data) ? data : data.sessions ?? []);
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message);
        setLoading(false);
      });
  }, []);

  // Calculate total spent today
  const today = new Date().toDateString();
  const todaySessions = sessions.filter(
    (s) => new Date(s.created_at).toDateString() === today
  );
  const todayTotal = todaySessions.reduce((sum, s) => sum + (s.total_cost_usd || 0), 0);
  const allTotal = sessions.reduce((sum, s) => sum + (s.total_cost_usd || 0), 0);

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-gray-500 hover:text-white transition-colors text-sm">
            ← Home
          </Link>
          <span className="text-white/20">/</span>
          <span className="text-white font-bold">Sessions</span>
        </div>
        <div className="flex items-center gap-2 text-gray-500 text-sm">
          <span className="w-2 h-2 rounded-full bg-[#00c853] animate-pulse"></span>
          Live
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-black text-white mb-1">Sessions</h1>
          <p className="text-gray-500 font-sans text-sm">All recorded AI agent sessions</p>
        </div>

        {/* Stats bar */}
        {!loading && !error && sessions.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-[#13131a] border border-white/10 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1 font-sans">Total sessions</p>
              <p className="text-2xl font-black text-white">{sessions.length}</p>
            </div>
            <div className="bg-[#13131a] border border-white/10 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1 font-sans">Spent today</p>
              <p className="text-2xl font-black text-[#00c853]">
                ${todayTotal.toFixed(4)}
              </p>
            </div>
            <div className="bg-[#13131a] border border-white/10 rounded-xl p-4">
              <p className="text-gray-500 text-xs mb-1 font-sans">All time total</p>
              <p className="text-2xl font-black text-[#7c4dff]">
                ${allTotal.toFixed(4)}
              </p>
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="space-y-4">
            {[...Array(3)].map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-800/50 rounded-xl p-6 text-center">
            <p className="text-red-400 font-sans text-sm mb-1">Failed to load sessions</p>
            <p className="text-red-600 font-mono text-xs">{error}</p>
            <p className="text-gray-500 font-sans text-xs mt-3">
              Make sure the API server is running at{' '}
              <span className="text-gray-400">{API_URL}</span>
            </p>
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && sessions.length === 0 && (
          <div className="text-center py-24 bg-[#13131a] border border-white/10 rounded-xl">
            <div className="text-5xl mb-4">⬡</div>
            <p className="text-white font-bold text-lg mb-2">No sessions yet</p>
            <p className="text-gray-500 font-sans text-sm mb-6">
              Run an agent to get started.
            </p>
            <div className="inline-block bg-[#0d0d14] border border-white/10 rounded-lg px-6 py-3 text-left">
              <p className="text-gray-600 text-xs mb-1"># Quick start</p>
              <p className="text-sm">
                <span className="text-[#00c853]">$ </span>
                <span className="text-white">agentlens start --name &quot;my-session&quot;</span>
              </p>
            </div>
          </div>
        )}

        {/* Session cards */}
        {!loading && !error && sessions.length > 0 && (
          <div className="space-y-4">
            {sessions.map((session) => (
              <Link
                key={session.id}
                href={`/s/${session.id}`}
                className="block bg-[#13131a] border border-white/10 hover:border-[#7c4dff]/40 rounded-xl p-5 transition-all hover:bg-[#16161f] group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-white font-bold group-hover:text-[#7c4dff] transition-colors">
                      {session.name || session.id}
                    </h3>
                    <p className="text-gray-600 text-xs mt-0.5 font-sans">
                      {session.id}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-gray-400 text-xs font-sans">
                      {formatDate(session.created_at)}
                    </p>
                    <p className="text-gray-600 text-xs font-sans mt-0.5">
                      {formatDuration(session.duration_seconds)}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3">
                  <div className="bg-[#0d0d14] rounded-lg p-3">
                    <p className="text-gray-600 text-xs mb-1 font-sans">Model</p>
                    <p className="text-white text-sm font-bold truncate">
                      {session.model_used || '—'}
                    </p>
                  </div>
                  <div className="bg-[#0d0d14] rounded-lg p-3">
                    <p className="text-gray-600 text-xs mb-1 font-sans">Cost</p>
                    <p className="text-[#00c853] text-sm font-bold">
                      ${(session.total_cost_usd || 0).toFixed(4)}
                    </p>
                  </div>
                  <div className="bg-[#0d0d14] rounded-lg p-3">
                    <p className="text-gray-600 text-xs mb-1 font-sans">Tokens</p>
                    <p className="text-[#7c4dff] text-sm font-bold">
                      {(session.total_tokens || 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="bg-[#0d0d14] rounded-lg p-3">
                    <p className="text-gray-600 text-xs mb-1 font-sans">Events</p>
                    <p className="text-[#ffab40] text-sm font-bold">
                      {session.event_count || 0}
                    </p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
