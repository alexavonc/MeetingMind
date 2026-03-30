"use client";

import { X, Zap, Mic, GitBranch, AlignLeft, FileAudio } from "lucide-react";
import type { Meeting } from "@/types";
import type { TranscriptionProvider } from "@/types";
import { estimateMeetingCost, formatUSD } from "@/lib/costs";

const PROVIDER_LABELS: Record<TranscriptionProvider, string> = {
  groq: "Groq",
  openai: "OpenAI",
  huggingface: "HuggingFace",
};

const ROW_ICONS = [
  <Mic key="mic" className="w-3.5 h-3.5" />,
  <FileAudio key="fa" className="w-3.5 h-3.5" />,
  <AlignLeft key="al" className="w-3.5 h-3.5" />,
  <GitBranch key="gb" className="w-3.5 h-3.5" />,
];

interface Props {
  meeting: Meeting;
  provider: TranscriptionProvider;
  onClose: () => void;
}

export default function CostModal({ meeting, provider, onClose }: Props) {
  const breakdown = estimateMeetingCost(meeting, provider);
  const rows = [
    breakdown.transcription,
    breakdown.diarise,
    breakdown.summarise,
    breakdown.flowchart,
  ];

  const pct = (cost: number) =>
    breakdown.total > 0 ? (cost / breakdown.total) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative z-10 w-full sm:max-w-md bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Cost breakdown</h2>
          </div>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Meeting label */}
        <div className="px-5 pt-4 pb-2">
          <p className="text-xs text-muted-foreground truncate">
            {meeting.title} · {meeting.date} · {meeting.duration} · {PROVIDER_LABELS[provider]}
          </p>
        </div>

        {/* Rows */}
        <div className="px-5 pb-2 space-y-3">
          {rows.map((row, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <span className="text-muted-foreground">{ROW_ICONS[i]}</span>
                  {row.label}
                </div>
                <span className="text-sm font-mono font-medium tabular-nums text-foreground">
                  {formatUSD(row.cost)}
                </span>
              </div>
              {/* Progress bar */}
              <div className="h-1 rounded-full bg-secondary overflow-hidden mb-1">
                <div
                  className="h-full rounded-full bg-primary/70 transition-all"
                  style={{ width: `${pct(row.cost)}%` }}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">{row.detail}</p>
            </div>
          ))}
        </div>

        {/* Total */}
        <div className="mx-5 my-4 p-3 rounded-xl bg-primary/8 border border-primary/20 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total estimated cost</span>
          <span className="text-lg font-bold font-mono text-primary tabular-nums">
            {formatUSD(breakdown.total)}
          </span>
        </div>

        <p className="px-5 pb-5 text-[11px] text-muted-foreground leading-relaxed">
          Estimates based on token counts derived from stored text. Actual billed amounts may vary slightly. Does not include re-processing runs.
        </p>
      </div>
    </div>
  );
}
