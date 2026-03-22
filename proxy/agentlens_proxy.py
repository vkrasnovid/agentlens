#!/usr/bin/env python3
"""
AgentLens Proxy v0.1.0
Intercepts Claude CLI HTTP traffic → logs JSONL events → auto-uploads on exit.

Usage:
    python agentlens_proxy.py --name "my-session" --backend http://localhost:8000
    # In another terminal:
    ANTHROPIC_BASE_URL=http://localhost:9999 claude "your prompt"
"""
import argparse
import asyncio
import json
import os
import signal
import socket
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

import aiohttp
from aiohttp import web

# ─── Config ───────────────────────────────────────────────────────────────────

PROXY_VERSION = "0.1.0"
ANTHROPIC_API = "https://api.anthropic.com"
DEFAULT_PORT = 9999
DEFAULT_BACKEND = "http://localhost:8000"
SESSIONS_DIR = Path(os.path.expanduser("~/.agentlens/sessions"))

# Model pricing: (input_per_million, output_per_million)
MODEL_PRICING = {
    "claude-3-5-sonnet": (3.0, 15.0),
    "claude-3-5-haiku": (0.25, 1.25),
    "claude-3-haiku": (0.25, 1.25),
    "claude-3-opus": (15.0, 75.0),
    "claude-3-sonnet": (3.0, 15.0),
}
DEFAULT_PRICING = (3.0, 15.0)


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


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


# ─── Session State ────────────────────────────────────────────────────────────

class ProxySession:
    def __init__(self, session_id: str, name: str, jsonl_path: Path):
        self.session_id = session_id
        self.name = name
        self.jsonl_path = jsonl_path
        self.sequence = 0
        self.total_input_tokens = 0
        self.total_output_tokens = 0
        self.total_cost_usd = 0.0
        self.total_api_requests = 0
        self.models_used: list[str] = []
        self.tool_calls_by_name: dict[str, int] = {}
        self.error_count = 0
        self.started_at = now_iso()
        self._lock = asyncio.Lock()
        self._file = open(jsonl_path, "a", encoding="utf-8")

    def next_event_id(self) -> str:
        return f"evt_{uuid.uuid4().hex[:8]}"

    async def write_event(self, event_type: str, data: dict) -> dict:
        async with self._lock:
            self.sequence += 1
            event = {
                "event_id": self.next_event_id(),
                "session_id": self.session_id,
                "timestamp": now_iso(),
                "sequence": self.sequence,
                "event_type": event_type,
                "data": data,
            }
            self._file.write(json.dumps(event, ensure_ascii=False) + "\n")
            self._file.flush()
            return event

    async def close(self):
        async with self._lock:
            if not self._file.closed:
                self._file.close()


# ─── SSE / Streaming helper ───────────────────────────────────────────────────

async def accumulate_sse(response: aiohttp.ClientResponse) -> tuple[int, dict]:
    """
    Read a streaming SSE response and reconstruct the final message object.
    Returns (status_code, assembled_body_dict).
    """
    assembled = {
        "id": None,
        "type": "message",
        "role": "assistant",
        "model": None,
        "stop_reason": None,
        "stop_sequence": None,
        "usage": {"input_tokens": 0, "output_tokens": 0},
        "content": [],
    }
    # Track content blocks being built
    content_blocks: dict[int, dict] = {}

    async for raw_line in response.content:
        line = raw_line.decode("utf-8", errors="replace").rstrip("\n\r")
        if not line.startswith("data:"):
            continue
        data_str = line[5:].strip()
        if data_str in ("", "[DONE]"):
            continue
        try:
            chunk = json.loads(data_str)
        except json.JSONDecodeError:
            continue

        ctype = chunk.get("type", "")

        if ctype == "message_start":
            msg = chunk.get("message", {})
            assembled["id"] = msg.get("id")
            assembled["model"] = msg.get("model")
            assembled["role"] = msg.get("role", "assistant")
            usage = msg.get("usage", {})
            assembled["usage"]["input_tokens"] = usage.get("input_tokens", 0)
            assembled["usage"]["output_tokens"] = usage.get("output_tokens", 0)

        elif ctype == "content_block_start":
            idx = chunk.get("index", 0)
            block = chunk.get("content_block", {})
            content_blocks[idx] = dict(block)
            if block.get("type") == "text":
                content_blocks[idx]["text"] = block.get("text", "")

        elif ctype == "content_block_delta":
            idx = chunk.get("index", 0)
            delta = chunk.get("delta", {})
            if idx not in content_blocks:
                content_blocks[idx] = {}
            if delta.get("type") == "text_delta":
                existing = content_blocks[idx].get("text", "")
                content_blocks[idx]["text"] = existing + delta.get("text", "")
            elif delta.get("type") == "input_json_delta":
                existing = content_blocks[idx].get("_input_json", "")
                content_blocks[idx]["_input_json"] = existing + delta.get("partial_json", "")

        elif ctype == "content_block_stop":
            idx = chunk.get("index", 0)
            if idx in content_blocks:
                block = content_blocks[idx]
                # Finalise tool_use input
                if block.get("type") == "tool_use" and "_input_json" in block:
                    try:
                        block["input"] = json.loads(block.pop("_input_json"))
                    except json.JSONDecodeError:
                        block["input"] = {}

        elif ctype == "message_delta":
            delta = chunk.get("delta", {})
            if delta.get("stop_reason"):
                assembled["stop_reason"] = delta["stop_reason"]
            if delta.get("stop_sequence") is not None:
                assembled["stop_sequence"] = delta["stop_sequence"]
            usage = chunk.get("usage", {})
            if usage.get("output_tokens"):
                assembled["usage"]["output_tokens"] = usage["output_tokens"]

        elif ctype == "error":
            assembled["_error"] = chunk.get("error", {})

    # Sort content blocks by index
    assembled["content"] = [content_blocks[i] for i in sorted(content_blocks.keys())]
    return response.status, assembled


