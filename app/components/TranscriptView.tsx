"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import ParsedText from "./ParsedText";
import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
  onRenameSpeaker?: (key: string, name: string) => void;
  onReassignUtterance?: (utteranceIdx: number, speakerKey: string) => void;
}

const SPEAKER_COLORS = [
  "text-blue-600",
  "text-emerald-600",
  "text-violet-600",
  "text-orange-500",
];

const SPEAKER_BG = [
  "bg-blue-50 border-blue-200 hover:bg-blue-100",
  "bg-emerald-50 border-emerald-200 hover:bg-emerald-100",
  "bg-violet-50 border-violet-200 hover:bg-violet-100",
  "bg-orange-50 border-orange-200 hover:bg-orange-100",
];

function SpeakerChip({
  name,
  color,
  onRename,
}: {
  name: string;
  color: string;
  onRename?: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const inputRef = useRef<HTMLInputElement>(null);

  function startEdit() {
    if (!onRename) return;
    setValue(name);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  }

  function commit() {
    setEditing(false);
    if (value.trim() && value.trim() !== name) onRename?.(value.trim());
    else setValue(name);
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1.5 text-sm">
        <span className={`inline-block w-2 h-2 rounded-full bg-current flex-shrink-0 ${color}`} />
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setEditing(false); setValue(name); }
          }}
          className={`font-medium bg-transparent border-b border-current outline-none w-28 ${color}`}
        />
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={startEdit}
      disabled={!onRename}
      className={`flex items-center gap-1.5 text-sm group ${onRename ? "cursor-pointer" : "cursor-default"}`}
      title={onRename ? `Rename ${name}` : undefined}
    >
      <span className={`inline-block w-2 h-2 rounded-full bg-current flex-shrink-0 ${color}`} />
      <span className={`font-medium ${color}`}>{name}</span>
      {onRename && (
        <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity flex-shrink-0" />
      )}
    </button>
  );
}

function SpeakerPicker({
  speakerKeys,
  speakers,
  currentKey,
  onSelect,
  onClose,
}: {
  speakerKeys: string[];
  speakers: Record<string, string>;
  currentKey: string;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute left-0 top-full mt-1 z-50 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-[120px]"
    >
      {speakerKeys.map((key, i) => (
        <button
          key={key}
          type="button"
          onClick={() => { onSelect(key); onClose(); }}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-colors
            ${key === currentKey ? "bg-secondary font-semibold" : "hover:bg-secondary/60"}`}
        >
          <span className={`inline-block w-2 h-2 rounded-full bg-current flex-shrink-0 ${SPEAKER_COLORS[i % SPEAKER_COLORS.length]}`} />
          <span className={SPEAKER_COLORS[i % SPEAKER_COLORS.length]}>{speakers[key]}</span>
          {key === currentKey && <span className="ml-auto text-muted-foreground">✓</span>}
        </button>
      ))}
    </div>
  );
}

export default function TranscriptView({ meeting, onRenameSpeaker, onReassignUtterance }: Props) {
  const speakerKeys = Object.keys(meeting.speakers);
  const [openPickerIdx, setOpenPickerIdx] = useState<number | null>(null);

  return (
    <div className="space-y-4">
      {/* Speaker legend — click name to rename */}
      <div className="flex flex-wrap gap-3 pb-3 border-b border-border">
        {speakerKeys.map((key, i) => (
          <SpeakerChip
            key={key}
            name={meeting.speakers[key]}
            color={SPEAKER_COLORS[i % SPEAKER_COLORS.length]}
            onRename={onRenameSpeaker ? (name) => onRenameSpeaker(key, name) : undefined}
          />
        ))}
      </div>

      {/* Utterances */}
      <div className="space-y-3">
        {meeting.transcript.map((utterance, idx) => {
          const speakerIdx = speakerKeys.indexOf(utterance.s);
          const colorClass = SPEAKER_COLORS[speakerIdx % SPEAKER_COLORS.length];
          const bgClass = SPEAKER_BG[speakerIdx % SPEAKER_BG.length];
          const name = meeting.speakers[utterance.s] ?? utterance.s;

          return (
            <div key={idx} className="flex gap-2.5">
              {/* Speaker label — click to reassign */}
              <div className="flex-shrink-0 flex flex-col items-end gap-0.5 pt-0.5 w-16 sm:w-24 relative">
                {onReassignUtterance ? (
                  <button
                    type="button"
                    onClick={() => setOpenPickerIdx(openPickerIdx === idx ? null : idx)}
                    className={`text-xs font-semibold px-1.5 py-0.5 rounded border transition-colors ${colorClass} ${bgClass}`}
                    title="Change speaker"
                  >
                    {name.split(" ")[0]}
                  </button>
                ) : (
                  <span className={`text-xs font-semibold ${colorClass}`}>
                    {name.split(" ")[0]}
                  </span>
                )}
                <span className="text-xs text-muted-foreground font-mono">
                  {utterance.t}
                </span>
                {openPickerIdx === idx && onReassignUtterance && (
                  <SpeakerPicker
                    speakerKeys={speakerKeys}
                    speakers={meeting.speakers}
                    currentKey={utterance.s}
                    onSelect={(key) => onReassignUtterance(idx, key)}
                    onClose={() => setOpenPickerIdx(null)}
                  />
                )}
              </div>
              <div className="flex-1 text-sm leading-relaxed text-foreground/90">
                <ParsedText text={utterance.text} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
