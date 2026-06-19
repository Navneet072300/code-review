"use client";

import { useCallback, useRef, useState } from "react";
import { CodeEditor } from "@/components/editor/CodeEditor";
import { GithubInput } from "@/components/editor/GithubInput";
import { ResultTabs } from "@/components/results/ResultTabs";
import { RepoResultsPanel } from "@/components/results/RepoResultsPanel";
import { Spinner } from "@/components/ui/Spinner";
import {
  streamAnalyze,
  streamAnalyzeRepo,
  generateTests,
  generateDocs,
  architectureDiagram,
  securityScan,
  interviewQuestions,
  type GithubFetchResult,
} from "@/lib/api";
import type {
  AnalysisMode,
  AnalysisResult,
  DiagramResult,
  RepoAnalysisResult,
  DocsResult,
  InterviewResult,
  SecurityResult,
  TestResult,
} from "@/types";

const LANGUAGES = [
  "auto-detect",
  "python",
  "javascript",
  "typescript",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "ruby",
  "php",
  "swift",
  "kotlin",
  "sql",
  "bash",
  "html",
  "css",
];

const MODES: { value: AnalysisMode; label: string; desc: string }[] = [
  {
    value: "beginner",
    label: "Beginner",
    desc: "Simple explanations, no jargon",
  },
  {
    value: "full",
    label: "Full Review",
    desc: "Complete analysis for all levels",
  },
  { value: "senior", label: "Senior", desc: "Concise, advanced focus" },
];

const SAMPLE_CODE = `def fibonacci(n):
    if n <= 0:
        return []
    elif n == 1:
        return [0]

    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])

    return fib

result = fibonacci(10)
print(result)
`;

