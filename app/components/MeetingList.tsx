"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Trash2, FolderInput } from "lucide-react";
import type { Meeting, Language, Folder } from "@/types";

interface Props {
  meetings: Meeting[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, folder: Folder) => void;
  onDelete: (id: string) => void;
  currentFolder: Folder;
}

const LANG_BADGES: Record<Language, { label: string; className: string }> = {
  en: { label: "EN", className: "bg-blue-100 text-blue-700 border-blue-200" },
  zh: { label: "ZH", className: "bg-amber-100 text-amber-700 border-amber-200" },
  sg: { label: "SG", className: "bg-pink-100 text-pink-700 border-pink-200" },
};

const FOLDERS: { value: Folder; label: string }[] = [
  { value: "govtech", label: "Govtech" },
  { value: "flow-three", label: "flow-three" },
  { value: "personal", label: "Personal" },
];

function MeetingMenu({
  meeting,
  currentFolder,
  onMove,
  onDelete,
}: {
  meeting: Meeting;
  currentFolder: Folder;
  onMove: (folder: Folder) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [showMove, setShowMove] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setShowMove(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); setShowMove(false); }}
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
        aria-label="Meeting options"
      >
        <MoreVertical className="w-3.5 h-3.5" />
      </button>

      {open && (
        <div className="absolute right-0 top-7 z-50 w-44 bg-card border border-border rounded-lg shadow-lg py-1 text-sm">
          {!showMove ? (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setShowMove(true); }}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-foreground transition-colors"
              >
                <FolderInput className="w-3.5 h-3.5 text-muted-foreground" />
                Move to…
              </button>
              <div className="border-t border-border my-1" />
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onDelete();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-red-50 text-red-600 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
              </button>
            </>
          ) : (
            <>
              <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">Move to folder</p>
              {FOLDERS.filter((f) => f.value !== currentFolder).map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    setShowMove(false);
                    onMove(f.value);
                  }}
                  className="flex items-center w-full px-3 py-2 hover:bg-secondary text-foreground transition-colors"
                >
                  {f.label}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function MeetingList({ meetings, selectedId, onSelect, onMove, onDelete, currentFolder }: Props) {
  if (meetings.length === 0) {
    return (
      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
        No meetings yet.<br />
        Tap + to add one.
      </div>
    );
  }

  return (
    <ul className="space-y-1 px-2">
      {meetings.map((meeting) => (
        <li key={meeting.id} className="group">
          <button
            type="button"
            onClick={() => onSelect(meeting.id)}
            className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
              selectedId === meeting.id
                ? "bg-primary/15 border border-primary/30"
                : "hover:bg-secondary/60 border border-transparent"
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              <p className={`text-sm font-medium leading-snug flex-1 ${
                selectedId === meeting.id ? "text-foreground" : "text-foreground/80"
              }`}>
                {meeting.title}
              </p>
              <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                {meeting.languages.map((lang) => (
                  <span
                    key={lang}
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${LANG_BADGES[lang].className}`}
                  >
                    {LANG_BADGES[lang].label}
                  </span>
                ))}
                <MeetingMenu
                  meeting={meeting}
                  currentFolder={currentFolder}
                  onMove={(folder) => onMove(meeting.id, folder)}
                  onDelete={() => onDelete(meeting.id)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5 text-xs text-muted-foreground">
              <span>{meeting.date}</span>
              <span>·</span>
              <span>{meeting.duration}</span>
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
