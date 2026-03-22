"""
AgentLens Backend API — FastAPI + SQLite + JSONL session storage
Full implementation per API_CONTRACT.md v1.0
"""
import json
import os
import sqlite3
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse, Response

# ─── Config ───────────────────────────────────────────────────────────────────

SESSIONS_DIR = Path(os.getenv("SESSIONS_DIR", "./sessions"))
SESSIONS_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = os.getenv("DB_PATH", "./agentlens.db")
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB
APP_VERSION = "0.1.0"
FRONTEND_URL = os.getenv("FRONTEND_URL", "https://agentlens.vercel.app")
API_BASE_URL = os.getenv("API_BASE_URL", "https://agentlens-api.railway.app")

START_TIME = time.time()

# Model pricing: (input_per_million, output_per_million)
MODEL_PRICING: dict[str, tuple[float, float]] = {
    "claude-3-5-sonnet": (3.0, 15.0),
    "claude-3-5-haiku": (0.25, 1.25),
    "claude-3-haiku": (0.25, 1.25),
    "claude-3-opus": (15.0, 75.0),
    "claude-3-sonnet": (3.0, 15.0),
}
DEFAULT_PRICING = (3.0, 15.0)  # default: sonnet pricing


def get_pricing(model: str) -> tuple[float, float]:
    if not model:
        return DEFAULT_PRICING
    model_lower = model.lower()
    for key, pricing in MODEL_PRICING.items():
        if key in model_lower:
            return pricing
    return DEFAULT_PRICING


def calculate_cost(model: str, input_tokens: int, output_tokens: int) -> float:
    input_price, output_price = get_pricing(model)
    return (input_tokens * input_price + output_tokens * output_price) / 1_000_000


# ─── Database ─────────────────────────────────────────────────────────────────

