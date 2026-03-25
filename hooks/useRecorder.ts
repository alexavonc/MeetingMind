"use client";

import { useState, useRef, useCallback } from "react";

export type RecorderState = "idle" | "recording" | "stopped";

const MIME_TYPE = typeof window !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
  ? "audio/webm;codecs=opus"
  : typeof window !== "undefined" && MediaRecorder.isTypeSupported("audio/mp4")
  ? "audio/mp4"
  : "audio/webm";

export function useRecorder() {
  const [state, setState] = useState<RecorderState>("idle");
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [levels, setLevels] = useState<number[]>(new Array(24).fill(0));

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const animFrameRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setDuration(0);
    setLevels(new Array(24).fill(0));
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      streamRef.current = stream;

      // Waveform analyser
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);

      function tick() {
        analyser.getByteFrequencyData(data);
        // Take 24 evenly-spaced samples, normalise to 0–1
        const step = Math.floor(data.length / 24);
        const sampled = Array.from({ length: 24 }, (_, i) => data[i * step] / 255);
        setLevels(sampled);
        animFrameRef.current = requestAnimationFrame(tick);
      }
      tick();

      // MediaRecorder — collect chunks every 250ms
      const mime = MIME_TYPE;
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorderRef.current = recorder;
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mime });
        setAudioBlob(blob);
        cleanup();
        setLevels(new Array(24).fill(0));
      };
      recorder.start(250);
      setState("recording");

      // Timer
      startTimeRef.current = Date.now();
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message.includes("Permission")
            ? "Microphone permission denied. Allow access in your browser settings."
            : err.message
          : "Could not access microphone"
      );
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    cleanup();
    setState("stopped");
  }, [cleanup]);

  const reset = useCallback(() => {
    if (recorderRef.current?.state === "recording") {
      recorderRef.current.stop();
    }
    cleanup();
    setState("idle");
    setAudioBlob(null);
    setDuration(0);
    setError(null);
    setLevels(new Array(24).fill(0));
  }, [cleanup]);

  /** Convert the recorded blob to a File so it can be passed to processUpload */
  const toFile = useCallback(
    (filename: string): File | null => {
      if (!audioBlob) return null;
      const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
      return new File([audioBlob], `${filename}.${ext}`, { type: audioBlob.type });
    },
    [audioBlob]
  );

  return { state, duration, audioBlob, error, levels, start, stop, reset, toFile };
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}
