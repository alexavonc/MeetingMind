"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
  onRecoverFrames?: () => Promise<boolean>;
}

function parseBullet(line: string) {
  const text = line.replace(/^[•\-*]\s*/, "").trim();
  const m = text.match(/^\[(\d+:\d+(?::\d+)?)\]\s+(.+?)\s+[—\-]{1,2}\s+(.+)$/);
  if (m) return { time: m[1], speaker: m[2], point: m[3] };
  return { time: null, speaker: null, point: text };
}

/** "1:23" or "1:23:45" → seconds */
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

/** Returns the most recent frame at or before `atSeconds`, or null. */
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

export default function PointersView({ meeting, onRecoverFrames }: Props) {
  const [recovering, setRecovering] = useState(false);
  const [recoverResult, setRecoverResult] = useState<"found" | "none" | null>(null);
  if (!meeting.pointers) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-2">
        <div className="w-5 h-5 rounded-full border-2 border-primary/40 border-t-primary animate-spin" />
        <p className="text-sm text-muted-foreground">Pointers are being generated…</p>
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

  // Frames sorted ascending by timestamp (should already be, but be safe)
  const frames = [...(meeting.frameurls ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  const hasFrames = frames.length > 0;

  // Track which frame URL we last showed so we only display on screen-change
  let lastShownUrl: string | null = null;

  async function handleRecover() {
    if (!onRecoverFrames) return;
    setRecovering(true);
    const found = await onRecoverFrames();
    setRecoverResult(found ? "found" : "none");
    setRecovering(false);
  }

  return (
    <div>
      {/* Recovery banner — shown when frames are missing but may exist in Storage */}
      {!hasFrames && meeting.videourl && onRecoverFrames && recoverResult !== "none" && (
        <div className="mb-4 flex items-center gap-3 p-3 rounded-lg bg-secondary/60 border border-border text-sm">
          <span className="text-muted-foreground flex-1">
            {recoverResult === "found"
              ? "Screenshots restored — scroll down to see them."
              : "Screenshots from this video recording may still be in storage."}
          </span>
          {recoverResult !== "found" && (
            <button
              type="button"
              onClick={handleRecover}
              disabled={recovering}
              className="flex-shrink-0 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium
                hover:bg-primary/90 disabled:opacity-60 transition-colors"
            >
              {recovering ? "Recovering…" : "Recover screenshots"}
            </button>
          )}
        </div>
      )}
      {lines.map((line, i) => {
        const { time, speaker, point } = parseBullet(line);

        let screenshotEl: ReactNode = null;
        if (hasFrames && time) {
          const secs = toSeconds(time);
          const frame = activeFrameAt(frames, secs);
          if (frame && frame.url !== lastShownUrl) {
            lastShownUrl = frame.url;
            screenshotEl = (
              <div className="pt-4 pb-1">
                <a href={frame.url} target="_blank" rel="noopener noreferrer" className="block group">
                  <img
                    src={frame.url}
                    alt={`Screen at ${fmtSeconds(frame.timestamp)}`}
                    className="rounded-xl border border-border w-full max-w-sm object-cover
                      group-hover:border-primary/50 transition-colors"
                  />
                </a>
                <span className="text-[11px] font-mono text-muted-foreground mt-1 block">
                  {fmtSeconds(frame.timestamp)}
                </span>
              </div>
            );
          }
        }

        return (
          <div key={i}>
            {screenshotEl}
            <div className="flex gap-3 py-2.5 px-1 hover:bg-secondary/30 transition-colors rounded-lg">
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
          </div>
        );
      })}
    </div>
  );
}