def get_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            name TEXT,
            created_at TEXT,
            started_at TEXT,
            ended_at TEXT,
            duration_ms INTEGER,
            hostname TEXT,
            working_directory TEXT,
            total_tokens INTEGER DEFAULT 0,
            total_input_tokens INTEGER DEFAULT 0,
            total_output_tokens INTEGER DEFAULT 0,
            total_cost_usd REAL DEFAULT 0,
            total_api_requests INTEGER DEFAULT 0,
            event_count INTEGER DEFAULT 0,
            model_used TEXT,
            models_used TEXT,
            file_size_bytes INTEGER DEFAULT 0,
            jsonl_path TEXT
        )
    """)
    conn.commit()
    conn.close()


# ─── JSONL Parsing ────────────────────────────────────────────────────────────

def parse_jsonl(content: bytes) -> tuple[list[dict], dict]:
    """Parse JSONL content into events and extracted metadata."""
    lines = content.decode("utf-8", errors="replace").splitlines()
    events = []
    errors = []
    for i, line in enumerate(lines, 1):
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            events.append(obj)
        except json.JSONDecodeError as e:
            errors.append({"line": i, "content": line, "error": str(e)})

    if errors and not events:
        raise ValueError(f"Line {errors[0]['line']}: invalid JSON object")

    # Extract metadata from events
    meta: dict[str, Any] = {
        "total_input_tokens": 0,
        "total_output_tokens": 0,
        "total_cost_usd": 0.0,
        "total_api_requests": 0,
        "event_count": len(events),
        "model_used": None,
        "models_used": [],
        "hostname": None,
        "working_directory": None,
        "started_at": None,
        "ended_at": None,
        "duration_ms": None,
    }

    models_seen: list[str] = []

    for event in events:
        etype = event.get("event_type") or event.get("type", "")
        data = event.get("data", {})
        timestamp = event.get("timestamp")

        if etype == "session_start":
            meta["started_at"] = timestamp
            meta["hostname"] = data.get("hostname")
            meta["working_directory"] = data.get("working_directory")

        elif etype == "session_end":
            meta["ended_at"] = timestamp
            end_data = data
            meta["duration_ms"] = end_data.get("duration_ms")
            if end_data.get("total_input_tokens"):
                meta["total_input_tokens"] = end_data["total_input_tokens"]
            if end_data.get("total_output_tokens"):
                meta["total_output_tokens"] = end_data["total_output_tokens"]
            if end_data.get("total_cost_usd"):
                meta["total_cost_usd"] = end_data["total_cost_usd"]
            if end_data.get("total_api_requests"):
                meta["total_api_requests"] = end_data["total_api_requests"]
            if end_data.get("models_used"):
                models_seen = list(end_data["models_used"])

        elif etype == "api_request":
            meta["total_api_requests"] += 1
            body = data.get("body", {})
            model = body.get("model", "")
            if model and model not in models_seen:
                models_seen.append(model)
            if not meta["model_used"] and model:
                meta["model_used"] = model

        elif etype == "api_response":
            body = data.get("body") or {}
            usage = body.get("usage", {})
            in_tok = usage.get("input_tokens", 0) or 0
            out_tok = usage.get("output_tokens", 0) or 0
            model = body.get("model", meta.get("model_used") or "")

            # Only accumulate if session_end didn't already provide totals
            if not meta["total_input_tokens"] and not meta["total_output_tokens"]:
                meta["total_input_tokens"] += in_tok
                meta["total_output_tokens"] += out_tok
                meta["total_cost_usd"] += calculate_cost(model, in_tok, out_tok)

            if model and model not in models_seen:
                models_seen.append(model)

        # Handle older proxy format (type field instead of event_type)
        elif etype in ("request", "response"):
            pass  # legacy, skip

    # If session_end didn't provide token totals, sum from api_response events
    if meta["total_input_tokens"] == 0 and meta["total_output_tokens"] == 0:
        for event in events:
            etype = event.get("event_type") or event.get("type", "")
            if etype == "api_response":
                data = event.get("data", {})
                body = data.get("body") or {}
                usage = body.get("usage", {})
                in_tok = usage.get("input_tokens", 0) or 0
                out_tok = usage.get("output_tokens", 0) or 0
                model = body.get("model", meta.get("model_used") or "")
                meta["total_input_tokens"] += in_tok
                meta["total_output_tokens"] += out_tok
                meta["total_cost_usd"] += calculate_cost(model, in_tok, out_tok)

    meta["total_tokens"] = meta["total_input_tokens"] + meta["total_output_tokens"]

    # Duration from timestamps if not provided
    if meta["duration_ms"] is None and meta["started_at"] and meta["ended_at"]:
        try:
            t0 = datetime.fromisoformat(meta["started_at"].replace("Z", "+00:00"))
            t1 = datetime.fromisoformat(meta["ended_at"].replace("Z", "+00:00"))
            meta["duration_ms"] = int((t1 - t0).total_seconds() * 1000)
        except Exception:
            pass

    meta["models_used"] = models_seen
    if not meta["model_used"] and models_seen:
        meta["model_used"] = models_seen[0]

    return events, meta


# ─── App ──────────────────────────────────────────────────────────────────────

app = FastAPI(title="AgentLens API", version=APP_VERSION)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "https://agentlens.vercel.app",
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:3010",
        "http://localhost:3011",
        "http://217.114.5.77:3011",
    ],
    allow_credentials=False,  # no cookies/auth, no need for credentials
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Accept"],
)


@app.on_event("startup")
async def startup():
    init_db()


# ─── Health ───────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    # Quick DB check
    db_status = "ok"
    try:
        conn = get_db()
        conn.execute("SELECT 1")
        conn.close()
    except Exception:
        db_status = "error"

    storage_status = "ok" if SESSIONS_DIR.exists() else "error"

    return {
        "status": "ok",
        "version": APP_VERSION,
        "database": db_status,
        "storage": storage_status,
        "uptime_seconds": int(time.time() - START_TIME),
    }


# ─── Sessions ─────────────────────────────────────────────────────────────────

def session_to_summary(row: sqlite3.Row) -> dict:
    models_used = []
    try:
        raw = row["models_used"]
        if raw:
            models_used = json.loads(raw)
    except Exception:
        pass

    session_id = row["id"]
    return {
        "session_id": session_id,
        "created_at": row["created_at"],
        "started_at": row["started_at"],
        "ended_at": row["ended_at"],
        "duration_ms": row["duration_ms"],
        "hostname": row["hostname"],
        "working_directory": row["working_directory"],
        "event_count": row["event_count"],
        "total_api_requests": row["total_api_requests"],
        "total_input_tokens": row["total_input_tokens"],
        "total_output_tokens": row["total_output_tokens"],
        "total_cost_usd": round(row["total_cost_usd"], 6),
        "models_used": models_used,
        "file_size_bytes": row["file_size_bytes"],
        "share_url": f"{FRONTEND_URL}/s/{session_id}",
    }


@app.post("/api/sessions", status_code=201)
async def upload_session(file: UploadFile = File(...)):
    """Upload a JSONL session file, parse events, store metadata."""
    # Content-type validation
    if file.content_type and file.content_type not in (
        "application/jsonl", "application/x-ndjson", "text/plain",
        "application/octet-stream", "application/json"
    ):
        raise HTTPException(status_code=400, detail={"error": "invalid_content_type", "message": "Expected JSONL file"})

    # Size check via Content-Length BEFORE reading to prevent memory DoS
    # Read with size limit using chunked approach
    chunks = []
    total_size = 0
    async for chunk in file:  # type: ignore[attr-defined]
        total_size += len(chunk)
        if total_size > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=413,
                detail={"error": "file_too_large", "message": "Session file exceeds maximum size of 10MB"},
            )
        chunks.append(chunk)
    content = b"".join(chunks)

    # Parse JSONL
    try:
        events, meta = parse_jsonl(content)
    except ValueError as e:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_jsonl", "message": str(e)},
        )

    if not events:
        raise HTTPException(
            status_code=400,
            detail={"error": "invalid_jsonl", "message": "Empty JSONL file"},
        )

    # Check for session_start
    event_types = {(e.get("event_type") or e.get("type", "")) for e in events}
    if "session_start" not in event_types:
        raise HTTPException(
            status_code=400,
            detail={"error": "missing_session_start", "message": "File lacks session_start event"},
        )

    # Generate session ID (use from events if present, else new UUID)
    # Always generate fresh UUID — do NOT trust attacker-controlled session_id from JSONL
    # (path traversal prevention: issue #1 from code review)
    session_id = str(uuid.uuid4())

    # Save JSONL file
    jsonl_path = SESSIONS_DIR / f"{session_id}.jsonl"
    jsonl_path.write_bytes(content)

    now = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")

    # Store in SQLite
    conn = get_db()
    try:
        conn.execute(
            """
            INSERT OR REPLACE INTO sessions
                (id, name, created_at, started_at, ended_at, duration_ms,
                 hostname, working_directory, total_tokens, total_input_tokens,
                 total_output_tokens, total_cost_usd, total_api_requests,
                 event_count, model_used, models_used, file_size_bytes, jsonl_path)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,
            (
                session_id,
                file.filename or session_id,
                now,
                meta["started_at"],
                meta["ended_at"],
                meta["duration_ms"],
                meta["hostname"],
                meta["working_directory"],
                meta["total_tokens"],
                meta["total_input_tokens"],
                meta["total_output_tokens"],
                round(meta["total_cost_usd"], 6),
                meta["total_api_requests"],
                meta["event_count"],
                meta["model_used"],
                json.dumps(meta["models_used"]),
                len(content),
                str(jsonl_path),
            ),
        )
        conn.commit()
    finally:
        conn.close()

    return JSONResponse(
        status_code=201,
        content={
            "session_id": session_id,
            "share_url": f"{FRONTEND_URL}/s/{session_id}",
            "raw_url": f"{API_BASE_URL}/api/sessions/{session_id}/raw",
            "event_count": meta["event_count"],
            "total_cost_usd": round(meta["total_cost_usd"], 6),
            "total_input_tokens": meta["total_input_tokens"],
            "total_output_tokens": meta["total_output_tokens"],
            "duration_ms": meta["duration_ms"],
            "created_at": now,
        },
    )


