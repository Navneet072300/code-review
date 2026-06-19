"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import type { Components } from "react-markdown";

const components: Components = {
  code({ className, children, ...props }) {
    const match = /language-(\w+)/.exec(className ?? "");
    const content = String(children);
    const isBlock = content.includes("\n");
    if (isBlock && match) {
      return (
        <SyntaxHighlighter style={oneDark} language={match[1]} PreTag="div">
          {content.replace(/\n$/, "")}
        </SyntaxHighlighter>
      );
    }
    return (
      <code
        className={`${className ?? ""} text-accent bg-surface px-1 rounded`}
        {...props}
      >
        {children}
      </code>
    );
  },
};

export function MarkdownBlock({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {content}
    </ReactMarkdown>
  );
}
