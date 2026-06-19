"""LLM service — backed by Ollama."""

import json
import os
import re
from typing import AsyncIterator

import httpx

OLLAMA_URL   = os.getenv("OLLAMA_URL",   "http://localhost:11434").rstrip("/")
OLLAMA_MODEL = os.getenv("OLLAMA_MODEL", "gemma4:31b")

_TIMEOUT = httpx.Timeout(connect=10, read=600, write=30, pool=5)

# Give the model enough room to finish its JSON response.
# num_ctx  = context window (prompt + reply)
# num_predict = max tokens to generate in the reply
_OPTIONS = {
    # gemma4:31b supports 128K context. Use 64K here to leave VRAM headroom.
    # Budget:  ~11K tokens for the repo bundle + ~1K system prompt = ~12K input
    #          + 8K output = 20K total — well within 64K.
    "num_ctx":     65536,
    "num_predict": 8192,
    "temperature": 0.2,
}


def _strip_fences(text: str) -> str:
    """Strip markdown code fences the model sometimes wraps around JSON."""
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$",          "", text)
    return text.strip()


def _payload(system: str, user_message: str, stream: bool) -> dict:
    return {
        "model": OLLAMA_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user_message},
        ],
        "stream":  stream,
        "options": _OPTIONS,
    }


async def stream_text(system: str, user_message: str) -> AsyncIterator[str]:
    """Yield text chunks from the model as they arrive (NDJSON streaming)."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        async with client.stream(
            "POST",
            f"{OLLAMA_URL}/api/chat",
            json=_payload(system, user_message, stream=True),
        ) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if not line:
                    continue
                data = json.loads(line)
                if data.get("done"):
                    # Log stop reason for debugging truncation
                    reason = data.get("done_reason", "")
                    if reason == "length":
                        yield "\n[TRUNCATED: hit token limit]"
                    break
                content = data.get("message", {}).get("content", "")
                if content:
                    yield content


async def complete_text(system: str, user_message: str) -> str:
    """Return the full model response as a single string (non-streaming)."""
    async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/chat",
            json=_payload(system, user_message, stream=False),
        )
        response.raise_for_status()
        return response.json()["message"]["content"]


async def complete_json(system: str, user_message: str) -> dict:
    """Return parsed JSON from the model, stripping any accidental code fences."""
    raw = await complete_text(system, user_message)
    return json.loads(_strip_fences(raw))
