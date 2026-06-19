"use client";

import { useRef, useState } from "react";
import {
  fetchFromGithub,
  fetchGithubTree,
  type GithubFetchResult,
  type GithubTreeFile,
} from "@/lib/api";
import { Spinner } from "@/components/ui/Spinner";

interface GithubInputProps {
  onFetched: (result: GithubFetchResult) => void;
  onAnalyzeRepo: (url: string) => void;
  isAnalyzingRepo: boolean;
}

const PLACEHOLDER = "github.com/user/repo  or  /blob/main/file.py  or  /pull/123";

function normalise(raw: string) {
  return raw.trim().startsWith("http") ? raw.trim() : `https://${raw.trim()}`;
}

function isRepoUrl(raw: string): boolean {
  try {
    const url = new URL(normalise(raw));
    const parts = url.pathname.split("/").filter(Boolean);
    return (
      parts.length === 2 ||
      (parts.length >= 4 && parts[2] === "tree")
    );
  } catch {
    return false;
  }
}

export function GithubInput({ onFetched, onAnalyzeRepo, isAnalyzingRepo }: GithubInputProps) {
  const [url, setUrl]         = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // File-picker state (for non-repo file URLs that need disambiguation)
  const [files, setFiles]         = useState<GithubTreeFile[] | null>(null);
  const [repoLabel, setRepoLabel] = useState("");
  const [search, setSearch]       = useState("");
  const [picking, setPicking]     = useState(false);
  const [fetchingFile, setFetchingFile] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);

  const repoMode = isRepoUrl(url);

  const handleAction = async () => {
    const norm = normalise(url);
    if (!norm) return;
    setError(null);

    if (repoMode) {
      // Hand off to parent — parent owns the streaming state
      onAnalyzeRepo(norm);
      return;
    }

    setLoading(true);
    setFiles(null);
    setPicking(false);

    try {
      const result = await fetchFromGithub(norm);
      onFetched(result);
    } catch (err) {
      setError((err as Error).message.replace(/^\d+: /, ""));
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleAction();
    if (e.key === "Escape") { setPicking(false); setFiles(null); }
  };

  const handlePickFile = async (file: GithubTreeFile) => {
    setFetchingFile(true);
    setError(null);
    try {
      const [owner, repo] = repoLabel.split("/");
      const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/${file.path}`;
      const result = await fetchFromGithub(rawUrl);
      onFetched(result);
      setPicking(false);
      setSearch("");
    } catch (err) {
      setError((err as Error).message.replace(/^\d+: /, ""));
    } finally {
      setFetchingFile(false);
    }
  };

  const filtered = files
    ? files.filter((f) => search === "" || f.path.toLowerCase().includes(search.toLowerCase()))
    : [];

  const busy = loading || isAnalyzingRepo;

  return (
    <div className="border-b border-border bg-bg">
      {/* URL row */}
      <div className="flex gap-2 items-center px-4 py-2">
        {/* GitHub icon */}
        <svg viewBox="0 0 16 16" className="w-4 h-4 flex-shrink-0 text-muted fill-current" aria-hidden>
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38
            0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13
            -.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87
            2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15
            -.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68
            0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82
            1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01
            1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
        </svg>

        <input
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setPicking(false);
            setFiles(null);
            setError(null);
          }}
          onKeyDown={handleKey}
          placeholder={PLACEHOLDER}
          aria-label="GitHub URL"
          className="flex-1 text-sm bg-transparent outline-none text-primary placeholder:text-border"
        />

        <button
          type="button"
          onClick={handleAction}
          disabled={busy || !url.trim()}
          className={[
            "flex items-center gap-1.5 text-xs px-3 py-1 rounded text-white disabled:opacity-40 transition-colors flex-shrink-0",
            repoMode ? "bg-accent-dim hover:opacity-90" : "border border-border bg-transparent text-muted hover:border-accent hover:text-accent",
          ].join(" ")}
        >
          {isAnalyzingRepo ? (
            <><Spinner size={12} /> Analysing…</>
          ) : repoMode ? (
            "Analyze Repo"
          ) : loading ? (
            <><Spinner size={12} /> Fetching…</>
          ) : (
            "Fetch File"
          )}
        </button>
      </div>

      {/* Hint when repo URL detected */}
      {repoMode && !isAnalyzingRepo && (
        <p className="px-4 pb-2 text-xs text-muted">
          Repo detected — will fetch all source files and analyse the full codebase.
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="px-4 pb-2 text-xs text-danger whitespace-pre-wrap">{error}</p>
      )}

      {/* File picker (for non-repo file-list edge cases) */}
      {picking && files && (
        <div className="border-t border-border">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-border">
            <span className="text-xs text-muted flex-shrink-0">{repoLabel}</span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && (setPicking(false), setFiles(null))}
              placeholder={`Search ${files.length} files…`}
              aria-label="Search files"
              className="flex-1 text-xs bg-transparent outline-none text-primary placeholder:text-muted"
            />
            <button
              type="button"
              onClick={() => { setPicking(false); setFiles(null); }}
              className="text-xs text-muted hover:text-primary"
              aria-label="Close file picker"
            >
              ✕
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto" aria-label="Repository files">
            {fetchingFile && (
              <div className="px-4 py-3 flex items-center gap-2 text-xs text-accent">
                <Spinner size={12} /> Loading file…
              </div>
            )}
            {filtered.length === 0 && !fetchingFile && (
              <div className="px-4 py-3 text-xs text-muted">No files match.</div>
            )}
            {!fetchingFile && filtered.slice(0, 200).map((f) => (
              <button
                key={f.path}
                type="button"
                onClick={() => handlePickFile(f)}
                className="w-full text-left px-4 py-1.5 text-xs flex items-center gap-3 hover:bg-surface transition-colors"
              >
                <span className="text-muted font-mono truncate flex-1">{f.path}</span>
                <span className="flex-shrink-0 text-border">{f.language}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
