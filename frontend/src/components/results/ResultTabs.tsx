"use client";

import { useState } from "react";
import type {
  AnalysisResult,
  DiagramResult,
  DocsResult,
  InterviewResult,
  SecurityResult,
  TabId,
  TestResult,
} from "@/types";
import { Spinner } from "@/components/ui/Spinner";
import { CopyButton } from "@/components/ui/CopyButton";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { MermaidDiagram } from "./MermaidDiagram";
import { MarkdownBlock } from "./MarkdownBlock";

// Tailwind colour classes per severity/difficulty — avoids dynamic class generation
const SEVERITY_CLASS: Record<string, string> = {
  critical: "text-critical bg-critical/10 border-critical/30",
  high:     "text-danger  bg-danger/10  border-danger/30",
  medium:   "text-warning bg-warning/10 border-warning/30",
  low:      "text-success bg-success/10 border-success/30",
  none:     "text-muted   bg-muted/10   border-muted/30",
  info:     "text-accent  bg-accent/10  border-accent/30",
};

const SEVERITY_BORDER: Record<string, string> = {
  critical: "border-critical/30",
  high:     "border-danger/30",
  medium:   "border-warning/30",
  low:      "border-success/30",
  none:     "border-border",
  info:     "border-accent/30",
};

const DIFF_CLASS: Record<string, string> = {
  beginner:     "text-success bg-success/10",
  intermediate: "text-warning bg-warning/10",
  advanced:     "text-danger  bg-danger/10",
};

interface TabState {
  analysis: AnalysisResult | null;
  analysisRaw: string;
  analysisLoading: boolean;
  tests: TestResult | null;
  testsLoading: boolean;
  docs: DocsResult | null;
  docsLoading: boolean;
  diagram: DiagramResult | null;
  diagramLoading: boolean;
  security: SecurityResult | null;
  securityLoading: boolean;
  interview: InterviewResult | null;
  interviewLoading: boolean;
  onLoadTests: () => void;
  onLoadDocs: () => void;
  onLoadDiagram: () => void;
  onLoadSecurity: () => void;
  onLoadInterview: () => void;
  code: string;
}

const TABS: { id: TabId; label: string }[] = [
  { id: "overview",    label: "Overview" },
  { id: "flow",        label: "Execution Flow" },
  { id: "issues",      label: "Issues & Fixes" },
  { id: "optimization",label: "Optimization" },
  { id: "tests",       label: "Tests" },
  { id: "docs",        label: "Docs" },
  { id: "diagram",     label: "Diagram" },
  { id: "security",    label: "Security" },
  { id: "interview",   label: "Interview Qs" },
];

const LAZY_TABS = new Set<TabId>(["tests", "docs", "diagram", "security", "interview"]);

