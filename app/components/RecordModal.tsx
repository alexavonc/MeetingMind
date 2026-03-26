"use client";

import { useState } from "react";
import { Mic, Square, X, ChevronDown, RotateCcw } from "lucide-react";
import { useRecorder, formatDuration } from "@/hooks/useRecorder";
import ProcessingSteps from "./ProcessingSteps";
import type { Folder, ProcessingState } from "@/types";

const FOLDERS: { value: Folder; label: string }[] = [
  { value: "govtech", label: "Govtech" },
  { value: "flow-three", label: "flow-three" },
  { value: "personal", label: "Personal" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  processing: ProcessingState;
  onSubmit: (file: File, title: string, folder: Folder) => Promise<void>;
}

export default function RecordModal({ open, onClose, processing, onSubmit }: Props) {
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<Folder>("govtech");
  const { state, duration, error: recError, levels, start, stop, reset, toFile } = useRecorder();

  if (!open) return null;

  function handleClose() {
    if (processing.active) return;
    reset();
    setTitle("");
    onClose();
  }

  async function handleProcess() {
    const file = toFile(title.trim() || "recording");
    if (!file || !title.trim()) return;
    try {
      await onSubmit(file, title.trim(), folder);
      reset();
      setTitle("");
      onClose();
    } catch {
      // error shown in ProcessingSteps
    }
  }

  const canProcess = state === "stopped" && title.trim() && !processing.active;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!processing.active && state !== "recording" ? handleClose : undefined}
      />
      <div className="relative z-10 w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Record Meeting</h2>
          {!processing.active && state !== "recording" && (
            <button type="button" onClick={handleClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {processing.active ? (
            <ProcessingSteps currentStep={processing.step} error={processing.error} />
          ) : (
            <>
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Meeting title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. GovTech Design Review"
                  disabled={state === "recording"}
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground
                    placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring
                    disabled:opacity-50"
                />
              </div>

              {/* Folder */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">
                  Folder
                </label>
                <div className="relative">
                  <select
                    value={folder}
                    onChange={(e) => setFolder(e.target.value as Folder)}
                    disabled={state === "recording"}
                    className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground
                      appearance-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                  >
                    {FOLDERS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Recorder */}
              <div className="rounded-xl border border-border bg-secondary/30 p-5">
                {/* Waveform */}
                <div className="flex items-center justify-center gap-0.5 h-12 mb-4">
                  {levels.map((level, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-full transition-all duration-75"
                      style={{
                        height: `${Math.max(4, level * 44)}px`,
                        background: state === "recording"
                          ? `hsl(${258 + level * 10} 89% ${55 + level * 15}%)`
                          : "hsl(var(--border))",
                      }}
                    />
                  ))}
                </div>

                {/* Timer */}
                <div className="text-center mb-5">
                  <span className={`font-mono text-2xl font-semibold tabular-nums ${
                    state === "recording" ? "text-red-400" : "text-muted-foreground"
                  }`}>
                    {formatDuration(duration)}
                  </span>
                  {state === "recording" && (
                    <span className="ml-2 inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  )}
                  {state === "stopped" && (
                    <p className="text-xs text-emerald-600 mt-1">Recording complete</p>
                  )}
                </div>

                {/* Controls */}
                <div className="flex items-center justify-center gap-3">
                  {state === "idle" && (
                    <button
                      type="button"
                      onClick={start}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-red-500 hover:bg-red-400
                        text-white font-medium text-sm transition-colors"
                    >
                      <Mic className="w-4 h-4" />
                      Start recording
                    </button>
                  )}
                  {state === "recording" && (
                    <button
                      type="button"
                      onClick={stop}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-secondary hover:bg-secondary/80
                        border border-border text-foreground font-medium text-sm transition-colors"
                    >
                      <Square className="w-4 h-4 fill-current" />
                      Stop
                    </button>
                  )}
                  {state === "stopped" && (
                    <button
                      type="button"
                      onClick={reset}
                      className="flex items-center gap-2 px-4 py-2 rounded-full text-sm text-muted-foreground
                        hover:text-foreground border border-border hover:border-foreground/30 transition-colors"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Re-record
                    </button>
                  )}
                </div>
              </div>

              {recError && (
                <p className="text-xs text-destructive">{recError}</p>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!processing.active && (
          <div className="px-6 pb-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={state === "recording"}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleProcess}
              disabled={!canProcess}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground
                hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              Process meeting
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
