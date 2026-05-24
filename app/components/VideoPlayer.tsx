"use client";

import { useState, useRef, useEffect } from "react";
import {
  Play, Pause, Maximize2, Minimize2, X, VolumeX, Volume2,
  ChevronDown, ChevronUp, Expand,
} from "lucide-react";

interface Props {
  url: string;
  title?: string;
  onClose?: () => void;
}

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function VideoPlayer({ url, title, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [collapsed, setCollapsed] = useState(false);
  const [large, setLarge] = useState(false);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    const onTime = () => setCurrent(el.currentTime);
    const onMeta = () => setDuration(el.duration || 0);
    const onEnd = () => setPlaying(false);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    el.addEventListener("ended", onEnd);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
      el.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const el = videoRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { void el.play(); setPlaying(true); }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = videoRef.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setCurrent(Number(e.target.value));
  }

  function toggleMute() {
    const el = videoRef.current;
    if (!el) return;
    el.muted = !muted;
    setMuted(!muted);
  }

  function requestFullscreen() {
    videoRef.current?.requestFullscreen?.();
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  // ── Collapsed pill ────────────────────────────────────────────────────────
  if (collapsed) {
    return (
      <div className="fixed bottom-4 right-4 z-40 flex items-center gap-2
        bg-card border border-border rounded-full shadow-lg px-3 py-2">
        {/* Hidden video keeps playback state */}
        <video ref={videoRef} src={url} className="hidden" muted={muted} />
        <button type="button" onClick={toggle}
          className="text-foreground hover:text-primary transition-colors">
          {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
        <span className="text-xs text-muted-foreground max-w-[120px] truncate">
          {title ?? "Video"}
        </span>
        <button type="button" onClick={() => setCollapsed(false)} title="Expand"
          className="text-muted-foreground hover:text-foreground transition-colors">
          <ChevronUp className="w-4 h-4" />
        </button>
        {onClose && (
          <button type="button" onClick={onClose} title="Close"
            className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }

  // ── Large overlay ─────────────────────────────────────────────────────────
  if (large) {
    return (
      <div className="fixed inset-0 z-50 bg-black/90 flex flex-col items-center justify-center p-4">
        <video
          ref={videoRef}
          src={url}
          muted={muted}
          onClick={toggle}
          className="w-full max-h-[80vh] max-w-5xl rounded-lg object-contain cursor-pointer"
        />
        {/* Controls */}
        <div className="w-full max-w-5xl mt-3 space-y-2">
          {/* Seek */}
          <div className="relative h-1.5 rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 bg-white rounded-full transition-all"
              style={{ width: `${pct}%` }} />
            <input type="range" min={0} max={duration || 100} step={0.1} value={current}
              onChange={seek}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
              style={{ height: "24px", top: "-10px" }} />
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={toggle} className="text-white hover:text-white/80 transition-colors">
              {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </button>
            <button type="button" onClick={toggleMute} className="text-white hover:text-white/80 transition-colors">
              {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <span className="text-white/70 text-xs tabular-nums">
              {fmt(current)} / {duration > 0 ? fmt(duration) : "--:--"}
            </span>
            <div className="flex-1" />
            <button type="button" onClick={requestFullscreen} title="Fullscreen"
              className="text-white hover:text-white/80 transition-colors">
              <Expand className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setLarge(false)} title="Shrink"
              className="text-white hover:text-white/80 transition-colors">
              <Minimize2 className="w-4 h-4" />
            </button>
            {onClose && (
              <button type="button" onClick={onClose} title="Close"
                className="text-white hover:text-white/80 transition-colors">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ── Mini player (default) ─────────────────────────────────────────────────
  return (
    <div className="fixed bottom-4 right-4 z-40 w-72 bg-card border border-border rounded-xl shadow-2xl overflow-hidden">
      {/* Video area */}
      <div
        className="relative bg-black aspect-video cursor-pointer group"
        onClick={toggle}
      >
        <video
          ref={videoRef}
          src={url}
          muted={muted}
          className="w-full h-full object-contain"
        />
        {/* Play overlay */}
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center
            bg-black/20 group-hover:bg-black/30 transition-colors">
            <div className="w-11 h-11 rounded-full bg-black/50 flex items-center justify-center">
              <Play className="w-5 h-5 text-white ml-0.5" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="px-3 pt-2 pb-2.5 space-y-1.5">
        {/* Seek bar */}
        <div className="relative h-1 rounded-full bg-border">
          <div className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
            style={{ width: `${pct}%` }} />
          <input type="range" min={0} max={duration || 100} step={0.1} value={current}
            onChange={seek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
            style={{ height: "16px", top: "-8px" }} />
        </div>

        {/* Button row */}
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={toggle}
            className="w-6 h-6 rounded-full bg-primary text-primary-foreground
              flex items-center justify-center hover:bg-primary/90 flex-shrink-0">
            {playing ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3 ml-px" />}
          </button>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {fmt(current)}
          </span>
          <span className="text-[10px] text-muted-foreground/40">/</span>
          <span className="text-[10px] tabular-nums text-muted-foreground">
            {duration > 0 ? fmt(duration) : "--:--"}
          </span>
          <div className="flex-1" />
          <button type="button" onClick={toggleMute} title={muted ? "Unmute" : "Mute"}
            className="text-muted-foreground hover:text-foreground transition-colors">
            {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
          </button>
          <button type="button" onClick={() => setLarge(true)} title="Expand"
            className="text-muted-foreground hover:text-foreground transition-colors">
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
          <button type="button" onClick={() => setCollapsed(true)} title="Minimise"
            className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {onClose && (
            <button type="button" onClick={onClose} title="Close"
              className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
