'use client';

import Link from 'next/link';

const mockEvents = [
  {
    type: 'session_start',
    timestamp: '2024-01-15T10:00:00Z',
    model: 'claude-opus-4',
    content_preview: 'Session initialized',
  },
  {
    type: 'api_request',
    timestamp: '2024-01-15T10:00:01Z',
    model: 'claude-opus-4',
    input_tokens: 1024,
    content_preview: 'Analyze the codebase and identify potential improvements...',
  },
  {
    type: 'tool_call',
    timestamp: '2024-01-15T10:00:03Z',
    tool_name: 'read_file',
    content_preview: 'Reading src/main.py',
  },
  {
    type: 'tool_result',
    timestamp: '2024-01-15T10:00:03Z',
    tool_name: 'read_file',
    content_preview: '# main.py\nimport anthropic\nclient = anthropic.Anthropic()...',
  },
  {
    type: 'api_response',
    timestamp: '2024-01-15T10:00:08Z',
    model: 'claude-opus-4',
    output_tokens: 512,
    cost_usd: 0.0187,
    content_preview: 'I found 3 potential improvements in the codebase...',
  },
];

const badgeColors: Record<string, string> = {
  session_start: 'bg-purple-900 text-purple-300 border border-purple-700',
  session_end: 'bg-purple-900 text-purple-300 border border-purple-700',
  api_request: 'bg-blue-900 text-blue-300 border border-blue-700',
  api_response: 'bg-green-900 text-green-300 border border-green-700',
  tool_call: 'bg-amber-900 text-amber-300 border border-amber-700',
  tool_result: 'bg-teal-900 text-teal-300 border border-teal-700',
  error: 'bg-red-900 text-red-300 border border-red-700',
  message: 'bg-gray-800 text-gray-300 border border-gray-600',
};

const steps = [
  { num: 1, cmd: 'pip install agentlens', comment: '# Install AgentLens' },
  { num: 2, cmd: 'agentlens start --name "my-session"', comment: '# Start recording' },
  { num: 3, cmd: 'ANTHROPIC_BASE_URL=http://localhost:9999 claude "your task"', comment: '# Run your agent' },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-mono">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[#7c4dff] text-xl font-bold">⬡</span>
          <span className="text-white font-bold text-lg tracking-tight">AgentLens</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://github.com/vkrasnovid/agentlens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-400 hover:text-white transition-colors text-sm"
          >
            GitHub ↗
          </a>
          <Link
            href="/sessions"
            className="bg-[#7c4dff] hover:bg-[#6a3de8] text-white text-sm px-4 py-2 rounded transition-colors"
          >
            View Sessions →
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-[#13131a] border border-[#7c4dff]/30 rounded-full px-4 py-1.5 text-sm text-[#7c4dff] mb-8">
          <span className="w-2 h-2 rounded-full bg-[#00c853] animate-pulse"></span>
          Open Source · MIT License
        </div>

        <h1 className="text-6xl font-black text-white mb-6 leading-tight tracking-tight">
          Agent<span className="text-[#7c4dff]">Lens</span>
        </h1>

        <p className="text-2xl text-gray-300 mb-4 font-sans font-light">
          Record, replay, and debug your AI agent sessions
        </p>

        <p className="text-gray-500 max-w-2xl mx-auto mb-12 font-sans leading-relaxed">
          A transparent proxy for Anthropic API that captures every token, tool call, and cost.
          Inspect what your agent actually does — not what you think it does.
        </p>

        <div className="flex items-center justify-center gap-4 mb-20">
          <Link
            href="/sessions"
            className="bg-[#7c4dff] hover:bg-[#6a3de8] text-white font-bold px-8 py-4 rounded-lg transition-colors text-lg"
          >
            View Sessions →
          </Link>
          <a
            href="https://github.com/vkrasnovid/agentlens"
            target="_blank"
            rel="noopener noreferrer"
            className="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white font-bold px-8 py-4 rounded-lg transition-colors text-lg"
          >
            GitHub ↗
          </a>
        </div>
      </section>

      {/* Quickstart */}
      <section className="max-w-4xl mx-auto px-6 pb-20">
        <h2 className="text-2xl font-bold text-white mb-8 text-center">
          Get started in <span className="text-[#7c4dff]">3 steps</span>
        </h2>

        <div className="space-y-4">
          {steps.map((step) => (
            <div key={step.num} className="flex gap-4 items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#7c4dff]/20 border border-[#7c4dff]/40 flex items-center justify-center text-[#7c4dff] font-bold text-sm">
                {step.num}
              </div>
              <div className="flex-1 bg-[#13131a] border border-white/10 rounded-lg overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-[#0d0d14]">
                  <div className="w-3 h-3 rounded-full bg-[#ff5252]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#ffab40]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#00c853]"></div>
                  <span className="text-gray-500 text-xs ml-2">terminal</span>
                </div>
                <div className="px-4 py-3">
                  <span className="text-gray-600 text-sm">{step.comment}</span>
                  <br />
                  <span className="text-[#00c853] text-sm">$ </span>
                  <span className="text-white text-sm">{step.cmd}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Mock Timeline */}
      <section className="max-w-4xl mx-auto px-6 pb-24">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">
          Session <span className="text-[#7c4dff]">Timeline</span>
        </h2>
        <p className="text-gray-500 text-center mb-8 font-sans text-sm">
          Every event captured and visualized in real-time
        </p>

        <div className="bg-[#13131a] border border-white/10 rounded-xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-3 bg-[#0d0d14] border-b border-white/10">
            <span className="text-gray-400 text-sm">example-session · claude-opus-4</span>
            <span className="text-[#00c853] text-sm font-bold">Total: $0.0187</span>
          </div>

          {/* Events */}
          <div className="divide-y divide-white/5">
            {mockEvents.map((event, i) => (
              <div key={i} className="px-6 py-4 hover:bg-white/[0.02] transition-colors">
                <div className="flex items-start gap-3">
                  <span className="text-gray-600 text-xs mt-0.5 w-20 shrink-0 font-mono">
                    {event.timestamp ? new Date(event.timestamp).toLocaleTimeString() : '—'}
                  </span>
                  <span
                    className={`event-badge shrink-0 ${badgeColors[event.type] || 'bg-gray-800 text-gray-300'}`}
                  >
                    {event.type}
                  </span>
                  <span className="text-gray-400 text-sm flex-1 truncate font-sans">
                    {event.tool_name && (
                      <span className="text-[#ffab40] mr-2">{event.tool_name}</span>
                    )}
                    {event.content_preview}
                  </span>
                  {event.cost_usd && (
                    <span className="text-[#00c853] text-xs font-mono shrink-0">
                      ${event.cost_usd.toFixed(4)}
                    </span>
                  )}
                  {event.input_tokens && (
                    <span className="text-gray-500 text-xs font-mono shrink-0">
                      {event.input_tokens}t in
                    </span>
                  )}
                  {event.output_tokens && (
                    <span className="text-gray-500 text-xs font-mono shrink-0">
                      {event.output_tokens}t out
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="px-6 py-3 border-t border-white/10 bg-[#0d0d14] text-center">
            <Link href="/sessions" className="text-[#7c4dff] hover:text-[#9c74ff] text-sm transition-colors">
              View your real sessions →
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/10 px-6 py-8 text-center">
        <p className="text-gray-600 text-sm font-sans">
          AgentLens · Open Source ·{' '}
          <a
            href="https://github.com/vkrasnovid/agentlens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#7c4dff] hover:text-[#9c74ff] transition-colors"
          >
            GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