# ─── Request Handler ──────────────────────────────────────────────────────────

async def handle_request(
    request: web.Request,
    proxy_session: ProxySession,
    http_client: aiohttp.ClientSession,
) -> web.Response:
    path = request.path
    if request.query_string:
        path = f"{path}?{request.query_string}"
    method = request.method
    body_bytes = await request.read()

    # Build forward headers — strip x-api-key from logs, keep for forwarding
    forward_headers: dict[str, str] = {}
    log_headers: dict[str, str] = {}
    for k, v in request.headers.items():
        kl = k.lower()
        if kl in ("host", "content-length", "transfer-encoding", "connection"):
            continue
        forward_headers[k] = v
        if kl != "x-api-key":
            log_headers[k] = v
        else:
            log_headers[k] = "***REDACTED***"

    # Parse request body
    req_body: dict = {}
    if body_bytes:
        try:
            req_body = json.loads(body_bytes)
        except Exception:
            pass

    model = req_body.get("model", "")
    messages = req_body.get("messages", [])
    is_streaming = req_body.get("stream", False)

    # Log api_request event
    await proxy_session.write_event(
        "api_request",
        {
            "method": method,
            "path": request.path,
            "headers": log_headers,
            "body": req_body,
        },
    )

    proxy_session.total_api_requests += 1
    if model and model not in proxy_session.models_used:
        proxy_session.models_used.append(model)

    # Also extract tool_result events from request
    for msg in messages:
        if isinstance(msg.get("content"), list):
            for block in msg["content"]:
                if block.get("type") == "tool_result":
                    tool_use_id = block.get("tool_use_id", "")
                    content = block.get("content", "")
                    is_error = block.get("is_error", False)
                    if isinstance(content, list):
                        content_str = " ".join(
                            b.get("text", "") for b in content if isinstance(b, dict)
                        )
                    elif isinstance(content, str):
                        content_str = content
                    else:
                        content_str = str(content)
                    await proxy_session.write_event(
                        "tool_result",
                        {
                            "tool_use_id": tool_use_id,
                            "tool_name": "",  # not always known here
                            "content": content_str,
                            "is_error": is_error,
                            "execution_time_ms": None,
                        },
                    )

    # Forward to Anthropic
    target_url = ANTHROPIC_API + request.path
    if request.query_string:
        target_url += f"?{request.query_string}"

    req_start = asyncio.get_event_loop().time()

    try:
        async with http_client.request(
            method,
            target_url,
            headers=forward_headers,
            data=body_bytes,
        ) as upstream_resp:
            status = upstream_resp.status
            resp_headers = dict(upstream_resp.headers)
            latency_ms = int((asyncio.get_event_loop().time() - req_start) * 1000)

            content_type = resp_headers.get("content-type", "")

            if is_streaming and "text/event-stream" in content_type:
                # Accumulate SSE stream
                status, assembled_body = await accumulate_sse(upstream_resp)
            else:
                resp_bytes = await upstream_resp.read()
                try:
                    assembled_body = json.loads(resp_bytes)
                except Exception:
                    assembled_body = None

    except Exception as e:
        # Proxy-level error
        await proxy_session.write_event(
            "error",
            {
                "source": "proxy",
                "message": str(e),
                "retryable": True,
            },
        )
        proxy_session.error_count += 1
        return web.Response(status=503, text=f"Proxy error: {e}")

    # Calculate cost
    cost_usd = 0.0
    in_tok = 0
    out_tok = 0
    if assembled_body and status == 200:
        usage = assembled_body.get("usage", {})
        in_tok = usage.get("input_tokens", 0) or 0
        out_tok = usage.get("output_tokens", 0) or 0
        resp_model = assembled_body.get("model", model)
        cost_usd = calculate_cost(resp_model, in_tok, out_tok)
        proxy_session.total_input_tokens += in_tok
        proxy_session.total_output_tokens += out_tok
        proxy_session.total_cost_usd += cost_usd

    # Log api_response event
    resp_log_headers = {k: v for k, v in resp_headers.items()}
    await proxy_session.write_event(
        "api_response",
        {
            "status_code": status,
            "latency_ms": latency_ms,
            "headers": resp_log_headers,
            "body": assembled_body,
            "cost_usd": round(cost_usd, 8),
        },
    )

    # Extract and log message + tool_call events from response
    if assembled_body and status == 200:
        resp_model = assembled_body.get("model", model)
        content_blocks = assembled_body.get("content", [])
        message_id = assembled_body.get("id", "")
        stop_reason = assembled_body.get("stop_reason")

        # Build text preview
        text_parts = [b.get("text", "") for b in content_blocks if b.get("type") == "text"]
        full_text = " ".join(text_parts)

        if full_text or in_tok or out_tok:
            await proxy_session.write_event(
                "message",
                {
                    "role": "assistant",
                    "model": resp_model,
                    "text": full_text[:500],  # preview
                    "input_tokens": in_tok,
                    "output_tokens": out_tok,
                    "cost_usd": round(cost_usd, 8),
                    "stop_reason": stop_reason,
                    "message_id": message_id,
                },
            )

        # Tool calls
        for block in content_blocks:
            if block.get("type") == "tool_use":
                tool_name = block.get("name", "")
                proxy_session.tool_calls_by_name[tool_name] = (
                    proxy_session.tool_calls_by_name.get(tool_name, 0) + 1
                )
                await proxy_session.write_event(
                    "tool_call",
                    {
                        "tool_use_id": block.get("id", ""),
                        "tool_name": tool_name,
                        "tool_input": block.get("input", {}),
                        "model": resp_model,
                        "message_id": message_id,
                    },
                )

    elif status != 200:
        err_body = assembled_body or {}
        err_info = err_body.get("error", {}) if isinstance(err_body, dict) else {}
        await proxy_session.write_event(
            "error",
            {
                "source": "anthropic_api",
                "status_code": status,
                "error_type": err_info.get("type", ""),
                "message": err_info.get("message", f"HTTP {status}"),
                "retryable": status in (429, 529, 503),
                "raw": err_body,
            },
        )
        proxy_session.error_count += 1

    # Reconstruct response to send back to Claude CLI
    # For streaming responses, re-encode as SSE from assembled body
    # But Claude CLI expects SSE, so we need to forward the actual stream.
    # Problem: we already consumed the stream. Reconstruct minimal SSE.
    skip_headers = {
        "content-encoding", "transfer-encoding", "connection",
        "content-length", "keep-alive",
    }
    client_headers = {
        k: v for k, v in resp_headers.items()
        if k.lower() not in skip_headers
    }

    if assembled_body is not None and is_streaming and status == 200:
        # Re-encode assembled body as a single non-streaming JSON response
        # (Claude CLI will handle this; it can accept both streaming and non-streaming)
        resp_body_bytes = json.dumps(assembled_body).encode("utf-8")
        client_headers["content-type"] = "application/json"
        return web.Response(
            status=status,
            headers=client_headers,
            body=resp_body_bytes,
        )
    elif assembled_body is not None:
        resp_body_bytes = json.dumps(assembled_body).encode("utf-8")
        client_headers["content-type"] = "application/json"
        return web.Response(
            status=status,
            headers=client_headers,
            body=resp_body_bytes,
        )
    else:
        return web.Response(status=status, headers=client_headers)


