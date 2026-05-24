"use client";

import { useState, useRef } from "react";
import { Pencil } from "lucide-react";
import ParsedText from "./ParsedText";
import type { Meeting } from "@/types";

interface Props {
  meeting: Meeting;
  onRenameSpeaker?: (key: string, name: string) => void;
}

const SPEAKER_COLORS = [
  "text-blue-600",
  "text-emerald-600",
  "text-violet-600",
  "text-orange-500",
];

function SpeakerChip({
  speakerKey,
  name,
  color,
  onRename,
}: {
  speakerKey: string;
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

export default function TranscriptView({ meeting, onRenameSpeaker }: Props) {
  const speakerKeys = Object.keys(meeting.speakers);

  return (
    <div className="space-y-4">
      {/* Speaker legend — click to rename */}
      <div className="flex flex-wrap gap-3 pb-3 border-b border-border">
        {speakerKeys.map((key, i) => (
          <SpeakerChip
            key={key}
            speakerKey={key}
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
          const name = meeting.speakers[utterance.s] ?? utterance.s;

          return (
            <div key={idx} className="flex gap-2.5">
              <div className="flex-shrink-0 flex flex-col items-end gap-0.5 pt-0.5 w-16 sm:w-24">
                <span className={`text-xs font-semibold ${colorClass}`}>
                  {name.split(" ")[0]}
                </span>
                <span className="text-xs text-muted-foreground font-mono">
                  {utterance.t}
                </span>
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
