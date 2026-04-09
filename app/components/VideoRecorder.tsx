"use client";

import { useState, useRef, useEffect } from "react";
import { Video, Square, Check } from "lucide-react";

interface Props {
  onRecorded: (file: File) => void;
  onCancel: () => void;
}

function getSupportedMimeType(): string {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4",
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export default function VideoRecorder({ onRecorded, onCancel }: Props) {
  const [phase, setPhase] = useState<"preview" | "recording" | "done">("preview");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");
  const videoRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let mounted = true;
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: true })
      .then((s) => {
        if (!mounted) { s.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = s;
        if (videoRef.current) {
          videoRef.current.srcObject = s;
          videoRef.current.muted = true; // prevent feedback during preview
        }
      })
      .catch(() =>
        setError("Camera/microphone access denied. Allow access in your browser settings and try again.")
      );
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  function startRecording() {
    if (!streamRef.current) return;
    chunksRef.current = [];
    const mimeType = getSupportedMimeType();
    const mr = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined);

    mr.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };

    mr.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || "video/webm" });
      const ext = mr.mimeType.includes("mp4") ? "mp4" : "webm";
      const file = new File([blob], `recording-${Date.now()}.${ext}`, { type: blob.type });
      onRecorded(file);
    };

    mr.start(250); // collect in 250ms chunks for smooth data
    recorderRef.current = mr;
    setPhase("recording");
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  }

  function stopRecording() {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    setPhase("done");
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground underline hover:text-foreground transition-colors">
          Go back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Live preview */}
      <div className="relative rounded-xl overflow-hidden bg-black aspect-video border border-border">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        {phase === "recording" && (
          <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-black/70 rounded-full px-2.5 py-1">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white text-xs font-mono">{fmt(elapsed)}</span>
          </div>
        )}
        {phase === "done" && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-emerald-500 rounded-full p-3">
              <Check className="w-6 h-6 text-white" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-2">
        {phase === "preview" && (
          <>
            <button
              type="button"
              onClick={startRecording}
              className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition-colors"
            >
              <Video className="w-4 h-4" />
              Start Recording
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
          </>
        )}

        {phase === "recording" && (
          <button
            type="button"
            onClick={stopRecording}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-foreground text-background text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Square className="w-4 h-4 fill-current" />
            Stop Recording
          </button>
        )}

        {phase === "done" && (
          <p className="flex-1 text-center text-sm text-emerald-600 font-medium py-2">
            Recording saved — fill in the title and click Process
          </p>
        )}
      </div>
    </div>
  );
}