export default function HomePage() {
  const [code, setCode] = useState(SAMPLE_CODE);
  const [language, setLanguage] = useState("auto-detect");
  const [mode, setMode] = useState<AnalysisMode>("full");

  const [analysisRaw, setAnalysisRaw] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [showResults, setShowResults] = useState(false);

  const [tests, setTests] = useState<TestResult | null>(null);
  const [testsLoading, setTestsLoading] = useState(false);
  const [docs, setDocs] = useState<DocsResult | null>(null);
  const [docsLoading, setDocsLoading] = useState(false);
  const [diagram, setDiagram] = useState<DiagramResult | null>(null);
  const [diagramLoading, setDiagramLoading] = useState(false);
  const [security, setSecurity] = useState<SecurityResult | null>(null);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [interview, setInterview] = useState<InterviewResult | null>(null);
  const [interviewLoading, setInterviewLoading] = useState(false);

  const [githubSource, setGithubSource] = useState<string | null>(null);

  // Repo analysis state
  const [repoResult, setRepoResult]       = useState<RepoAnalysisResult | null>(null);
  const [repoRaw, setRepoRaw]             = useState("");
  const [repoLoading, setRepoLoading]     = useState(false);
  const [repoError, setRepoError]         = useState<string | null>(null);
  const [repoUrl, setRepoUrl]             = useState("");
  const [showRepo, setShowRepo]           = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const handleGithubFetched = useCallback((result: GithubFetchResult) => {
    setCode(result.code);
    if (result.language !== "plaintext") setLanguage(result.language);
    setGithubSource(result.filename);
    setShowRepo(false);
    setRepoResult(null);
    setRepoRaw("");
    setAnalysis(null);
    setAnalysisRaw("");
    setAnalysisError(null);
    setShowResults(false);
    setTests(null);
    setDocs(null);
    setDiagram(null);
    setSecurity(null);
    setInterview(null);
  }, []);

  const handleAnalyzeRepo = useCallback(async (url: string) => {
    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setRepoUrl(url);
    setRepoRaw("");
    setRepoResult(null);
    setRepoError(null);
    setRepoLoading(true);
    setShowRepo(true);
    // Clear single-file state
    setShowResults(false);
    setAnalysis(null);
    setAnalysisRaw("");

    let accumulated = "";
    try {
      await streamAnalyzeRepo(
        url,
        (chunk) => { accumulated += chunk; setRepoRaw(accumulated); },
        abortRef.current.signal,
      );
      const cleaned = accumulated
        .replace(/^```(?:json)?\s*/m, "")
        .replace(/\s*```$/m, "")
        .trim();
      if (!cleaned) throw new Error("Model returned an empty response. Try again.");
      if (cleaned.includes("[TRUNCATED")) {
        throw new Error("Response was cut off before completing. The repo may be too large — try again.");
      }
      setRepoResult(JSON.parse(cleaned) as RepoAnalysisResult);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message;
        setRepoError(
          msg.startsWith("JSON") || msg.includes("JSON")
            ? "Model response wasn't valid JSON — the reply was likely cut off. Please try again."
            : msg
        );
      }
    } finally {
      setRepoLoading(false);
    }
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!code.trim()) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setAnalysisRaw("");
    setAnalysis(null);
    setAnalysisError(null);
    setAnalysisLoading(true);
    setShowResults(true);
    setTests(null);
    setDocs(null);
    setDiagram(null);
    setSecurity(null);
    setInterview(null);

    let accumulated = "";
    try {
      await streamAnalyze(
        code,
        language === "auto-detect" ? null : language,
        mode,
        (chunk) => {
          accumulated += chunk;
          setAnalysisRaw(accumulated);
        },
        abortRef.current.signal,
      );
      const cleaned = accumulated
        .replace(/^```(?:json)?\s*/m, "")
        .replace(/\s*```$/m, "")
        .trim();
      if (!cleaned) throw new Error("Model returned an empty response. Try again.");
      if (cleaned.includes("[TRUNCATED")) {
        throw new Error("Response was cut off before completing. Try a shorter snippet or switch to Senior mode.");
      }
      setAnalysis(JSON.parse(cleaned) as AnalysisResult);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const msg = (err as Error).message;
        setAnalysisError(
          msg.startsWith("JSON") || msg.includes("JSON")
            ? "Model response wasn't valid JSON — the reply may have been cut off. Please try again."
            : msg
        );
      }
    } finally {
      setAnalysisLoading(false);
    }
  }, [code, language, mode]);

  const lang = language === "auto-detect" ? null : language;

  const loadTests = useCallback(async () => {
    if (testsLoading || tests) return;
    setTestsLoading(true);
    try {
      setTests(await generateTests(code, lang));
    } catch {
      setTests({
        language: lang ?? "unknown",
        test_framework: "unknown",
        tests: "Error generating tests.",
        explanation: "",
      });
    } finally {
      setTestsLoading(false);
    }
  }, [code, lang, tests, testsLoading]);

  const loadDocs = useCallback(async () => {
    if (docsLoading || docs) return;
    setDocsLoading(true);
    try {
      setDocs(await generateDocs(code, lang));
    } catch {
      setDocs({
        documented_code: "Error generating docs.",
        readme_section: "",
        api_reference: "",
      });
    } finally {
      setDocsLoading(false);
    }
  }, [code, lang, docs, docsLoading]);

  const loadDiagram = useCallback(async () => {
    if (diagramLoading || diagram) return;
    setDiagramLoading(true);
    try {
      setDiagram(await architectureDiagram(code, lang));
    } catch {
      setDiagram({
        diagram: "graph TD\n  A[Error] --> B[Failed to generate]",
        diagram_type: "flowchart",
        description: "Error",
      });
    } finally {
      setDiagramLoading(false);
    }
  }, [code, lang, diagram, diagramLoading]);

  const loadSecurity = useCallback(async () => {
    if (securityLoading || security) return;
    setSecurityLoading(true);
    try {
      setSecurity(await securityScan(code, lang));
    } catch {
      setSecurity({
        risk_level: "none",
        vulnerabilities: [],
        secure_version: "",
        summary: "Error running security scan.",
      });
    } finally {
      setSecurityLoading(false);
    }
  }, [code, lang, security, securityLoading]);

  const loadInterview = useCallback(async () => {
    if (interviewLoading || interview) return;
    setInterviewLoading(true);
    try {
      setInterview(await interviewQuestions(code, lang));
    } catch {
      setInterview({ questions: [] });
    } finally {
      setInterviewLoading(false);
    }
  }, [code, lang, interview, interviewLoading]);

  const hasReport = showRepo || showResults || analysisLoading || repoLoading;

  const handleReset = () => {
    abortRef.current?.abort();
    setShowResults(false);
    setShowRepo(false);
    setAnalysis(null);
    setAnalysisRaw("");
    setAnalysisError(null);
    setRepoResult(null);
    setRepoRaw("");
    setRepoError(null);
    setGithubSource(null);
    setTests(null);
    setDocs(null);
    setDiagram(null);
    setSecurity(null);
    setInterview(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface">
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold text-accent">{"</>"}</span>
          <span className="font-semibold text-primary">AI Code Reviewer</span>
          <span className="text-xs px-2 py-0.5 rounded bg-accent-dim/10 text-accent border border-accent-dim/30">
            gemma4:31b
          </span>
        </div>
        <div className="flex items-center gap-3">
          {hasReport && (
            <button
              type="button"
              onClick={handleReset}
              className="text-xs px-3 py-1.5 rounded border border-border text-muted hover:border-accent hover:text-accent transition-colors bg-transparent"
            >
              ← New Analysis
            </button>
          )}
          <span className="text-xs text-muted">Powered by Ollama</span>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
        {/* Left panel — editor: hidden once a report is active */}
        {!hasReport && (
        <div className="flex flex-col lg:w-[48%] border-r border-border">
          {/* GitHub URL input */}
          <GithubInput
            onFetched={handleGithubFetched}
            onAnalyzeRepo={handleAnalyzeRepo}
            isAnalyzingRepo={repoLoading}
          />

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3 px-4 py-3 border-b border-border bg-bg">
            <label htmlFor="language-select" className="sr-only">
              Language
            </label>
            <select
              id="language-select"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="text-sm rounded px-2 py-1 outline-none bg-surface border border-border text-primary"
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>
                  {l === "auto-detect" ? "Auto-detect language" : l}
                </option>
              ))}
            </select>

            <div className="flex rounded overflow-hidden border border-border">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => setMode(m.value)}
                  title={m.desc}
                  className={[
                    "px-3 py-1 text-xs transition-colors border-r border-border last:border-r-0",
                    mode === m.value
                      ? "bg-accent-dim text-white"
                      : "bg-surface text-muted hover:text-primary",
                  ].join(" ")}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {githubSource && (
              <span
                className="text-xs px-2 py-0.5 rounded bg-surface border border-border text-muted truncate max-w-[160px]"
                title={githubSource}
              >
                {githubSource}
              </span>
            )}

            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analysisLoading || !code.trim()}
              className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded text-sm font-semibold bg-accent-dim text-white disabled:opacity-50 transition-opacity hover:opacity-90"
            >
              {analysisLoading ? (
                <>
                  <Spinner size={14} /> Analyzing…
                </>
              ) : (
                "Analyze"
              )}
            </button>
          </div>

          {/* Monaco */}
          <div className="flex-1 min-h-[400px]">
            <CodeEditor
              value={code}
              onChange={setCode}
              language={language === "auto-detect" ? "plaintext" : language}
              height="100%"
            />
          </div>
        </div>
        )}

        {/* Right panel — results (full width when report is active) */}
        <div className="flex flex-col flex-1 overflow-auto">
          {/* Repo analysis */}
          {showRepo && (
            <>
              {repoError && (
                <div className="m-4 p-3 rounded text-sm bg-danger/10 border border-danger text-danger">
                  Error: {repoError}
                </div>
              )}
              {!repoError && (
                <RepoResultsPanel
                  result={repoResult}
                  raw={repoRaw}
                  loading={repoLoading}
                  repoUrl={repoUrl}
                />
              )}
            </>
          )}

          {/* Single-file analysis */}
          {!showRepo && (
            <>
              {analysisError && (
                <div className="m-4 p-3 rounded text-sm bg-danger/10 border border-danger text-danger">
                  Error: {analysisError}
                </div>
              )}
              {!showResults && !analysisError ? (
                <div className="flex flex-col items-center justify-center flex-1 gap-4 p-8 text-muted">
                  <span className="text-5xl">{"</>"}</span>
                  <p className="text-sm text-center max-w-xs">
                    Paste a GitHub repo URL above to analyse the full codebase, or type
                    code on the left and click{" "}
                    <strong className="text-accent">Analyze</strong>.
                  </p>
                  <p className="text-xs text-border">
                    Supports 15+ languages · Streaming responses · Dark by default
                  </p>
                </div>
              ) : (
                <div className="p-4 flex-1">
                  <ResultTabs
                    analysis={analysis}
                    analysisRaw={analysisRaw}
                    analysisLoading={analysisLoading}
                    tests={tests}
                    testsLoading={testsLoading}
                    docs={docs}
                    docsLoading={docsLoading}
                    diagram={diagram}
                    diagramLoading={diagramLoading}
                    security={security}
                    securityLoading={securityLoading}
                    interview={interview}
                    interviewLoading={interviewLoading}
                    onLoadTests={loadTests}
                    onLoadDocs={loadDocs}
                    onLoadDiagram={loadDiagram}
                    onLoadSecurity={loadSecurity}
                    onLoadInterview={loadInterview}
                    code={code}
                  />
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
