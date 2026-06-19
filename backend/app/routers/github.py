"""Fetch source code from GitHub URLs and return it ready for analysis."""

import asyncio
import os
import re
from pathlib import PurePosixPath
from urllib.parse import urlparse

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from app.prompts.repo_prompt import REPO_ANALYZER_SYSTEM_PROMPT
from app.schemas.requests import GithubFetchRequest
from app.services.claude import stream_text

router = APIRouter()

_GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")

_EXT_TO_LANG: dict[str, str] = {
    ".py": "python", ".js": "javascript", ".jsx": "javascript",
    ".ts": "typescript", ".tsx": "typescript", ".java": "java",
    ".c": "c", ".h": "c", ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp",
    ".cs": "csharp", ".go": "go", ".rs": "rust", ".rb": "ruby",
    ".php": "php", ".swift": "swift", ".kt": "kotlin", ".kts": "kotlin",
    ".sql": "sql", ".sh": "bash", ".bash": "bash", ".zsh": "bash",
    ".html": "html", ".htm": "html", ".css": "css", ".scss": "css",
    ".json": "json", ".yaml": "yaml", ".yml": "yaml", ".md": "markdown",
    ".r": "r", ".scala": "scala", ".lua": "lua", ".dart": "dart",
    ".ex": "elixir", ".exs": "elixir", ".hs": "haskell",
}

# Directories whose contents are never interesting for code review
_NOISE_DIRS = {
    "node_modules", ".git", "__pycache__", ".next", "dist", "build",
    ".venv", "venv", ".mypy_cache", ".pytest_cache", "coverage",
    ".turbo", ".parcel-cache", "out",
}

# Files to always include at the top of the bundle (highest priority)
_PRIORITY_NAMES = {
    "readme.md", "readme.txt", "readme.rst",
    "package.json", "requirements.txt", "pyproject.toml", "cargo.toml",
    "go.mod", "pom.xml", "build.gradle", "gemfile", "composer.json",
    "dockerfile", "docker-compose.yml", "docker-compose.yaml",
    "main.py", "app.py", "server.py", "__main__.py", "manage.py",
    "index.ts", "index.tsx", "index.js", "index.jsx",
    "app.ts", "app.tsx", "app.js", "app.jsx",
    "main.ts", "main.tsx", "main.js",
    "server.ts", "server.js",
}

# Skip generated / lock files even if they have a known extension
_SKIP_NAMES = {
    "package-lock.json", "yarn.lock", "pnpm-lock.yaml",
    "poetry.lock", "cargo.lock", "composer.lock", "gemfile.lock",
    "*.min.js", "*.min.css", "*.bundle.js",
}

# Skip directories that contain test/mock/generated code
_SKIP_DIRS = _NOISE_DIRS | {"test", "tests", "__tests__", "spec", "specs", "fixtures", "mocks", "migrations", "seeds"}

_FETCH_TIMEOUT   = httpx.Timeout(connect=10, read=30, write=10, pool=5)
_API_TIMEOUT     = httpx.Timeout(connect=10, read=15, write=10, pool=5)
_FILE_SEMAPHORE  = 12   # concurrent file fetches
_MAX_FILES       = 35   # max files included in bundle
_MAX_FILE_BYTES  = 3_000  # per-file snippet limit (~750 tokens each)
_MAX_TOTAL_BYTES = 55_000  # ~55 KB total ≈ 13K tokens — fits in 64K context


def _gh_headers() -> dict[str, str]:
    h = {"Accept": "application/vnd.github.v3+json"}
    if _GITHUB_TOKEN:
        h["Authorization"] = f"Bearer {_GITHUB_TOKEN}"
    return h


def _lang_from_path(path: str) -> str:
    suffix = PurePosixPath(path).suffix.lower()
    return _EXT_TO_LANG.get(suffix, "plaintext")


def _parse_repo_url(raw_url: str) -> tuple[str, str] | None:
    """
    If the URL is a plain repo root (github.com/user/repo or
    github.com/user/repo/tree/branch[/subdir]), return (owner, repo).
    Otherwise return None.
    """
    parsed = urlparse(raw_url.strip())
    host = parsed.netloc.lower()
    if host not in ("github.com", "www.github.com"):
        return None
    parts = [p for p in parsed.path.split("/") if p]
    if len(parts) == 2:
        return parts[0], parts[1]
    # github.com/user/repo/tree/branch[/subpath] — still a directory view
    if len(parts) >= 4 and parts[2] == "tree":
        return parts[0], parts[1]
    return None


