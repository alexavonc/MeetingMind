"use client";

import { useState, useRef, type DragEvent } from "react";
import { Upload, FileAudio, X, ChevronDown, Plus } from "lucide-react";
import type { Folder } from "@/types";
import type { ProcessingState } from "@/types";
import ProcessingSteps from "./ProcessingSteps";

interface Props {
  open: boolean;
  onClose: () => void;
  processing: ProcessingState;
  onSubmit: (input: File | File[] | string, title: string, folder: Folder) => Promise<void>;
  onSubmitNotes: (notes: string, title: string, folder: Folder) => Promise<void>;
  folders: string[];
}

type Mode = "audio" | "text" | "notes";

const NOTES_PLACEHOLDER = `e.g.

Project Kickoff — Q3 Launch

Goals
• Ship mobile app by end of Q3
• Improve onboarding conversion by 20%
• Reduce support tickets

Blockers
• Design assets not finalised
• API integration still pending — Alice to unblock by Friday

Decisions
• Go with Option B for the nav structure
• Defer dark mode to Q4

Next Steps
• Alice — finalise design assets by Fri 18 Jul
• Bob — complete API docs and share with team
• Everyone — review PRD and add comments by EOD Wed`;

export default function UploadModal({ open, onClose, processing, onSubmit, onSubmitNotes, folders }: Props) {
  const [mode, setMode] = useState<Mode>("audio");
  const [title, setTitle] = useState("");
  const [folder, setFolder] = useState<Folder>("personal");
  const [files, setFiles] = useState<File[]>([]);
  const [rawText, setRawText] = useState("");
  const [notes, setNotes] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const GROQ_LIMIT_MB = 25;
  const oversizedFiles = files.filter(f => f.size > GROQ_LIMIT_MB * 1024 * 1024);
  const totalMB = files.reduce((sum, f) => sum + f.size, 0) / (1024 * 1024);

  const canSubmit =
    title.trim() &&
    !processing.active &&
    oversizedFiles.length === 0 &&
    (mode === "audio"
      ? files.length > 0
      : mode === "notes"
      ? notes.trim().length > 20
      : rawText.trim().length > 50);

  async function handleSubmit() {
    if (!canSubmit) return;
    try {
      if (mode === "notes") {
        await onSubmitNotes(notes, title.trim(), folder);
      } else {
        const input = mode === "audio"
          ? (files.length === 1 ? files[0] : files)
          : rawText;
        await onSubmit(input, title.trim(), folder);
      }
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
    setFiles([]);
    setRawText("");
    setNotes("");
    setMode("audio");
  }

  function addFiles(incoming: FileList | null) {
    if (!incoming) return;
    const audioFiles = Array.from(incoming).filter((f) => f.type.startsWith("audio/") || /\.(m4a|mp3|wav|mp4|ogg|webm|flac)$/i.test(f.name));
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name + f.size));
      return [...prev, ...audioFiles.filter((f) => !existing.has(f.name + f.size))];
    });
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }

  const totalMB = files.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024;

  const submitLabel =
    mode === "notes"
      ? "Generate flowchart"
      : files.length > 1
      ? `Process ${files.length} parts`
      : "Process meeting";

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={!processing.active ? onClose : undefined}
      />

      <div className="relative z-10 w-full sm:max-w-lg bg-card border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">New Meeting</h2>
          {!processing.active && (
            <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          {processing.active ? (
            <ProcessingSteps currentStep={processing.step} error={processing.error} detail={processing.detail} />
          ) : (
            <>
              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Meeting title</label>
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
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Folder</label>
                <div className="relative">
                  <select
                    value={folder}
                    onChange={(e) => setFolder(e.target.value as Folder)}
                    className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground
                      appearance-none focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    {folders.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Mode toggle */}
              <div className="flex rounded-lg bg-secondary p-1 gap-1">
                {(["audio", "text", "notes"] as Mode[]).map((m) => (
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
                    {m === "audio" ? "Audio" : m === "text" ? "Transcript" : "Notes"}
                  </button>
                ))}
              </div>

              {mode === "audio" ? (
                <div className="space-y-3">
                  {/* Drop zone */}
                  <div
                    onDrop={handleDrop}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onClick={() => fileRef.current?.click()}
                    className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                      dragOver
                        ? "border-primary bg-primary/10"
                        : "border-border hover:border-primary/50 hover:bg-secondary/30"
                    }`}
                  >
                    <input
                      ref={fileRef}
                      type="file"
                      accept="audio/*,.m4a,.mp3,.wav,.mp4"
                      multiple
                      className="hidden"
                      onChange={(e) => addFiles(e.target.files)}
                    />
                    <Upload className="w-7 h-7 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-foreground">Drop audio files here</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      or click to browse · multiple files merged into one meeting
                    </p>
                  </div>

                  {files.length > 0 && (
                    <div className="space-y-1.5">
                      {files.map((f, i) => (
                        <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/50 border border-border">
                          <span className="text-xs text-muted-foreground w-5 text-center flex-shrink-0 font-mono">{i + 1}</span>
                          <FileAudio className="w-4 h-4 text-primary flex-shrink-0" />
                          <span className="flex-1 text-sm text-foreground truncate">{f.name}</span>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{(f.size / 1024 / 1024).toFixed(1)} MB</span>
                          <button type="button" onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-muted-foreground hover:text-destructive transition-colors flex-shrink-0">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      <div className="flex items-center justify-between px-1">
                        <button type="button" onClick={() => fileRef.current?.click()} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors">
                          <Plus className="w-3 h-3" />
                          Add more
                        </button>
                        <span className="text-xs text-muted-foreground">{files.length} file{files.length > 1 ? "s" : ""} · {totalMB.toFixed(1)} MB total</span>
                      </div>
                      {oversizedFiles.length > 0 && (
                        <div className="mt-2 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 space-y-1">
                          <p className="font-semibold">File too large for Groq (25 MB limit)</p>
                          {oversizedFiles.map(f => (
                            <p key={f.name}>{f.name} — {(f.size / 1024 / 1024).toFixed(1)} MB</p>
                          ))}
                          <p className="text-red-600 mt-1">Compress it first: on Mac use <strong>QuickTime → Export → Audio Only</strong>, or split into multiple files under 25 MB each and upload together.</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : mode === "text" ? (
                <textarea
                  value={rawText}
                  onChange={(e) => setRawText(e.target.value)}
                  placeholder="Paste raw transcript text here…"
                  rows={6}
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm text-foreground
                    placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring
                    resize-none font-mono"
                />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Paste bullet-point notes, agendas, or any structured text. Claude will generate a summary, action items, and a flowchart that mirrors your structure.
                  </p>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={NOTES_PLACEHOLDER}
                    rows={10}
                    className="w-full px-3 py-2.5 rounded-lg bg-input border border-border text-sm text-foreground
                      placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring
                      resize-none leading-relaxed"
                  />
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!processing.active && (
          <div className="px-6 pb-5 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="px-4 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground
                hover:bg-primary/90 transition-colors disabled:opacity-40"
            >
              {submitLabel}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
