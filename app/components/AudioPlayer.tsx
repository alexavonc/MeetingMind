"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause } from "lucide-react";

function fmt(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

export default function AudioPlayer({ url }: { url: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const el = audioRef.current;
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
    const el = audioRef.current;
    if (!el) return;
    if (playing) { el.pause(); setPlaying(false); }
    else { el.play(); setPlaying(true); }
  }

  function seek(e: React.ChangeEvent<HTMLInputElement>) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Number(e.target.value);
    setCurrent(Number(e.target.value));
  }

  const pct = duration > 0 ? (current / duration) * 100 : 0;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-secondary/40 border-b border-border">
      <audio ref={audioRef} src={url} preload="metadata" />

      <button
        type="button"
        onClick={toggle}
        className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground
          flex items-center justify-center hover:bg-primary/90 transition-colors shadow-sm"
      >
        {playing ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
      </button>

      <div className="flex-1 flex items-center gap-2 min-w-0">
        <span className="text-xs tabular-nums text-muted-foreground flex-shrink-0">{fmt(current)}</span>
        <div className="relative flex-1 h-1.5 rounded-full bg-border overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-primary rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={current}
            onChange={seek}
            className="absolute inset-0 w-full opacity-0 cursor-pointer"
          />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground flex-shrink-0">
          {duration > 0 ? fmt(duration) : "--:--"}
        </span>
      </div>
    </div>
  );
}
