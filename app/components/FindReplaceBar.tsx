"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { X } from "lucide-react";
import type { Meeting } from "@/types";
import { countFindMatches } from "@/lib/findReplace";

interface Props {
  meeting: Meeting;
  onReplace: (find: string, replace: string, caseSensitive: boolean) => void;
  onClose: () => void;
}

export default function FindReplaceBar({ meeting, onReplace, onClose }: Props) {
  const [find, setFind] = useState("");
  const [replace, setReplace] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [justReplaced, setJustReplaced] = useState(false);
  const findRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    findRef.current?.focus();
    findRef.current?.select();
  }, []);

  const matchCount = useMemo(
    () => countFindMatches(meeting, find, caseSensitive),
    [meeting, find, caseSensitive]
  );

  function handleReplace() {
    if (!find || matchCount === 0) return;
    onReplace(find, replace, caseSensitive);
    setJustReplaced(true);
    setTimeout(() => setJustReplaced(false), 2000);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleReplace();
    if (e.key === "Escape") onClose();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-border bg-secondary/40 flex-shrink-0">
      {/* Find */}
      <div className="flex items-center gap-2 flex-1 min-w-[160px]">
        <input
          ref={findRef}
          value={find}
          onChange={(e) => { setFind(e.target.value); setJustReplaced(false); }}
          onKeyDown={handleKeyDown}
          placeholder="Find…"
          className="flex-1 min-w-0 text-xs bg-background border border-border rounded-md px-2.5 py-1.5
            outline-none focus:ring-1 focus:ring-primary/40"
        />
        <span
          className={`text-[11px] font-mono whitespace-nowrap flex-shrink-0 tabular-nums ${
            find && matchCount === 0 ? "text-destructive/80" : "text-muted-foreground"
          }`}
        >
          {find ? `${matchCount} match${matchCount !== 1 ? "es" : ""}` : ""}
        </span>
      </div>

      {/* Replace */}
      <input
        value={replace}
        onChange={(e) => setReplace(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Replace with…"
        className="flex-1 min-w-[140px] text-xs bg-background border border-border rounded-md px-2.5 py-1.5
          outline-none focus:ring-1 focus:ring-primary/40"
      />

      {/* Controls */}
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {/* Case-sensitive toggle */}
        <button
          type="button"
          onClick={() => setCaseSensitive((v) => !v)}
          title={caseSensitive ? "Case sensitive (on)" : "Case sensitive (off)"}
          className={`px-1.5 py-1 rounded text-[11px] font-bold leading-none transition-colors ${
            caseSensitive
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary border border-border"
          }`}
        >
          Aa
        </button>

        {/* Replace all */}
        <button
          type="button"
          onClick={handleReplace}
          disabled={!find || matchCount === 0}
          className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-40 ${
            justReplaced
              ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
              : "bg-primary text-primary-foreground hover:bg-primary/90 disabled:cursor-not-allowed"
          }`}
        >
          {justReplaced ? "Done!" : "Replace all"}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="flex items-center justify-center w-7 h-7 rounded text-muted-foreground
            hover:text-foreground hover:bg-secondary transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