# ─── Session Lifecycle ────────────────────────────────────────────────────────

async def write_session_start(session: ProxySession):
    await session.write_event(
        "session_start",
        {
            "proxy_version": PROXY_VERSION,
            "hostname": socket.gethostname(),
            "working_directory": os.getcwd(),
            "environment": {
                "ANTHROPIC_BASE_URL": f"http://localhost:{DEFAULT_PORT}",
            },
        },
    )


async def write_session_end(session: ProxySession):
    await session.write_event(
        "session_end",
        {
            "duration_ms": None,  # will be calculated by backend
            "total_api_requests": session.total_api_requests,
            "total_input_tokens": session.total_input_tokens,
            "total_output_tokens": session.total_output_tokens,
            "total_cost_usd": round(session.total_cost_usd, 6),
            "models_used": session.models_used,
            "tool_calls_by_name": session.tool_calls_by_name,
            "error_count": session.error_count,
        },
    )
    await session.close()


async def upload_to_backend(session: ProxySession, backend_url: str) -> dict | None:
    """Upload session JSONL to the AgentLens backend."""
    if not session.jsonl_path.exists():
        print("[AgentLens] Session file not found, skipping upload", file=sys.stderr)
        return None
    try:
        with open(session.jsonl_path, "rb") as f:
            content = f.read()
        async with aiohttp.ClientSession() as client:
            form = aiohttp.FormData()
            form.add_field(
                "file",
                content,
                filename=session.jsonl_path.name,
                content_type="application/x-ndjson",
            )
            resp = await client.post(f"{backend_url}/api/sessions", data=form)
            if resp.status in (200, 201):
                data = await resp.json()
                return data
            else:
                text = await resp.text()
                print(f"[AgentLens] Upload failed {resp.status}: {text}", file=sys.stderr)
                return None
    except Exception as e:
        print(f"[AgentLens] Upload error: {e}", file=sys.stderr)
        return None