def _resolve_file_url(raw_url: str) -> tuple[str, str, str]:
    """
    Returns (fetch_url, filename, content_type) for file/PR/gist URLs.
    Raises ValueError for unrecognised patterns.
    """
    parsed = urlparse(raw_url.strip())
    host = parsed.netloc.lower()
    path = parsed.path

    if host == "raw.githubusercontent.com":
        return raw_url, PurePosixPath(path).name, "code"

    if host == "gist.githubusercontent.com":
        return raw_url, PurePosixPath(path).name or "gist", "code"

    if host not in ("github.com", "www.github.com"):
        raise ValueError("Only github.com URLs are supported.")

    parts = [p for p in path.split("/") if p]

    # Gist  github.com/user/HASH
    if len(parts) == 2 and re.fullmatch(r"[0-9a-f]{20,}", parts[1]):
        url = f"https://gist.githubusercontent.com/{parts[0]}/{parts[1]}/raw"
        return url, "gist.txt", "code"

    # PR diff
    if len(parts) >= 4 and parts[2] == "pull" and parts[3].isdigit():
        owner, repo, pr_num = parts[0], parts[1], parts[3]
        url = f"https://patch-diff.githubusercontent.com/raw/{owner}/{repo}/pull/{pr_num}.diff"
        return url, f"pr-{pr_num}.diff", "diff"

    # File blob
    if len(parts) >= 5 and parts[2] == "blob":
        owner, repo = parts[0], parts[1]
        url = f"https://raw.githubusercontent.com/{owner}/{repo}/{'/'.join(parts[3:])}"
        return url, parts[-1], "code"

    raise ValueError(
        "Paste a file, PR, or repo URL.\n"
        "  • File:  github.com/user/repo/blob/main/path/file.py\n"
        "  • PR:    github.com/user/repo/pull/123\n"
        "  • Repo:  github.com/user/repo  (shows file picker)\n"
        "  • Gist:  gist.github.com/user/HASH"
    )


# ── /api/github-tree ──────────────────────────────────────────────────────────

@router.post("/github-tree")
async def github_tree(body: GithubFetchRequest):
    """Return the file tree for a GitHub repo URL."""
    parsed_repo = _parse_repo_url(body.url)
    if not parsed_repo:
        raise HTTPException(422, "Expected a repository URL: github.com/user/repo")

    owner, repo = parsed_repo
    api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1"

    async with httpx.AsyncClient(timeout=_API_TIMEOUT) as client:
        try:
            r = await client.get(api_url, headers=_gh_headers())
        except httpx.TimeoutException as exc:
            raise HTTPException(504, "GitHub API timed out.") from exc

    if r.status_code == 404:
        raise HTTPException(404, f"Repository '{owner}/{repo}' not found or is private.")
    if r.status_code in (403, 429):
        raise HTTPException(403, "GitHub rate limit hit. Add GITHUB_TOKEN to backend/.env.")
    if not r.is_success:
        raise HTTPException(502, f"GitHub API returned {r.status_code}.")

    data = r.json()
    if data.get("truncated"):
        # Tree too large — fall back to root listing only
        root_url = f"https://api.github.com/repos/{owner}/{repo}/contents"
        async with httpx.AsyncClient(timeout=_API_TIMEOUT) as client:
            r2 = await client.get(root_url, headers=_gh_headers())
        items = [
            {"path": i["path"], "size": i.get("size", 0), "language": _lang_from_path(i["path"])}
            for i in r2.json()
            if i["type"] == "file" and PurePosixPath(i["path"]).suffix.lower() in _EXT_TO_LANG
        ]
        return JSONResponse({"owner": owner, "repo": repo, "files": items, "truncated": True})

    files = []
    for item in data.get("tree", []):
        if item["type"] != "blob":
            continue
        path: str = item["path"]
        path_parts = path.split("/")
        if any(p in _NOISE_DIRS for p in path_parts):
            continue
        suffix = PurePosixPath(path).suffix.lower()
        if suffix not in _EXT_TO_LANG:
            continue
        files.append({
            "path": path,
            "size": item.get("size", 0),
            "language": _EXT_TO_LANG[suffix],
        })

    return JSONResponse({
        "owner": owner,
        "repo": repo,
        "files": files[:400],
        "truncated": False,
    })


# ── /api/fetch-github ─────────────────────────────────────────────────────────

@router.post("/fetch-github")
async def fetch_github(body: GithubFetchRequest):
    """Fetch a single file/PR/gist from GitHub and return its content."""
    # If it looks like a repo URL, redirect the caller to use /api/github-tree
    if _parse_repo_url(body.url):
        raise HTTPException(
            422,
            "That looks like a repository URL. Use the file picker to choose a specific file."
        )

    try:
        fetch_url, filename, content_type = _resolve_file_url(body.url)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc

    headers: dict[str, str] = {"Accept": "text/plain"}
    if _GITHUB_TOKEN:
        headers["Authorization"] = f"Bearer {_GITHUB_TOKEN}"

    async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT, follow_redirects=True) as client:
        try:
            response = await client.get(fetch_url, headers=headers)
        except httpx.TimeoutException as exc:
            raise HTTPException(504, "GitHub request timed out.") from exc

    if response.status_code == 404:
        raise HTTPException(404, "File not found. Check the branch name and path.")
    if response.status_code in (403, 429):
        raise HTTPException(403, "GitHub rate limit hit. Add GITHUB_TOKEN to backend/.env.")
    if not response.is_success:
        raise HTTPException(502, f"GitHub returned {response.status_code}.")

    code = response.text
    if len(code) > 200_000:
        raise HTTPException(413, "File is too large (>200 KB). Paste a relevant excerpt instead.")

    return JSONResponse({
        "code": code,
        "filename": filename,
        "language": "diff" if content_type == "diff" else _lang_from_path(filename),
        "content_type": content_type,
        "source_url": body.url,
    })


