"use client";

import type { CSSProperties } from "react";
import { Monitor } from "lucide-react";
import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
}

interface PointGroup {
  title: string;
  timestamp?: string;
  points: string[];
}

function parseGroups(json: string): PointGroup[] | null {
  try {
    const data = JSON.parse(json) as { groups: PointGroup[] };
    if (!Array.isArray(data.groups)) return null;
    return data.groups;
  } catch {
    return null;
  }
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

const ARROW: CSSProperties = {
  width: 0,
  height: 0,
  borderLeft: "5px solid transparent",
  borderRight: "5px solid transparent",
  borderTop: "6px solid hsl(var(--border))",
};

function VArrow() {
  return (
    <div className="flex justify-center">
      <div className="flex flex-col items-center">
        <div className="w-px h-5 bg-border" />
        <div style={ARROW} />
      </div>
    </div>
  );
}

function Stem() {
  return (
    <div className="flex justify-center">
      <div className="w-px h-5 bg-border" />
    </div>
  );
}

function ScreenCard({ url, timestamp }: { url: string; timestamp: number }) {
  return (
    <div className="mx-auto w-full max-w-lg rounded-xl border-2 border-primary/25 overflow-hidden bg-secondary/20 shadow-sm">
      <a href={url} target="_blank" rel="noopener noreferrer" className="block group">
        <img
          src={url}
          alt={`Screen at ${fmtSeconds(timestamp)}`}
          className="w-full object-cover group-hover:opacity-90 transition-opacity"
        />
      </a>
      <div className="px-3 py-1.5 flex items-center gap-1.5 bg-secondary/40">
        <Monitor className="w-3 h-3 text-muted-foreground flex-shrink-0" />
        <span className="text-[11px] font-mono text-muted-foreground">{fmtSeconds(timestamp)}</span>
      </div>
    </div>
  );
}

function SubPointCard({
  time,
  speaker,
  point,
}: {
  time: string | null;
  speaker: string | null;
  point: string;
}) {
  return (
    <div className="w-full rounded-lg border border-border bg-card px-2.5 py-2 shadow-sm">
      {time && (
        <div className="font-mono text-[10px] text-primary/60 mb-0.5 text-center">{time}</div>
      )}
      {speaker && (
        <div className="text-[10px] font-semibold text-muted-foreground mb-0.5 text-center">
          {speaker}
        </div>
      )}
      <p className="text-[11px] text-foreground/90 leading-snug text-center">{point}</p>
    </div>
  );
}

export default function PointByPointFlowView({ meeting }: Props) {
  const groups = meeting.pointgroups ? parseGroups(meeting.pointgroups) : null;

  if (!groups && !meeting.pointers) {
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

  const frames = [...(meeting.frameurls ?? [])].sort((a, b) => a.timestamp - b.timestamp);
  const hasFrames = frames.length > 0;
  let lastShownUrl: string | null = null;

  // ── Grouped hierarchical flowchart ────────────────────────────────────────
  if (groups) {
    return (
      <div className="py-2 max-w-2xl mx-auto">
        {groups.map((group, gi) => {
          const parsed = group.points.map(parseBullet);
          const groupTs = group.timestamp ?? parsed.find((p) => p.time)?.time ?? null;
          const groupSecs = groupTs ? toSeconds(groupTs) : null;

          const frame = hasFrames && groupSecs !== null ? activeFrameAt(frames, groupSecs) : null;
          const showFrame = frame && frame.url !== lastShownUrl;
          if (showFrame) lastShownUrl = frame!.url;

          // Cap horizontal columns at 3 for readability
          const cols = Math.min(Math.max(parsed.length, 1), 3);

          return (
            <div key={gi}>
              {gi > 0 && <VArrow />}

              {showFrame && (
                <>
                  <ScreenCard url={frame!.url} timestamp={frame!.timestamp} />
                  <VArrow />
                </>
              )}

              {/* Main theme bubble */}
              <div className="mx-auto w-full max-w-lg rounded-xl border-2 border-primary/30 bg-primary/[0.07] px-5 py-3.5 shadow-sm text-center">
                <p className="text-sm font-bold text-primary leading-snug">{group.title}</p>
                {groupTs && (
                  <span className="text-[10px] font-mono text-primary/50 mt-0.5 block">
                    {groupTs}
                  </span>
                )}
              </div>

              {/* Sub-point cards branching below the bubble */}
              {parsed.length > 0 && (
                <div className="max-w-lg mx-auto">
                  <Stem />

                  {parsed.length === 1 ? (
                    <>
                      <div className="flex justify-center">
                        <div style={ARROW} />
                      </div>
                      <div className="mt-1">
                        <SubPointCard {...parsed[0]} />
                      </div>
                    </>
                  ) : (
                    <div className="relative">
                      {/* Horizontal trunk line spanning from center of col-1 to center of col-N */}
                      <div
                        className="absolute top-0 h-px bg-border"
                        style={{
                          left: `${100 / (cols * 2)}%`,
                          right: `${100 / (cols * 2)}%`,
                        }}
                      />
                      <div
                        className="grid gap-2"
                        style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
                      >
                        {parsed.map((pt, pi) => (
                          <div key={pi} className="flex flex-col items-center">
                            <div className="w-px h-5 bg-border" />
                            <div style={ARROW} />
                            <div className="w-full mt-1">
                              <SubPointCard {...pt} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  // ── Flat flow fallback (older meetings without pointgroups) ───────────────
  const lines = meeting.pointers!
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[•\-*]/.test(l) || /^\[\d+:\d+\]/.test(l));

  if (lines.length === 0) {
    return (
      <p className="text-xs text-muted-foreground whitespace-pre-wrap">{meeting.pointers}</p>
    );
  }

  type FlowItem =
    | { kind: "screen"; url: string; timestamp: number }
    | { kind: "point"; time: string | null; speaker: string | null; point: string };

  const items: FlowItem[] = [];
  for (const line of lines) {
    const p = parseBullet(line);
    if (hasFrames && p.time) {
      const f = activeFrameAt(frames, toSeconds(p.time));
      if (f && f.url !== lastShownUrl) {
        lastShownUrl = f.url;
        items.push({ kind: "screen", url: f.url, timestamp: f.timestamp });
      }
    }
    items.push({ kind: "point", ...p });
  }

  return (
    <div className="py-2">
      {items.map((item, i) => (
        <div key={i}>
          {i > 0 && <VArrow />}
          {item.kind === "screen" ? (
            <ScreenCard url={item.url} timestamp={item.timestamp} />
          ) : (
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