@app.get("/api/sessions")
async def list_sessions(
    limit: int = Query(default=20, ge=1, le=100),
    cursor: Optional[str] = Query(default=None),
    period: Optional[str] = Query(default="all"),
    model: Optional[str] = Query(default=None),
):
    """List sessions with metadata, pagination, and optional filters."""
    conn = get_db()
    try:
        where_clauses = []
        params: list[Any] = []

        # Period filter
        if period == "today":
            today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
            where_clauses.append("created_at >= ?")
            params.append(today)
        elif period == "week":
            from datetime import timedelta
            week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
            where_clauses.append("created_at >= ?")
            params.append(week_ago)

        # Model filter
        if model:
            where_clauses.append("models_used LIKE ?")
            params.append(f"%{model}%")

        # Cursor pagination
        if cursor:
            where_clauses.append("id < ?")
            params.append(cursor)

        where_sql = ("WHERE " + " AND ".join(where_clauses)) if where_clauses else ""

        rows = conn.execute(
            f"SELECT * FROM sessions {where_sql} ORDER BY created_at DESC LIMIT ?",
            params + [limit + 1],
        ).fetchall()

        has_more = len(rows) > limit
        rows = rows[:limit]

        next_cursor = rows[-1]["id"] if has_more and rows else None

        # Summary stats (matching filter, no cursor)
        summary_params = params[: len(params) - (1 if cursor else 0)]
        summary_where = where_sql
        if cursor:
            # Remove cursor clause from summary
            summary_clauses = where_clauses[:-1]
            summary_where = ("WHERE " + " AND ".join(summary_clauses)) if summary_clauses else ""
            summary_params = params[: -1] if cursor else params

        summary_row = conn.execute(
            f"""
            SELECT
                COUNT(*) as total_sessions,
                COALESCE(SUM(total_cost_usd), 0) as total_cost_usd,
                COALESCE(SUM(total_input_tokens), 0) as total_input_tokens,
                COALESCE(SUM(total_output_tokens), 0) as total_output_tokens
            FROM sessions {summary_where}
            """,
            summary_params,
        ).fetchone()

        sessions = [session_to_summary(r) for r in rows]

        return {
            "sessions": sessions,
            "summary": {
                "total_sessions": summary_row["total_sessions"],
                "total_cost_usd": round(summary_row["total_cost_usd"], 6),
                "total_input_tokens": summary_row["total_input_tokens"],
                "total_output_tokens": summary_row["total_output_tokens"],
                "period": period or "all",
            },
            "pagination": {
                "count": len(sessions),
                "has_more": has_more,
                "next_cursor": next_cursor,
            },
        }
    finally:
        conn.close()


