import type {
  AnalysisMode,
  CommitResult,
  ConvertResult,
  DiagramResult,
  DocsResult,
  InterviewResult,
  SecurityResult,
  TestResult,
} from "@/types";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function streamAnalyze(
  code: string,
  language: string | null,
  mode: AnalysisMode,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, language, mode }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

export const generateTests = (code: string, language?: string | null) =>
  post<TestResult>("/api/generate-tests", { code, language });

export const generateDocs = (code: string, language?: string | null) =>
  post<DocsResult>("/api/generate-docs", { code, language });

export const convertLanguage = (
  code: string,
  source_lang: string,
  target_lang: string
) => post<ConvertResult>("/api/convert-language", { code, source_lang, target_lang });

export const architectureDiagram = (code: string, language?: string | null) =>
  post<DiagramResult>("/api/architecture-diagram", { code, language });

export const securityScan = (code: string, language?: string | null) =>
  post<SecurityResult>("/api/security-scan", { code, language });

export const interviewQuestions = (code: string, language?: string | null) =>
  post<InterviewResult>("/api/interview-questions", { code, language });

export const commitMessage = (diff: string) =>
  post<CommitResult>("/api/commit-message", { diff });

export interface GithubFetchResult {
  code: string;
  filename: string;
  language: string;
  content_type: "code" | "diff";
  source_url: string;
}

export const fetchFromGithub = (url: string) =>
  post<GithubFetchResult>("/api/fetch-github", { url });

export interface GithubTreeFile {
  path: string;
  size: number;
  language: string;
}

export interface GithubTreeResult {
  owner: string;
  repo: string;
  files: GithubTreeFile[];
  truncated: boolean;
}

export const fetchGithubTree = (url: string) =>
  post<GithubTreeResult>("/api/github-tree", { url });

export async function streamAnalyzeRepo(
  url: string,
  onChunk: (chunk: string) => void,
  signal?: AbortSignal
): Promise<void> {
  const res = await fetch(`${BASE}/api/analyze-repo`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}
