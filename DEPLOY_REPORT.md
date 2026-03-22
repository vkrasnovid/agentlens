# Deploy Report — AgentLens

**Date:** 2026-03-22  
**Branch:** feature/main-app  
**DevOps:** Lead (direct deploy)

## Services

| Service | URL | Status |
|---------|-----|--------|
| Frontend (Next.js) | http://localhost:3011 | ✅ Running (HTTP 200) |
| Backend (FastAPI) | http://localhost:8011 | ✅ Running |

## Health Check

```json
GET http://localhost:8011/health
{"status":"ok","version":"0.1.0","database":"ok","storage":"ok","uptime_seconds":22}
```

## How to Run

### Backend
```bash
cd /opt/agentlens/backend
source venv/bin/activate
uvicorn main:app --host 0.0.0.0 --port 8011
```

### Frontend
```bash
cd /opt/agentlens/frontend
NEXT_PUBLIC_API_URL=http://localhost:8011 npm run start -- --port 3011
```

### Via Docker (alternative)
```bash
cd /opt/agentlens
docker-compose up --build
```
(Note: docker-compose.yml uses port 8000 — update if needed)

## Notes
- Frontend already had a running instance on port 3011 prior to this deploy
- Backend started fresh on port 8011
- SQLite DB at `/opt/agentlens/backend/agentlens.db`
- Sessions stored at `/opt/agentlens/backend/sessions/`
