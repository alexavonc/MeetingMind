"use client";

import { Monitor } from "lucide-react";
import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
}

function parseBullet(line: string) {
  const text = line.replace(/^[•\-*]\s*/, "").trim();
  const m = text.match(/^\[(\d+:\d+(?::\d+)?)\]\s+(.+?)\s+[—\-]{1,2}\s+(.+)$/);
  if (m) return { time: m[1], speaker: m[2], point: m[3] };
  return { time: null, speaker: null, point: text };
}

function toSeconds(ts: string): number {
  const parts = ts.split(":").map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  return parts[0] * 60 + (parts[1] ?? 0);
}

function fmtSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function activeFrameAt(
  frames: { url: string; timestamp: number }[],
  atSeconds: number
): { url: string; timestamp: number } | null {
  let result: { url: string; timestamp: number } | null = null;
  for (const f of frames) {
    if (f.timestamp <= atSeconds) result = f;
    else break;
  }
  return result;
}

type FlowItem =
  | { kind: "screen"; url: string; timestamp: number }
  | { kind: "point"; time: string | null; speaker: string | null; point: string };

export default function PointByPointFlowView({ meeting }: Props) {
  if (!meeting.pointers) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <div className="w-5 h-5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Pointers are being generated…</p>
        <p className="text-xs text-muted-foreground/60">
          This will populate shortly — no need to wait here.
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
      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{meeting.pointers}</p>
    );
  }

  const frames = [...(meeting.frameurls ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  const hasFrames = frames.length > 0;
  let lastShownUrl: string | null = null;

  // Build a flat list of items: screen cards + pointer cards in order
  const items: FlowItem[] = [];
  for (const line of lines) {
    const parsed = parseBullet(line);
    if (hasFrames && parsed.time) {
      const frame = activeFrameAt(frames, toSeconds(parsed.time));
      if (frame && frame.url !== lastShownUrl) {
        lastShownUrl = frame.url;
        items.push({ kind: "screen", url: frame.url, timestamp: frame.timestamp });
      }
    }
    items.push({ kind: "point", ...parsed });
  }

  return (
    <div className="py-2">
      {items.map((item, i) => (
        <div key={i}>
          {/* Connector arrow — not before the very first item */}
          {i > 0 && (
            <div className="flex justify-center">
              <div className="flex flex-col items-center">
                <div className="w-px h-5 bg-border" />
                <div
                  className="w-0 h-0"
                  style={{
                    borderLeft: "5px solid transparent",
                    borderRight: "5px solid transparent",
                    borderTop: "6px solid hsl(var(--border))",
                  }}
                />
              </div>
            </div>
          )}

          {item.kind === "screen" ? (
            /* ── Screenshot card ── */
            <div className="mx-auto w-full max-w-lg rounded-xl border-2 border-primary/25 overflow-hidden bg-secondary/20 shadow-sm">
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="block group">
                <img
                  src={item.url}
                  alt={`Screen at ${fmtSeconds(item.timestamp)}`}
                  className="w-full object-cover group-hover:opacity-90 transition-opacity"
                />
              </a>
              <div className="px-3 py-1.5 flex items-center gap-1.5 bg-secondary/40">
                <Monitor className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                <span className="text-[11px] font-mono text-muted-foreground">
                  {fmtSeconds(item.timestamp)}
                </span>
              </div>
            </div>
          ) : (
            /* ── Pointer card ── */
            <div className="mx-auto w-full max-w-lg rounded-lg border border-border bg-card px-4 py-3 shadow-sm">
              <div className="flex items-start gap-2.5">
                {item.time && (
                  <span className="flex-shrink-0 font-mono text-[11px] text-primary/70 mt-0.5 w-9 text-right">
                    {item.time}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  {item.speaker && (
                    <div className="text-[11px] font-semibold text-muted-foreground mb-0.5">
                      {item.speaker}
                    </div>
                  )}
                  <p className="text-sm text-foreground/90 leading-relaxed">{item.point}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
