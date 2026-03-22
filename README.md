# AgentLens

> **Record, replay, and debug your AI agent sessions.**

[![Python](https://img.shields.io/badge/Python-3.11+-3776ab?logo=python)](https://python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688?logo=fastapi)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

AgentLens is a transparent proxy + web UI that captures every API call your AI agent makes, then lets you replay, inspect, and share the full session — complete with token counts, costs, and tool call traces.

---

## What It Does

Run your Claude CLI (or any OpenAI-compatible agent) through the AgentLens proxy, and every request/response is silently recorded to a JSONL file. When the session ends, upload it to AgentLens and get a shareable replay link where anyone can watch the agent's step-by-step reasoning, tool calls, and outputs — with a running cost counter.

No code changes to your agent required. Just set one environment variable.

---

## Features

- 🔌 **Zero-config capture** — Set `ANTHROPIC_BASE_URL=http://localhost:9999` and the proxy captures everything transparently. Your agent runs exactly as before.
- ▶️ **Timeline replay** — Scrub through every step of a session: messages, tool calls, tool results, errors. Replay at 1x, 5x, 10x, or instant speed.
- 💰 **Cost tracking** — Per-request and cumulative cost calculated from live token counts. See exactly what each agent run costs.
- 🔗 **Shareable links** — Every uploaded session gets a UUID-based public URL (`/s/<uuid>`). Share replays with your team, clients, or on social media — no account needed to view.

---

## Architecture

AgentLens is a three-tier system:

```
┌──────────────────────────────────────────────────────────────┐
│  Developer Machine                                           │
│                                                              │
│  claude CLI ──→ ANTHROPIC_BASE_URL=http://localhost:9999     │
│                              │                               │
│              ┌───────────────▼──────────────────┐            │
│              │     CLI Proxy  (Python/aiohttp)   │            │
│              │     port 9999                    │            │
│              │  Passthrough + async JSONL log   │            │
│              └───────────────┬──────────────────┘            │
│                              │                               │
│                    ┌─────────▼──────────┐                    │
│                    │  ~/.agentlens/     │                    │
│                    │  sessions/*.jsonl  │                    │
│                    └─────────┬──────────┘                    │
└──────────────────────────────┼───────────────────────────────┘
                               │ upload
                               ▼
                ┌──────────────────────────────┐
                │  Backend API  (FastAPI)       │
                │  POST/GET /api/sessions       │
                │  SQLite + filesystem JSONL    │
                └──────────────┬───────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │  Web UI  (Next.js 14)         │
                │  /sessions  — cost dashboard  │
                │  /s/:id     — timeline replay │
                └──────────────────────────────┘
```

| Tier | Role | Tech |
|------|------|------|
| **CLI Proxy** | Intercept & record API traffic | Python 3.11, aiohttp, httpx |
| **Backend API** | Store and serve sessions | FastAPI, SQLite, filesystem |
| **Web UI** | Visualize and share replays | Next.js 14, Tailwind CSS, TypeScript |

---

## Quick Start

### 1. Install the proxy

```bash
cd proxy
pip install -r requirements.txt
```

### 2. Start the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Start the frontend

```bash
cd frontend
npm install && npm run dev
```

### 4. Record a session

```bash
# Start the proxy in the background
python proxy/agentlens_proxy.py --name "my-session" &

# Run your agent through the proxy
ANTHROPIC_BASE_URL=http://localhost:9999 claude "your task"
```

When done, open [http://localhost:3000](http://localhost:3000) to view your session.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `SESSIONS_DIR` | `/data/sessions` | Directory for storing JSONL session files |
| `DATABASE_URL` | `sqlite:////data/sessions.db` | SQLite database path |
| `FRONTEND_URL` | `http://localhost:3000` | Frontend origin (for CORS) |
| `MAX_UPLOAD_SIZE_MB` | `10` | Maximum session file size |

### Frontend (`frontend/.env.local`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Backend API base URL |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` | Public frontend URL (used in share links) |

---

## API Reference

Full endpoint specification, request/response schemas, and JSONL event format:

📄 **[API_CONTRACT.md](API_CONTRACT.md)**

### Summary

```
POST   /api/sessions          Upload a new session (multipart JSONL)
GET    /api/sessions          List all sessions (paginated)
GET    /api/sessions/:id      Get session metadata + events
GET    /api/sessions/:id/raw  Download raw JSONL
DELETE /api/sessions/:id      Delete a session
GET    /health                Health check
```

---

## JSONL Session Format

Each session is stored as a `.jsonl` file where every line is a typed event:

| Event Type | Description |
|------------|-------------|
| `session_start` | Proxy startup info (hostname, working dir) |
| `api_request` | Full request sent to Anthropic API |
| `api_response` | Full response received, with latency + cost |
| `message` | Extracted assistant message (text + tokens) |
| `tool_call` | Tool invocation with name and input |
| `tool_result` | Tool output with execution time |
| `error` | Proxy, API, or tool errors |
| `session_end` | Totals: requests, tokens, cost, duration |

> **Security:** The proxy never logs `x-api-key` headers. API keys are stripped before any event is written.

---

## Deploy

### Backend → Railway

```bash
# Set environment variables in Railway dashboard:
# SESSIONS_DIR=/data/sessions
# FRONTEND_URL=https://agentlens.app

railway up
```

The backend requires a persistent volume at `/data` for SQLite + JSONL files.

### Frontend → Vercel

```bash
vercel
# Set NEXT_PUBLIC_API_URL to your Railway backend URL
```

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| CLI Proxy | Python 3.11, aiohttp (server), httpx (client), asyncio queue for non-blocking writes |
| Backend API | FastAPI, SQLAlchemy, SQLite (MVP → PostgreSQL), filesystem JSONL storage |
| Frontend | Next.js 14 App Router, TypeScript, Tailwind CSS, SWR for data fetching |

---

## Project Structure

```
agentlens/
├── proxy/
│   ├── agentlens_proxy.py    # Entry point: CLI args, lifecycle
│   ├── server.py             # aiohttp server on port 9999
│   ├── handler.py            # Passthrough + event capture (SSE-aware)
│   └── logger/               # Async JSONL writer + cost calculator
├── backend/
│   ├── main.py               # FastAPI app
│   ├── routers/sessions.py   # All /api/sessions routes
│   ├── models/               # SQLAlchemy ORM
│   ├── schemas/              # Pydantic request/response schemas
│   └── services/             # Storage + JSONL parser
└── frontend/
    ├── app/
    │   ├── sessions/         # Session list + cost dashboard
    │   └── s/[id]/           # Timeline replay page
    ├── components/timeline/  # EventCard, ToolCallCard, PlaybackControls
    └── hooks/                # useSessions, useSession, usePlayback
```

---

## License

MIT
