"use client";

export function DownloadButton({
  content,
  filename,
  label = "Download",
}: {
  content: string;
  filename: string;
  label?: string;
}) {
  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      className="text-xs px-3 py-1 rounded border border-border text-muted bg-transparent hover:border-accent hover:text-accent transition-colors"
    >
      {label}
    </button>
  );
}
