import Link from 'next/link';
import EventCard from '@/components/EventCard';
import { SessionEvent } from '@/types/agentlens';

const MOCK_EVENTS: SessionEvent[] = [
  {
    type: 'session_start',
    timestamp: '2024-01-15T10:00:00.000Z',
    model: 'claude-3-5-sonnet-20241022',
    session_id: 'demo-session',
  },
  {
    type: 'api_request',
    timestamp: '2024-01-15T10:00:01.120Z',
    model: 'claude-3-5-sonnet-20241022',
    input_tokens: 1247,
    messages: [{ role: 'user', content: 'Search for recent papers on LLM reasoning and summarize the top 3.' }],
  },
  {
    type: 'tool_call',
    timestamp: '2024-01-15T10:00:02.340Z',
    tool_name: 'web_search',
    tool_input: { query: 'LLM reasoning 2024 arxiv papers', num_results: 5 },
  },
  {
    type: 'tool_result',
    timestamp: '2024-01-15T10:00:03.890Z',
    tool_name: 'web_search',
    content: '[{"title":"Chain-of-Thought Prompting Elicits Reasoning","url":"arxiv.org/..."},{"title":"ReAct: Synergizing Reasoning and Acting","url":"arxiv.org/..."},{"title":"Tree of Thoughts: Deliberate Problem Solving","url":"arxiv.org/..."}]',
  },
  {
    type: 'api_response',
    timestamp: '2024-01-15T10:00:05.210Z',
    output_tokens: 892,
    cost_usd: 0.002847,
    stop_reason: 'end_turn',
  },
  {
    type: 'api_request',
    timestamp: '2024-01-15T10:00:05.800Z',
    model: 'claude-3-5-sonnet-20241022',
    input_tokens: 2103,
  },
  {
    type: 'api_response',
    timestamp: '2024-01-15T10:00:08.450Z',
    output_tokens: 1245,
    cost_usd: 0.004123,
    stop_reason: 'end_turn',
  },
  {
    type: 'session_end',
    timestamp: '2024-01-15T10:00:08.500Z',
    total_tokens: 5487,
    total_cost_usd: 0.006970,
    duration_seconds: 8.5,
  },
];

function CodeBlock({ children }: { children: string }) {
  return (
    <div className="bg-[#0d0d15] border border-gray-800 rounded-lg px-4 py-2.5 font-mono text-sm text-gray-300">
      <span className="text-[#7c4dff] select-none mr-2">$</span>
      {children}
    </div>
  );
}

function DemoTimeline() {
  return (
    <div className="bg-[#0d0d15] border border-gray-800 rounded-2xl p-5 overflow-hidden">
      <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-800">
        <div className="w-3 h-3 rounded-full bg-[#ff5252]" />
        <div className="w-3 h-3 rounded-full bg-[#ffab40]" />
        <div className="w-3 h-3 rounded-full bg-[#00c853]" />
        <span className="ml-2 text-xs text-gray-500 font-mono">demo-session · claude-3-5-sonnet · $0.006970</span>
      </div>
      <div className="space-y-0 pointer-events-none">
        {MOCK_EVENTS.map((event, i) => (
          <EventCard
            key={i}
            event={event}
            isExpanded={false}
            onToggle={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0f]">
      {/* Nav */}
      <nav className="border-b border-gray-800 bg-[#0a0a0f]/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[#7c4dff] text-lg font-bold">●</span>
            <span className="font-bold text-white text-lg tracking-tight">AgentLens</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/vkrasnovid/agentlens"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.749 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
              </svg>
              GitHub
            </a>
            <Link
              href="/sessions"
              className="bg-[#7c4dff] text-white text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-[#6a3fe0] transition-colors"
            >
              View Sessions →
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-16 text-center">
        <div className="inline-flex items-center gap-2 bg-purple-900/20 border border-purple-700/30 rounded-full px-3 py-1 text-xs text-purple-300 mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-[#7c4dff] inline-block" />
          Open Source · MIT License
        </div>
        <h1 className="text-5xl sm:text-7xl font-extrabold text-white mb-6 leading-none tracking-tight">
          Agent<span className="text-[#7c4dff]">Lens</span>
        </h1>
        <p className="text-xl sm:text-2xl text-gray-400 mb-10 max-w-2xl mx-auto leading-relaxed">
          Record, replay, and debug your AI agent sessions.<br className="hidden sm:block" />
          Full token-level visibility into every call.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/sessions"
            className="bg-[#7c4dff] hover:bg-[#6a3fe0] text-white font-semibold px-8 py-3 rounded-xl transition-colors text-lg"
          >
            View Sessions →
          </Link>
          <a
            href="https://github.com/vkrasnovid/agentlens"
            target="_blank"
            rel="noopener noreferrer"
            className="bg-[#12121a] hover:bg-[#1a1a2e] border border-gray-700 text-gray-300 font-semibold px-8 py-3 rounded-xl transition-colors text-lg"
          >
            GitHub
          </a>
        </div>
      </section>

      {/* Quickstart */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-gray-800">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Get started in 3 steps</h2>
        <p className="text-gray-500 text-center mb-10">Drop-in proxy for Anthropic API — zero code changes.</p>
        <div className="space-y-4">
          {[
            { step: '1', label: 'Install', cmd: 'pip install agentlens' },
            { step: '2', label: 'Start the proxy', cmd: 'ANTHROPIC_BASE_URL=http://localhost:9999 agentlens start' },
            { step: '3', label: 'Run your agent', cmd: 'python my_agent.py  # your normal agent code' },
          ].map(({ step, label, cmd }) => (
            <div key={step} className="flex gap-4 items-start">
              <div className="w-8 h-8 rounded-full bg-[#7c4dff]/20 border border-[#7c4dff]/40 text-[#7c4dff] text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </div>
              <div className="flex-1">
                <p className="text-sm text-gray-400 mb-1.5">{label}</p>
                <CodeBlock>{cmd}</CodeBlock>
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-gray-500 mt-6 text-sm">
          Then open{' '}
          <Link href="/sessions" className="text-[#7c4dff] hover:underline">
            /sessions
          </Link>{' '}
          to watch the magic. ✨
        </p>
      </section>

      {/* Demo session */}
      <section className="max-w-3xl mx-auto px-4 sm:px-6 py-16 border-t border-gray-800">
        <h2 className="text-2xl font-bold text-white mb-2 text-center">Sample session replay</h2>
        <p className="text-gray-500 text-center mb-8">Every event captured — model calls, tool use, costs, tokens.</p>
        <DemoTimeline />
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16 border-t border-gray-800">
        <div className="grid sm:grid-cols-3 gap-6">
          {[
            { icon: '⏱', title: 'Timeline Replay', desc: 'Scrub through every event in your agent session chronologically.' },
            { icon: '💰', title: 'Cost Tracking', desc: 'Per-call and per-session cost breakdown down to the microdollar.' },
            { icon: '🔗', title: 'Shareable Links', desc: 'Share any session replay with a single URL. No login required.' },
          ].map(f => (
            <div key={f.title} className="bg-[#12121a] border border-gray-800 rounded-xl p-6">
              <div className="text-3xl mb-3">{f.icon}</div>
              <h3 className="font-bold text-white mb-2">{f.title}</h3>
              <p className="text-gray-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-gray-600">
          <span>AgentLens — MIT License</span>
          <a
            href="https://github.com/vkrasnovid/agentlens"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-400 transition-colors"
          >
            github.com/vkrasnovid/agentlens
          </a>
        </div>
      </footer>
    </div>
  );
}