# ── /api/analyze-repo ─────────────────────────────────────────────────────────

def _prioritise(files: list[dict]) -> list[dict]:
    """Sort files: priority names first, then by path depth (shallower = earlier)."""
    def key(f: dict) -> tuple:
        name = PurePosixPath(f["path"]).name.lower()
        is_priority = 0 if name in _PRIORITY_NAMES else 1
        depth = f["path"].count("/")
        return (is_priority, depth, f["path"])
    return sorted(files, key=key)


async def _fetch_one(
    client: httpx.AsyncClient,
    sem: asyncio.Semaphore,
    url: str,
) -> str | None:
    async with sem:
        try:
            r = await client.get(url, timeout=httpx.Timeout(connect=8, read=20, write=5, pool=5))
            if r.is_success:
                return r.text
        except Exception:
            pass
    return None


@router.post("/analyze-repo")
async def analyze_repo(body: GithubFetchRequest):
    """Fetch an entire repo, bundle its source files, and stream a codebase analysis."""
    parsed_repo = _parse_repo_url(body.url)
    if not parsed_repo:
        raise HTTPException(422, "Expected a repository URL: github.com/user/repo")

    owner, repo = parsed_repo

    # ── Step 1: fetch file tree ───────────────────────────────────────────────
    api_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1"
    async with httpx.AsyncClient(timeout=_API_TIMEOUT) as client:
        try:
            r = await client.get(api_url, headers=_gh_headers())
        except httpx.TimeoutException as exc:
            raise HTTPException(504, "GitHub API timed out fetching file tree.") from exc

    if r.status_code == 404:
        raise HTTPException(404, f"Repository '{owner}/{repo}' not found or is private.")
    if r.status_code in (403, 429):
        raise HTTPException(403, "GitHub rate limit hit. Add GITHUB_TOKEN to backend/.env.")
    if not r.is_success:
        raise HTTPException(502, f"GitHub API returned {r.status_code}.")

    tree_data = r.json()

    # ── Step 2: filter & prioritise files ────────────────────────────────────
    candidates = []
    for item in tree_data.get("tree", []):
        if item["type"] != "blob":
            continue
        path: str = item["path"]
        path_parts = path.split("/")
        if any(p in _SKIP_DIRS for p in path_parts):
            continue
        if PurePosixPath(path).name in _SKIP_NAMES:
            continue
        suffix = PurePosixPath(path).suffix.lower()
        if suffix not in _EXT_TO_LANG and PurePosixPath(path).name.lower() not in _PRIORITY_NAMES:
            continue
        candidates.append({"path": path, "size": item.get("size", 0)})

    candidates = _prioritise(candidates)

    # ── Step 3: fetch file contents in parallel ───────────────────────────────
    sem = asyncio.Semaphore(_FILE_SEMAPHORE)
    raw_headers = {"Accept": "text/plain"}
    if _GITHUB_TOKEN:
        raw_headers["Authorization"] = f"Bearer {_GITHUB_TOKEN}"

    async with httpx.AsyncClient(headers=raw_headers, follow_redirects=True) as client:
        tasks = []
        for f in candidates[:_MAX_FILES]:
            url = f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{f['path']}"
            tasks.append(_fetch_one(client, sem, url))
        results = await asyncio.gather(*tasks)

    # ── Step 4: build file bundle ─────────────────────────────────────────────
    bundle_parts: list[str] = []
    total_bytes = 0
    file_count = 0
    for f, content in zip(candidates[:_MAX_FILES], results):
        if content is None:
            continue
        # Trim individual files to 8 KB to keep diversity
        snippet = content[:_MAX_FILE_BYTES]
        if len(content) > _MAX_FILE_BYTES:
            snippet += f"\n... [truncated — {len(content)} bytes total]"
        part = f"### {f['path']}\n```\n{snippet}\n```"
        part_bytes = len(part.encode())
        if total_bytes + part_bytes > _MAX_TOTAL_BYTES:
            break
        bundle_parts.append(part)
        total_bytes += part_bytes
        file_count += 1

    if file_count == 0:
        raise HTTPException(422, "No readable source files found in this repository.")

    user_message = (
        f"Repository: {owner}/{repo}\n"
        f"Files analysed: {file_count} (of {len(candidates)} code files found)\n\n"
        + "\n\n".join(bundle_parts)
    )

    # ── Step 5: stream LLM analysis ──────────────────────────────────────────
    async def event_stream():
        async for chunk in stream_text(REPO_ANALYZER_SYSTEM_PROMPT, user_message):
            yield chunk

    return StreamingResponse(event_stream(), media_type="text/plain; charset=utf-8")
