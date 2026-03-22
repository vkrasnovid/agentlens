#!/usr/bin/env python3
"""
AgentLens Proxy — intercepts HTTP traffic between agent and LLM API,
records events to AgentLens backend.
"""
import asyncio
import json
import sys
import os
import argparse
from datetime import datetime

import aiohttp
from aiohttp import web

AGENTLENS_API = os.getenv("AGENTLENS_API", "http://localhost:8000")
TARGET_API = os.getenv("TARGET_API", "https://api.openai.com")
PROXY_PORT = int(os.getenv("PROXY_PORT", "8080"))

session_id: str | None = None


async def create_session(name: str) -> str:
    async with aiohttp.ClientSession() as client:
        resp = await client.post(f"{AGENTLENS_API}/sessions", params={"name": name})
        data = await resp.json()
        return data["id"]


async def record_event(sid: str, event: dict):
    try:
        async with aiohttp.ClientSession() as client:
            await client.post(
                f"{AGENTLENS_API}/sessions/{sid}/events",
                json=event,
            )
    except Exception as e:
        print(f"[AgentLens] Failed to record event: {e}", file=sys.stderr)


async def handle_request(request: web.Request) -> web.Response:
    global session_id
    body = await request.read()
    path = request.path
    method = request.method

    # Forward to target
    url = TARGET_API.rstrip("/") + path
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}

    request_event = {
        "type": "request",
        "method": method,
        "path": path,
        "headers": dict(headers),
        "body": body.decode("utf-8", errors="replace"),
    }

    async with aiohttp.ClientSession() as client:
        async with client.request(
            method, url, headers=headers, data=body
        ) as resp:
            resp_body = await resp.read()
            response_event = {
                "type": "response",
                "status": resp.status,
                "headers": dict(resp.headers),
                "body": resp_body.decode("utf-8", errors="replace"),
            }

    if session_id:
        await record_event(session_id, request_event)
        await record_event(session_id, response_event)

    return web.Response(
        status=resp.status,
        headers=response_event["headers"],
        body=resp_body,
    )


async def main():
    global session_id
    parser = argparse.ArgumentParser(description="AgentLens Proxy")
    parser.add_argument("--name", default=f"session-{datetime.utcnow().strftime('%Y%m%d-%H%M%S')}", help="Session name")
    parser.add_argument("--port", type=int, default=PROXY_PORT, help="Proxy port")
    parser.add_argument("--target", default=TARGET_API, help="Target API URL")
    parser.add_argument("--backend", default=AGENTLENS_API, help="AgentLens backend URL")
    args = parser.parse_args()

    session_id = await create_session(args.name)
    print(f"[AgentLens] Session created: {session_id}")
    print(f"[AgentLens] Proxying {args.target} → localhost:{args.port}")

    app = web.Application()
    app.router.add_route("*", "/{path_info:.*}", handle_request)

    runner = web.AppRunner(app)
    await runner.setup()
    site = web.TCPSite(runner, "0.0.0.0", args.port)
    await site.start()
    print(f"[AgentLens] Proxy listening on port {args.port}")
    await asyncio.Event().wait()


if __name__ == "__main__":
    asyncio.run(main())
