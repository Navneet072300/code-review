"use client";

import { useState } from "react";
import type { RepoAnalysisResult } from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { CopyButton } from "@/components/ui/CopyButton";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { MermaidDiagram } from "./MermaidDiagram";

interface RepoResultsPanelProps {
  result: RepoAnalysisResult | null;
  raw: string;
  loading: boolean;
  repoUrl: string;
}

const SCORE_COLOR: Record<number, string> = {};
function scoreColor(n: number) {
  if (n >= 8) return "text-success";
  if (n >= 5) return "text-warning";
  return "text-danger";
}

export function RepoResultsPanel({ result, raw, loading, repoUrl }: RepoResultsPanelProps) {
  const [openModule, setOpenModule] = useState<number | null>(null);

  if (loading && !result) {
    return (
      <div className="flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2 text-accent">
          <Spinner size={16} />
          <span className="text-sm">Fetching and analysing repository…</span>
        </div>
        <pre className="text-xs overflow-auto rounded p-3 whitespace-pre-wrap bg-bg text-muted border border-border max-h-[60vh]">
          {raw || "Waiting for response…"}
        </pre>
      </div>
    );
  }

  if (!result) return null;

  const report = buildReport(result, repoUrl);

  return (
    <div className="flex flex-col gap-6 p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex flex-col gap-2">
          <h2 className="text-base font-semibold text-primary">{repoUrl.replace("https://github.com/", "")}</h2>
          <p className="text-sm text-muted leading-relaxed max-w-2xl">{result.repo_summary}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <CopyButton text={report} label="Copy Report" />
          <DownloadButton content={report} filename="repo-review.md" label="Download .md" />
        </div>
      </div>

      {/* Quality score + tech stack */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded bg-surface border border-border">
          <span className="text-xs text-muted">Quality</span>
          <span className={`text-lg font-bold ${scoreColor(result.code_quality_score)}`}>
            {result.code_quality_score}/10
          </span>
        </div>
        {result.tech_stack.map((t) => (
          <span key={t} className="text-xs px-2 py-1 rounded bg-surface border border-border text-primary">
            {t}
          </span>
        ))}
      </div>

      {/* Grid sections */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Architecture Overview">
          <p className="text-sm text-primary leading-relaxed">{result.architecture_overview}</p>
        </Section>

        <Section title="Project Structure">
          <p className="text-sm text-primary leading-relaxed whitespace-pre-wrap">{result.project_structure}</p>
        </Section>

        <Section title="Entry Points">
          <ul className="flex flex-col gap-1">
            {result.entry_points.map((ep, i) => (
              <li key={i} className="text-sm flex gap-2 text-primary">
                <span className="text-accent flex-shrink-0">▶</span> {ep}
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Data Flow">
          <p className="text-sm text-primary leading-relaxed">{result.data_flow}</p>
        </Section>
      </div>

      {/* Key modules accordion */}
      {result.key_modules.length > 0 && (
        <Section title="Key Modules">
          <div className="flex flex-col gap-2">
            {result.key_modules.map((m, i) => (
              <div key={i} className="rounded border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpenModule(openModule === i ? null : i)}
                  className="w-full text-left px-4 py-2.5 flex items-center gap-3 bg-bg hover:bg-surface transition-colors"
                >
                  <span className="text-sm font-mono text-accent">{m.name}</span>
                  <span className="text-xs text-muted truncate flex-1">{m.purpose}</span>
                  <span className="text-muted text-xs flex-shrink-0">{openModule === i ? "▲" : "▼"}</span>
                </button>
                {openModule === i && (
                  <div className="px-4 py-3 bg-surface border-t border-border flex flex-col gap-2">
                    <p className="text-sm text-primary">{m.purpose}</p>
                    {m.key_dependencies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {m.key_dependencies.map((d) => (
                          <span key={d} className="text-xs px-2 py-0.5 rounded bg-bg border border-border text-muted">{d}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Code quality notes */}
      {result.code_quality_notes && (
        <Section title="Code Quality Notes">
          <p className="text-sm text-primary leading-relaxed">{result.code_quality_notes}</p>
        </Section>
      )}

      {/* Issues + Security side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Section title="Potential Issues">
          {result.potential_issues.length === 0 ? (
            <p className="text-sm text-success">No major issues detected.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {result.potential_issues.map((issue, i) => (
                <li key={i} className="text-sm p-2.5 rounded flex gap-2 bg-bg border border-danger/20">
                  <span className="text-danger flex-shrink-0">✗</span>
                  <span className="text-primary">{issue}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Security Concerns">
          {result.security_concerns.length === 0 ? (
            <p className="text-sm text-success">No security concerns detected.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {result.security_concerns.map((c, i) => (
                <li key={i} className="text-sm p-2.5 rounded flex gap-2 bg-bg border border-warning/20">
                  <span className="text-warning flex-shrink-0">⚠</span>
                  <span className="text-primary">{c}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      {/* Suggested improvements */}
      <Section title="Suggested Improvements">
        <ul className="flex flex-col gap-2">
          {result.suggested_improvements.map((imp, i) => (
            <li key={i} className="text-sm p-2.5 rounded flex gap-2 bg-bg border border-success/20">
              <span className="text-success flex-shrink-0">✓</span>
              <span className="text-primary">{imp}</span>
            </li>
          ))}
        </ul>
      </Section>

      {/* Architecture diagram */}
      {result.architecture_diagram && (
        <Section title="Architecture Diagram">
          <MermaidDiagram chart={result.architecture_diagram} />
        </Section>
      )}

      {/* Key takeaways */}
      <Section title="Key Takeaways">
        <ul className="flex flex-col gap-2">
          {result.key_takeaways.map((t, i) => (
            <li key={i} className="text-sm flex gap-2 text-primary">
              <span className="text-accent font-bold flex-shrink-0">{i + 1}.</span> {t}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </div>
  );
}

function buildReport(r: RepoAnalysisResult, repoUrl: string): string {
  return [
    `# Repo Review: ${repoUrl}`,
    ``,
    `> ${r.repo_summary}`,
    ``,
    `**Quality Score:** ${r.code_quality_score}/10`,
    `**Tech Stack:** ${r.tech_stack.join(", ")}`,
    ``,
    `## Architecture Overview`,
    r.architecture_overview,
    ``,
    `## Project Structure`,
    r.project_structure,
    ``,
    `## Entry Points`,
    ...r.entry_points.map((e) => `- ${e}`),
    ``,
    `## Data Flow`,
    r.data_flow,
    ``,
    `## Key Modules`,
    ...r.key_modules.map((m) => `### ${m.name}\n${m.purpose}\nDeps: ${m.key_dependencies.join(", ")}`),
    ``,
    `## Code Quality`,
    r.code_quality_notes,
    ``,
    `## Potential Issues`,
    ...r.potential_issues.map((i) => `- ${i}`),
    ``,
    `## Security Concerns`,
    ...r.security_concerns.map((c) => `- ${c}`),
    ``,
    `## Suggested Improvements`,
    ...r.suggested_improvements.map((i) => `- ${i}`),
    ``,
    `## Architecture Diagram`,
    "```mermaid",
    r.architecture_diagram,
    "```",
    ``,
    `## Key Takeaways`,
    ...r.key_takeaways.map((t, i) => `${i + 1}. ${t}`),
  ].join("\n");
}
