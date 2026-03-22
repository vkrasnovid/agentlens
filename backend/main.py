from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import aiofiles
import os
import json
from datetime import datetime
from typing import List, Optional

app = FastAPI(title="AgentLens API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SESSIONS_DIR = os.getenv("SESSIONS_DIR", "./sessions")
os.makedirs(SESSIONS_DIR, exist_ok=True)


@app.get("/")
async def root():
    return {"status": "ok", "service": "AgentLens API"}


@app.get("/health")
async def health():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.post("/sessions")
async def create_session(name: Optional[str] = None):
    session_id = datetime.utcnow().strftime("%Y%m%d_%H%M%S_%f")
    session_file = os.path.join(SESSIONS_DIR, f"{session_id}.jsonl")
    metadata = {
        "id": session_id,
        "name": name or session_id,
        "created_at": datetime.utcnow().isoformat(),
        "events": 0,
    }
    async with aiofiles.open(session_file, "w") as f:
        await f.write(json.dumps({"type": "session_start", "metadata": metadata}) + "\n")
    return metadata


@app.post("/sessions/{session_id}/events")
async def append_event(session_id: str, event: dict):
    session_file = os.path.join(SESSIONS_DIR, f"{session_id}.jsonl")
    if not os.path.exists(session_file):
        raise HTTPException(status_code=404, detail="Session not found")
    event["timestamp"] = datetime.utcnow().isoformat()
    async with aiofiles.open(session_file, "a") as f:
        await f.write(json.dumps(event) + "\n")
    return {"status": "ok"}


@app.get("/sessions")
async def list_sessions():
    sessions = []
    for fname in sorted(os.listdir(SESSIONS_DIR)):
        if fname.endswith(".jsonl"):
            fpath = os.path.join(SESSIONS_DIR, fname)
            try:
                async with aiofiles.open(fpath, "r") as f:
                    first_line = await f.readline()
                    data = json.loads(first_line)
                    sessions.append(data.get("metadata", {"id": fname[:-6]}))
            except Exception:
                sessions.append({"id": fname[:-6]})
    return sessions


@app.get("/sessions/{session_id}")
async def get_session(session_id: str):
    session_file = os.path.join(SESSIONS_DIR, f"{session_id}.jsonl")
    if not os.path.exists(session_file):
        raise HTTPException(status_code=404, detail="Session not found")
    events = []
    async with aiofiles.open(session_file, "r") as f:
        async for line in f:
            line = line.strip()
            if line:
                events.append(json.loads(line))
    return {"session_id": session_id, "events": events}


@app.delete("/sessions/{session_id}")
async def delete_session(session_id: str):
    session_file = os.path.join(SESSIONS_DIR, f"{session_id}.jsonl")
    if not os.path.exists(session_file):
        raise HTTPException(status_code=404, detail="Session not found")
    os.remove(session_file)
    return {"status": "deleted"}
