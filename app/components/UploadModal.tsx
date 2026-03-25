"use client";

import { useState, useRef, type DragEvent } from "react";
import { Upload, FileAudio, X, ChevronDown } from "lucide-react";
import type { Folder } from "@/types";
import type { ProcessingState } from "@/types";
import ProcessingSteps from "./ProcessingSteps";

const FOLDERS: { value: Folder; label: string }[] = [
  { value: "govtech", label: "Govtech" },
  { value: "flow-three", label: "flow-three" },
  { value: "personal", label: "Personal" },
];

interface Props {
  open: boolean;
  onClose: () => void;
  processing: ProcessingState;
  onSubmit: (input: File | string, title: string, folder: Folder) => Promise<void>;
}

type Mode = "audio" | "text";

export default function UploadModal({ open, onClose, processing, onSubmit }: Props) {
  const [mode, setMode] = useState<Mode>("audio");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<Folder>("govtech");
  const [file, setFile] = useState<File | null>(null);
  const [rawText, setRawText] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const canSubmit =
    title.trim() &&
    (mode === "audio" ? !!file : rawText.trim().length > 50) &&
    !processing.active;

  async function handleSubmit() {
    if (!canSubmit) return;
    try {
      await onSubmit(mode === "audio" ? file! : rawText, title.trim(), folder);
      if (!processing.error) {
        reset();
        onClose();
      }
    } catch {
      // error displayed in ProcessingSteps
    }
  }

  function reset() {
    setTitle("");
    setFile(null);
    setRawText("");
    setMode("audio");
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) setFile(dropped);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!processing.active ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">New Meeting</h2>
          {!processing.active && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 py-5 space-y-5">
          {processing.active || processing.step === "done" ? (
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
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground
                    placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                    className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground
                      appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {FOLDERS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Mode toggle */}
              <div className="flex rounded-lg bg-secondary p-1 gap-1">
                {(["audio", "text"] as Mode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`flex-1 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      mode === m
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m === "audio" ? "Audio file" : "Paste transcript"}
                  </button>
                ))}
              </div>

              {mode === "audio" ? (
                <div
                  onDrop={handleDrop}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onClick={() => fileRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50 hover:bg-secondary/30"
                  }`}
                >
                  <input
                    ref={fileRef}
                    type="file"
                    accept="audio/*,.m4a,.mp3,.wav,.mp4"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && setFile(e.target.files[0])}
                  />
                  {file ? (
                    <div className="space-y-1">
                      <FileAudio className="w-8 h-8 text-primary mx-auto" />
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(file.size / 1024 / 1024).toFixed(1)} MB
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Upload className="w-8 h-8 text-muted-foreground mx-auto" />
                      <p className="text-sm text-foreground">Drop audio file here</p>
                      <p className="text-xs text-muted-foreground">
                        or click to browse — m4a, mp3, wav, mp4
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste raw transcript text here…"
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground
                    placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring
                    resize-none font-mono"
                />
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!processing.active && (
          <div className="px-6 pb-5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
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