# ─── Main ─────────────────────────────────────────────────────────────────────

async def run(args):
    SESSIONS_DIR.mkdir(parents=True, exist_ok=True)

    session_id = str(uuid.uuid4())
    session_name = args.name
    jsonl_path = SESSIONS_DIR / f"{session_id}.jsonl"

    proxy_session = ProxySession(session_id, session_name, jsonl_path)

    print(f"[AgentLens] Starting proxy v{PROXY_VERSION}")
    print(f"[AgentLens] Session: {session_id}")
    print(f"[AgentLens] Name: {session_name}")
    print(f"[AgentLens] Log: {jsonl_path}")
    print(f"[AgentLens] Backend: {args.backend}")
    print(f"[AgentLens] Forwarding to: {ANTHROPIC_API}")

    await write_session_start(proxy_session)

    # Build aiohttp client session (shared for all requests)
    connector = aiohttp.TCPConnector(limit=100)
    http_client = aiohttp.ClientSession(connector=connector)

    async def handler(request: web.Request) -> web.Response:
        return await handle_request(request, proxy_session, http_client)

    web_app = web.Application(client_max_size=50 * 1024 * 1024)
    web_app.router.add_route("*", "/{path_info:.*}", handler)

    runner = web.AppRunner(web_app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", args.port)
    await site.start()

    print(f"[AgentLens] Proxy listening on port {args.port}")
    print(f"[AgentLens] Set: ANTHROPIC_BASE_URL=http://localhost:{args.port}")
    print("[AgentLens] Press Ctrl+C to stop and upload session")

    # Graceful shutdown
    stop_event = asyncio.Event()

    def handle_signal():
        stop_event.set()

    loop = asyncio.get_event_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        loop.add_signal_handler(sig, handle_signal)

    await stop_event.wait()

    print("\n[AgentLens] Stopping proxy...")
    await write_session_end(proxy_session)
    await http_client.close()
    await runner.cleanup()

    # Upload to backend
    if args.backend and args.backend.lower() != "none":
        print(f"[AgentLens] Uploading session to {args.backend}...")
        result = await upload_to_backend(proxy_session, args.backend)
        if result:
            share_url = result.get("share_url", "")
            cost = result.get("total_cost_usd", proxy_session.total_cost_usd)
            events = result.get("event_count", proxy_session.sequence)
            print(f"[AgentLens] ✓ Uploaded! {events} events, ${cost:.4f}")
            if share_url:
                print(f"[AgentLens] Share: {share_url}")
        else:
            print(f"[AgentLens] Upload failed. Session saved locally: {jsonl_path}")
    else:
        print(f"[AgentLens] Session saved locally: {jsonl_path}")

    # Summary
    print(f"\n[AgentLens] Session Summary:")
    print(f"  API requests: {proxy_session.total_api_requests}")
    print(f"  Input tokens: {proxy_session.total_input_tokens}")
    print(f"  Output tokens: {proxy_session.total_output_tokens}")
    print(f"  Total cost: ${proxy_session.total_cost_usd:.4f}")
    if proxy_session.tool_calls_by_name:
        print(f"  Tool calls: {dict(proxy_session.tool_calls_by_name)}")


def main():
    parser = argparse.ArgumentParser(
        description="AgentLens Proxy — intercept and log Claude CLI API calls"
    )
    parser.add_argument(
        "--name",
        default=f"session-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
        help="Session name (default: session-YYYYMMDD-HHMMSS)",
    )
    parser.add_argument(
        "--port",
        type=int,
        default=int(os.getenv("PROXY_PORT", str(DEFAULT_PORT))),
        help=f"Port to listen on (default: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--backend",
        default=os.getenv("AGENTLENS_BACKEND", DEFAULT_BACKEND),
        help=f"AgentLens backend URL (default: {DEFAULT_BACKEND}). Use 'none' to skip upload.",
    )
    args = parser.parse_args()
    asyncio.run(run(args))


if __name__ == "__main__":
    main()
