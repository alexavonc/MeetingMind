"use client";

import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
}

// Parse "• [0:45] Leon T — we discussed..." into parts
function parseBullet(line: string) {
  const text = line.replace(/^[•\-*]\s*/, "").trim();
  const m = text.match(/^\[(\d+:\d+)\]\s+(.+?)\s+[—\-]{1,2}\s+(.+)$/);
  if (m) return { time: m[1], speaker: m[2], point: m[3] };
  // Fallback: no structured prefix
  return { time: null, speaker: null, point: text };
}

export default function PointersView({ meeting }: Props) {
  if (!meeting.pointers) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <div className="w-5 h-5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">
          Pointers are being generated…
        </p>
        <p className="text-xs text-muted-foreground/60">
          This tab will populate shortly — no need to wait here.
        </p>
      </div>
    );
  }

  const lines = meeting.pointers
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[•\-*]/.test(l) || /^\[\d+:\d+\]/.test(l));

  if (lines.length === 0) {
    return (
      <pre className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
        {meeting.pointers}
      </pre>
    );
  }

  return (
    <div className="divide-y divide-border/50">
      {lines.map((line, i) => {
        const { time, speaker, point } = parseBullet(line);
        return (
          <div
            key={i}
            className="flex gap-3 py-2.5 px-1 hover:bg-secondary/30 transition-colors rounded-lg"
          >
            {time ? (
              <span className="flex-shrink-0 font-mono text-[11px] text-primary/70 mt-0.5 w-10 text-right">
                {time}
              </span>
            ) : (
              <span className="flex-shrink-0 text-primary/40 mt-1 text-xs w-10 text-right">•</span>
            )}
            <div className="flex-1 min-w-0">
              {speaker && (
                <span className="text-[11px] font-medium text-muted-foreground mr-1.5">
                  {speaker}
                </span>
              )}
              <span className="text-sm text-foreground/90 leading-relaxed">{point}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
