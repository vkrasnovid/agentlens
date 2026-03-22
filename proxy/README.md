# AgentLens Proxy

A CLI HTTP proxy that intercepts traffic between your AI agent and the LLM API, recording all requests and responses to the AgentLens backend.

## Installation

```bash
pip install -r requirements.txt
```

## Usage

```bash
# Start the proxy (default: port 8080, target: OpenAI API)
python agentlens_proxy.py --name "my-agent-session"

# Custom target and port
python agentlens_proxy.py --name "gpt4-test" --port 9090 --target https://api.openai.com

# Custom backend URL
python agentlens_proxy.py --backend http://my-agentlens-server:8000
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTLENS_API` | `http://localhost:8000` | AgentLens backend URL |
| `TARGET_API` | `https://api.openai.com` | Target LLM API to proxy |
| `PROXY_PORT` | `8080` | Local proxy port |

## How It Works

1. Start the proxy — it creates a new session in AgentLens
2. Point your agent's HTTP client to `http://localhost:<port>` instead of the real API
3. All requests and responses are recorded as events in the session
4. View replays and debug in the AgentLens UI at `http://localhost:3000`

## Integration Example

```python
import openai

client = openai.OpenAI(
    base_url="http://localhost:8080/v1",  # point to proxy
    api_key="your-key",
)
```