export function ResultTabs(props: TabState) {
  const [active, setActive] = useState<TabId>("overview");
  const { analysis, analysisRaw, analysisLoading } = props;

  const fullReport = buildMarkdownReport(analysis, props);

  const handleTabClick = (id: TabId) => {
    setActive(id);
    if (id === "tests"     && !props.tests     && !props.testsLoading)     props.onLoadTests();
    if (id === "docs"      && !props.docs      && !props.docsLoading)      props.onLoadDocs();
    if (id === "diagram"   && !props.diagram   && !props.diagramLoading)   props.onLoadDiagram();
    if (id === "security"  && !props.security  && !props.securityLoading)  props.onLoadSecurity();
    if (id === "interview" && !props.interview && !props.interviewLoading) props.onLoadInterview();
  };

  const showStream = analysisLoading && !LAZY_TABS.has(active);

  return (
    <div className="flex flex-col min-h-[500px]">
      {/* Tab bar */}
      <div className="flex overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => handleTabClick(t.id)}
            className={[
              "px-4 py-2 text-sm whitespace-nowrap transition-colors -mb-px border-b-2",
              active === t.id
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-primary",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2 px-3">
          {fullReport && (
            <>
              <CopyButton text={fullReport} label="Copy Report" />
              <DownloadButton content={fullReport} filename="code-review.md" label="Download .md" />
            </>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div className="rounded-b p-5 flex-1 overflow-auto bg-surface border border-t-0 border-border">
        {showStream ? (
          <StreamingPlaceholder raw={analysisRaw} />
        ) : (
          <>
            {active === "overview"     && <OverviewTab analysis={analysis} />}
            {active === "flow"         && <FlowTab analysis={analysis} />}
            {active === "issues"       && <IssuesTab analysis={analysis} code={props.code} />}
            {active === "optimization" && <OptimizationTab analysis={analysis} />}
            {active === "tests"     && <LazyTab loading={props.testsLoading}     data={props.tests}     renderData={(d) => <TestsContent data={d} />} />}
            {active === "docs"      && <LazyTab loading={props.docsLoading}      data={props.docs}      renderData={(d) => <DocsContent data={d} />} />}
            {active === "diagram"   && <LazyTab loading={props.diagramLoading}   data={props.diagram}   renderData={(d) => <DiagramContent data={d} />} />}
            {active === "security"  && <LazyTab loading={props.securityLoading}  data={props.security}  renderData={(d) => <SecurityContent data={d} />} />}
            {active === "interview" && <LazyTab loading={props.interviewLoading} data={props.interview} renderData={(d) => <InterviewContent data={d} />} />}
          </>
        )}
      </div>
    </div>
  );
}

// ── Streaming placeholder ─────────────────────────────────────────────────────

function StreamingPlaceholder({ raw }: { raw: string }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-accent">
        <Spinner size={16} />
        <span className="text-sm">Analyzing…</span>
      </div>
      <pre className="text-xs overflow-auto rounded p-3 whitespace-pre-wrap bg-bg text-muted border border-border">
        {raw || "Waiting for response…"}
      </pre>
    </div>
  );
}

// ── Lazy tab wrapper ──────────────────────────────────────────────────────────

function LazyTab<T>({
  loading,
  data,
  renderData,
}: {
  loading: boolean;
  data: T | null;
  renderData: (d: T) => React.ReactNode;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 justify-center text-accent">
        <Spinner />
        <span className="text-sm">Generating…</span>
      </div>
    );
  }
  if (!data) {
    return (
      <p className="text-sm py-8 text-center text-muted">
        Click this tab to load results.
      </p>
    );
  }
  return <>{renderData(data)}</>;
}

// ── Overview tab ──────────────────────────────────────────────────────────────

function OverviewTab({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <Empty />;
  return (
    <div className="flex flex-col gap-5">
      <Section title="Summary">
        <p className="text-sm leading-relaxed text-primary">{analysis.summary}</p>
      </Section>

      <div className="flex gap-3 flex-wrap">
        <Chip label="Language"         value={analysis.language_detected} />
        <Chip label="Time complexity"  value={analysis.complexity_analysis.time} />
        <Chip label="Space complexity" value={analysis.complexity_analysis.space} />
      </div>

      <Section title="What it does">
        <p className="text-sm leading-relaxed text-primary">{analysis.what_it_does}</p>
      </Section>

      <Section title="Key takeaways">
        <ul className="flex flex-col gap-1">
          {analysis.key_takeaways.map((t, i) => (
            <li key={i} className="text-sm flex gap-2 text-primary">
              <span className="text-accent">→</span> {t}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

// ── Execution flow tab ────────────────────────────────────────────────────────

function FlowTab({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <Empty />;
  return (
    <Section title="Execution Flow">
      <MarkdownBlock content={analysis.execution_flow} />
    </Section>
  );
}

// ── Issues & Fixes tab ────────────────────────────────────────────────────────

function IssuesTab({ analysis, code }: { analysis: AnalysisResult | null; code: string }) {
  if (!analysis) return <Empty />;
  return (
    <div className="flex flex-col gap-5">
      <Section title="Potential Issues">
        {analysis.potential_issues.length === 0 ? (
          <p className="text-sm text-success">No issues detected.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {analysis.potential_issues.map((issue, i) => (
              <li key={i} className="text-sm p-3 rounded flex gap-2 bg-bg border border-danger/20">
                <span className="text-danger">✗</span>
                <span className="text-primary">{issue}</span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Fixed Version">
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <CopyButton text={analysis.fixed_version} label="Copy" />
          </div>
          <pre className="text-xs overflow-auto rounded p-4 whitespace-pre-wrap bg-bg border border-border text-primary">
            {analysis.fixed_version || code}
          </pre>
        </div>
      </Section>
    </div>
  );
}

// ── Optimization tab ──────────────────────────────────────────────────────────

function OptimizationTab({ analysis }: { analysis: AnalysisResult | null }) {
  if (!analysis) return <Empty />;
  return (
    <div className="flex flex-col gap-5">
      <Section title="Suggested Improvements">
        <ul className="flex flex-col gap-2">
          {analysis.suggested_improvements.map((imp, i) => (
            <li key={i} className="text-sm p-3 rounded flex gap-2 bg-bg border border-success/20">
              <span className="text-success">✓</span>
              <span className="text-primary">{imp}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Best Practices">
        <ul className="flex flex-col gap-2">
          {analysis.best_practices.map((bp, i) => (
            <li key={i} className="text-sm flex gap-2 text-primary">
              <span className="text-accent">◆</span> {bp}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

// ── Tests tab ─────────────────────────────────────────────────────────────────

function TestsContent({ data }: { data: TestResult }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-3">
        <Chip label="Language"  value={data.language} />
        <Chip label="Framework" value={data.test_framework} />
      </div>
      <Section title="Generated Tests">
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <CopyButton text={data.tests} label="Copy" />
          </div>
          <pre className="text-xs overflow-auto rounded p-4 whitespace-pre-wrap bg-bg border border-border text-primary">
            {data.tests}
          </pre>
        </div>
      </Section>
      {data.explanation && (
        <Section title="Explanation">
          <p className="text-sm leading-relaxed text-primary">{data.explanation}</p>
        </Section>
      )}
    </div>
  );
}

// ── Docs tab ──────────────────────────────────────────────────────────────────

function DocsContent({ data }: { data: DocsResult }) {
  return (
    <div className="flex flex-col gap-5">
      <Section title="Documented Code">
        <div className="relative">
          <div className="absolute top-2 right-2 z-10">
            <CopyButton text={data.documented_code} label="Copy" />
          </div>
          <pre className="text-xs overflow-auto rounded p-4 whitespace-pre-wrap bg-bg border border-border text-primary">
            {data.documented_code}
          </pre>
        </div>
      </Section>
      <Section title="README Section">
        <MarkdownBlock content={data.readme_section} />
      </Section>
      <Section title="API Reference">
        <MarkdownBlock content={data.api_reference} />
      </Section>
    </div>
  );
}

// ── Diagram tab ───────────────────────────────────────────────────────────────

function DiagramContent({ data }: { data: DiagramResult }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2 items-center justify-between">
        <Chip label="Type" value={data.diagram_type} />
        <CopyButton text={data.diagram} label="Copy Mermaid" />
      </div>
      {data.description && (
        <p className="text-sm text-muted">{data.description}</p>
      )}
      <MermaidDiagram chart={data.diagram} />
    </div>
  );
}

// ── Security tab ──────────────────────────────────────────────────────────────

function SecurityContent({ data }: { data: SecurityResult }) {
  const riskKey = data.risk_level.toLowerCase();
  const riskCls = SEVERITY_CLASS[riskKey] ?? SEVERITY_CLASS.none;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-muted">Risk level:</span>
        <span className={`text-sm font-bold uppercase px-3 py-1 rounded border ${riskCls}`}>
          {data.risk_level}
        </span>
      </div>

      <Section title="Summary">
        <p className="text-sm leading-relaxed text-primary">{data.summary}</p>
      </Section>

      {data.vulnerabilities.length > 0 && (
        <Section title="Vulnerabilities">
          <div className="flex flex-col gap-3">
            {data.vulnerabilities.map((v, i) => {
              const sKey  = v.severity.toLowerCase();
              const badge = SEVERITY_CLASS[sKey]  ?? SEVERITY_CLASS.none;
              const card  = SEVERITY_BORDER[sKey] ?? "border-border";
              return (
                <div key={i} className={`rounded p-4 flex flex-col gap-2 bg-bg border ${card}`}>
                  <div className="flex items-center gap-2">
                    <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded border ${badge}`}>
                      {v.severity}
                    </span>
                    <span className="text-sm font-semibold text-primary">{v.title}</span>
                  </div>
                  <p className="text-sm text-muted">{v.description}</p>
                  {v.line_hint && (
                    <p className="text-xs text-accent">Line hint: {v.line_hint}</p>
                  )}
                  <div className="mt-1 pt-2 border-t border-border">
                    <p className="text-xs font-semibold mb-1 text-success">Remediation</p>
                    <p className="text-sm text-primary">{v.remediation}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {data.secure_version && (
        <Section title="Secure Version">
          <div className="relative">
            <div className="absolute top-2 right-2 z-10">
              <CopyButton text={data.secure_version} label="Copy" />
            </div>
            <pre className="text-xs overflow-auto rounded p-4 whitespace-pre-wrap bg-bg border border-border text-primary">
              {data.secure_version}
            </pre>
          </div>
        </Section>
      )}
    </div>
  );
}

// ── Interview tab ─────────────────────────────────────────────────────────────

function InterviewContent({ data }: { data: InterviewResult }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-3">
      {data.questions.map((q, i) => {
        const diffCls = DIFF_CLASS[q.difficulty] ?? "text-muted bg-muted/10";
        return (
          <div key={i} className="rounded overflow-hidden border border-border">
            <button
              type="button"
              className="w-full text-left px-4 py-3 flex items-center gap-3 bg-bg"
              onClick={() => setOpen(open === i ? null : i)}
            >
              <span className={`text-xs uppercase font-bold px-2 py-0.5 rounded flex-shrink-0 ${diffCls}`}>
                {q.difficulty}
              </span>
              <span className="text-sm text-primary">{q.question}</span>
              <span className="ml-auto text-muted">{open === i ? "▲" : "▼"}</span>
            </button>
            {open === i && (
              <div className="px-4 py-3 flex flex-col gap-3 bg-surface">
                {q.hint && (
                  <p className="text-xs text-warning">
                    <span className="font-semibold">Hint:</span> {q.hint}
                  </p>
                )}
                <div>
                  <p className="text-xs font-semibold mb-1 text-success">Answer</p>
                  <p className="text-sm leading-relaxed text-primary">{q.answer}</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</h3>
      {children}
    </div>
  );
}

function Chip({ label, value }: { label: string; value: string }) {
  return (
    <span className="text-xs px-3 py-1 rounded bg-bg border border-border text-primary">
      <span className="text-muted">{label}:</span> {value}
    </span>
  );
}

function Empty() {
  return (
    <p className="text-sm py-8 text-center text-muted">
      Run an analysis to see results here.
    </p>
  );
}

// ── Markdown report builder ───────────────────────────────────────────────────

function buildMarkdownReport(analysis: AnalysisResult | null, props: TabState): string {
  if (!analysis) return "";
  const lines: string[] = [
    `# Code Review Report`,
    ``,
    `**Language:** ${analysis.language_detected}  `,
    `**Time complexity:** ${analysis.complexity_analysis.time}  `,
    `**Space complexity:** ${analysis.complexity_analysis.space}`,
    ``,
    `## Summary`,
    analysis.summary,
    ``,
    `## What It Does`,
    analysis.what_it_does,
    ``,
    `## Execution Flow`,
    analysis.execution_flow,
    ``,
    `## Potential Issues`,
    ...analysis.potential_issues.map((i) => `- ${i}`),
    ``,
    `## Fixed Version`,
    "```",
    analysis.fixed_version,
    "```",
    ``,
    `## Suggested Improvements`,
    ...analysis.suggested_improvements.map((i) => `- ${i}`),
    ``,
    `## Best Practices`,
    ...analysis.best_practices.map((i) => `- ${i}`),
    ``,
    `## Key Takeaways`,
    ...analysis.key_takeaways.map((i) => `- ${i}`),
  ];

  if (props.tests) {
    lines.push(``, `## Unit Tests (${props.tests.test_framework})`, "```", props.tests.tests, "```");
  }
  if (props.docs) {
    lines.push(``, `## Documentation`, props.docs.readme_section);
  }
  if (props.security) {
    lines.push(``, `## Security — Risk: ${props.security.risk_level.toUpperCase()}`, props.security.summary);
    for (const v of props.security.vulnerabilities) {
      lines.push(``, `### [${v.severity.toUpperCase()}] ${v.title}`, v.description, `**Remediation:** ${v.remediation}`);
    }
  }
  return lines.join("\n");
}
