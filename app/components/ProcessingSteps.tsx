"use client";

import { Check, Loader2, X } from "lucide-react";
import type { ProcessingStep } from "@/types";

const STEPS: { key: ProcessingStep; label: string }[] = [
  { key: "transcribing", label: "Transcribing audio with Whisper" },
  { key: "diarising", label: "Diarising speakers with Claude" },
  { key: "summarising", label: "Generating summary + action items" },
  { key: "flowcharting", label: "Building flowchart" },
  { key: "saving", label: "Saving to library" },
];

const ORDER = STEPS.map((s) => s.key);

interface Props {
  currentStep: ProcessingStep | null;
  error: string | null;
  detail?: string;
}

export default function ProcessingSteps({ currentStep, error, detail }: Props) {
  const currentIdx = currentStep ? ORDER.indexOf(currentStep) : -1;

  return (
    <div className="space-y-2 py-2">
      {STEPS.map((step, i) => {
        const isPast = i < currentIdx;
        const isCurrent = i === currentIdx;
        const isFuture = i > currentIdx;

        return (
          <div key={step.key} className="flex items-center gap-3">
            <div
              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all ${
                isPast
                  ? "bg-emerald-100 text-emerald-600 border border-emerald-200"
                  : isCurrent
                  ? "bg-primary/10 text-primary border border-primary/30"
                  : "bg-secondary text-muted-foreground border border-border"
              }`}
            >
              {isPast ? (
                <Check className="w-3 h-3" />
              ) : isCurrent ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <span>{i + 1}</span>
              )}
            </div>
            <span
              className={`text-sm ${
                isPast
                  ? "text-emerald-600"
                  : isCurrent
                  ? "text-foreground font-medium"
                  : "text-muted-foreground"
              }`}
            >
              {step.label}
              {isCurrent && detail && (
                <span className="ml-1.5 text-xs font-normal text-muted-foreground">({detail})</span>
              )}
            </span>
          </div>
        );
      })}

      {error && (
        <div className="flex items-start gap-3 mt-3">
          <div className="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center bg-destructive/20 text-destructive border border-destructive/40">
            <X className="w-3 h-3" />
          </div>
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}
    </div>
  );
}
