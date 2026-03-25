"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
  onRegenerate: () => Promise<void>;
  hasApiKey: boolean;
}

export default function FlowchartView({ meeting, onRegenerate, hasApiKey }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);

  useEffect(() => {
    if (!meeting.flow || !containerRef.current) return;

    let cancelled = false;
    setRendered(false);
    setError(null);

    async function render() {
      try {
        const mermaid = (await import("mermaid")).default;
        mermaid.initialize({
          startOnLoad: false,
          theme: "dark",
          themeVariables: {
            darkMode: true,
            background: "transparent",
            primaryColor: "#1e40af",
            primaryTextColor: "#e2e8f0",
            primaryBorderColor: "#3b82f6",
            lineColor: "#64748b",
            secondaryColor: "#1e293b",
            tertiaryColor: "#0f172a",
          },
        });

        const id = `mermaid-${meeting.id}`;
        const { svg } = await mermaid.render(id, meeting.flow);
        if (!cancelled && containerRef.current) {
          containerRef.current.innerHTML = svg;
          setRendered(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Render error");
        }
      }
    }

    render();
    return () => {
      cancelled = true;
    };
  }, [meeting.flow, meeting.id]);

  async function handleRegenerate() {
    setLoading(true);
    setError(null);
    try {
      await onRegenerate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to regenerate");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Auto-generated from meeting content
        </p>
        {hasApiKey && (
          <button
            type="button"
            onClick={handleRegenerate}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium
              bg-secondary hover:bg-secondary/80 text-foreground border border-border
              transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {loading ? "Regenerating…" : "Regenerate"}
          </button>
        )}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-destructive/20 border border-destructive/40 text-sm text-destructive-foreground">
          {error}
        </div>
      )}

      {meeting.flow ? (
        <div
          ref={containerRef}
          className="mermaid-container w-full overflow-x-auto rounded-xl bg-secondary/30 p-4 min-h-48"
          aria-label="Meeting flowchart"
        />
      ) : (
        <div className="flex items-center justify-center h-48 rounded-xl bg-secondary/30 text-muted-foreground text-sm">
          No flowchart generated yet
          {hasApiKey && " — click Regenerate to create one"}
        </div>
      )}
    </div>
  );
}
