"use client";

import { TrendingUp } from "lucide-react";
import type { Meeting } from "@/types";
import type { TranscriptionProvider } from "@/types";
import { estimateTotalCost } from "@/lib/costs";

interface Props {
  meetings: Meeting[];
  provider: TranscriptionProvider;
}

export default function CostSummaryBar({ meetings, provider }: Props) {
  if (meetings.length === 0) return null;
  const total = estimateTotalCost(meetings, provider);
  const avg   = total / meetings.length;

  return (
    <div className="px-4 py-2.5 border-t border-border bg-secondary/20 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1.5 min-w-0">
        <TrendingUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-xs text-muted-foreground truncate">
          {meetings.length} meeting{meetings.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-xs font-semibold font-mono text-foreground">
          ~${total.toFixed(3)} total
        </p>
        <p className="text-[10px] text-muted-foreground font-mono">
          ~${avg.toFixed(3)} avg
        </p>
      </div>
    </div>
  );
}
