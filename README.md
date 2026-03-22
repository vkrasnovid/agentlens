# AgentLens

> Record, replay, and debug your AI agent sessions.

AgentLens captures every request and response between your AI agents and LLM APIs, stores them as structured session logs, and provides a web UI for replay and debugging.

## Architecture

```
┌─────────────┐     HTTP      ┌─────────────┐     Forward    ┌──────────────┐
│   AI Agent  │ ────────────► │   Proxy     │ ──────────────► │  LLM API     │
└─────────────┘               └─────────────┘                 └──────────────┘
                                     │ record
                                     ▼
                               ┌─────────────┐
                               │   Backend   │  FastAPI + JSONL storage
                               └─────────────┘
                                     │
                                     ▼
                               ┌─────────────┐
                               │  Frontend   │  Next.js dashboard
                               └─────────────┘
```

## Quick Start

### Using Docker Compose (backend only)
```bash
docker-compose up -d
```

### Development

**Backend:**
```bash
cd backend
source venv/bin/activate
uvicorn main:app --reload
```

**Frontend:**
```bash
cd frontend
npm run dev
```

**Proxy:**
```bash
cd proxy
pip install -r requirements.txt
python agentlens_proxy.py --name "my-session"
```

## Project Structure

```
agentlens/
├── backend/          # FastAPI backend (port 8000)
├── frontend/         # Next.js frontend (port 3000)
├── proxy/            # CLI HTTP proxy
└── docker-compose.yml
```

## API

- `GET /` — Health check
- `POST /sessions` — Create new session
- `GET /sessions` — List all sessions
- `GET /sessions/{id}` — Get session with all events
- `POST /sessions/{id}/events` — Append event to session
- `DELETE /sessions/{id}` — Delete session
