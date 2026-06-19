"use client";

import { useState } from "react";

export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={[
        "text-xs px-3 py-1 rounded border transition-colors bg-transparent",
        copied
          ? "border-success text-success"
          : "border-border text-muted hover:border-accent hover:text-accent",
      ].join(" ")}
    >
      {copied ? "Copied!" : label}
    </button>
  );
}