def _validate_session_id(session_id: str) -> str:
    """Validate session_id is a safe UUID or alphanumeric ID to prevent path traversal."""
    import re
    if not re.match(r'^[a-zA-Z0-9_\-]{1,64}$', session_id):
        raise HTTPException(status_code=400, detail={"error": "invalid_session_id", "message": "Invalid session ID format"})
    # Ensure resolved path stays within sessions dir
    resolved = (SESSIONS_DIR / f"{session_id}.jsonl").resolve()
    if not str(resolved).startswith(str(SESSIONS_DIR.resolve())):
        raise HTTPException(status_code=400, detail={"error": "invalid_session_id", "message": "Invalid session ID"})
    return session_id


@app.get("/api/sessions/{session_id}")
async def get_session(session_id: str):
    session_id = _validate_session_id(session_id)
    """Get a single session with all parsed events."""
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT * FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail={
                "error": "session_not_found",
                "message": f"Session {session_id} not found",
            },
        )

    jsonl_path = Path(row["jsonl_path"])
    if not jsonl_path.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": "session_not_found", "message": f"Session {session_id} file not found"},
        )

    # Parse events from JSONL
    raw_content = jsonl_path.read_bytes()
    try:
        events, _ = parse_jsonl(raw_content)
    except Exception:
        events = []

    # Enrich events with event_id and sequence if missing
    enriched_events = []
    for i, event in enumerate(events, 1):
        enriched = dict(event)
        if "event_id" not in enriched:
            enriched["event_id"] = f"evt_{i:05d}"
        if "session_id" not in enriched:
            enriched["session_id"] = session_id
        if "sequence" not in enriched:
            enriched["sequence"] = i
        enriched_events.append(enriched)

    summary = session_to_summary(row)
    return {
        **summary,
        "raw_url": f"{API_BASE_URL}/api/sessions/{session_id}/raw",
        "events": enriched_events,
    }


@app.get("/api/sessions/{session_id}/raw")
async def get_session_raw(session_id: str):
    """Download the raw JSONL file for a session."""
    session_id = _validate_session_id(session_id)
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT jsonl_path FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()
    finally:
        conn.close()

    if not row:
        raise HTTPException(
            status_code=404,
            detail={"error": "session_not_found", "message": f"Session {session_id} not found"},
        )

    jsonl_path = Path(row["jsonl_path"])
    if not jsonl_path.exists():
        raise HTTPException(
            status_code=404,
            detail={"error": "session_not_found", "message": f"Session {session_id} file not found"},
        )

    content = jsonl_path.read_bytes()
    return Response(
        content=content,
        media_type="application/x-ndjson",
        headers={
            "Content-Disposition": f'attachment; filename="session-{session_id[:8]}.jsonl"',
        },
    )


@app.delete("/api/sessions/{session_id}")
async def delete_session(session_id: str):
    """Delete a session and its JSONL file."""
    session_id = _validate_session_id(session_id)
    conn = get_db()
    try:
        row = conn.execute(
            "SELECT jsonl_path FROM sessions WHERE id = ?", (session_id,)
        ).fetchone()

        if not row:
            raise HTTPException(
                status_code=404,
                detail={
                    "error": "session_not_found",
                    "message": f"Session {session_id} not found",
                },
            )

        # Delete file
        jsonl_path = Path(row["jsonl_path"])
        if jsonl_path.exists():
            jsonl_path.unlink()

        conn.execute("DELETE FROM sessions WHERE id = ?", (session_id,))
        conn.commit()
    finally:
        conn.close()

    return {"deleted": True, "session_id": session_id}


# ─── Legacy root ──────────────────────────────────────────────────────────────

@app.get("/")
async def root():
    return {"status": "ok", "service": "AgentLens API", "version": APP_VERSION}
