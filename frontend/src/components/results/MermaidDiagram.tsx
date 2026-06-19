"use client";

import { useEffect, useRef, useState } from "react";

interface MermaidDiagramProps {
  chart: string;
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chart || !ref.current) return;
    let cancelled = false;

    (async () => {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            background: "#0d1117",
            primaryColor: "#1f6feb",
            primaryTextColor: "#e6edf3",
            primaryBorderColor: "#30363d",
            lineColor: "#8b949e",
            secondaryColor: "#161b22",
            tertiaryColor: "#161b22",
          },
        });
        const id = `mermaid-${Date.now()}`;
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && ref.current) {
          ref.current.innerHTML = svg;
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to render diagram");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [chart]);

  if (error) {
    return (
      <div className="rounded p-4 text-sm bg-surface border border-border">
        <p className="font-semibold mb-2 text-danger">Diagram render error</p>
        <pre className="whitespace-pre-wrap text-xs text-muted">{chart}</pre>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="rounded overflow-auto p-4 bg-surface border border-border"
    />
  );
}
