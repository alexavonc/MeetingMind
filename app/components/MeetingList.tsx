"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, Trash2, FolderInput, Pencil } from "lucide-react";
import type { Meeting, Language, Folder } from "@/types";

interface Props {
  meetings: Meeting[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onMove: (id: string, folder: Folder) => void;
  onDelete: (id: string) => void;
  onRename: (id: string, title: string) => void;
  currentFolder: Folder;
  allFolders: string[];
}

const LANG_BADGES: Record<Language, { label: string; className: string }> = {
  en: { label: "EN", className: "bg-blue-100 text-blue-700 border-blue-200" },
  zh: { label: "ZH", className: "bg-amber-100 text-amber-700 border-amber-200" },
  ms: { label: "MS", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  sg: { label: "SG", className: "bg-pink-100 text-pink-700 border-pink-200" },
};

function MeetingMenu({
  meeting,
  currentFolder,
  allFolders,
  onMove,
  onDelete,
  onRename,
}: {
  meeting: Meeting;
  currentFolder: Folder;
  allFolders: string[];
  onMove: (folder: Folder) => void;
  onDelete: () => void;
  onRename: () => void;
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
        className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors md:opacity-0 md:group-hover:opacity-100 md:focus:opacity-100"
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
                onClick={(e) => { e.stopPropagation(); setOpen(false); onRename(); }}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-foreground transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                Rename
              </button>
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
              {allFolders.filter((f) => f !== currentFolder).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    setShowMove(false);
                    onMove(f);
                  }}
                  className="flex items-center w-full px-3 py-2 hover:bg-secondary text-foreground transition-colors"
                >
                  {f}
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function MeetingList({ meetings, selectedId, onSelect, onMove, onDelete, onRename, currentFolder, allFolders }: Props) {
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  function startRename(meeting: Meeting) {
    setRenamingId(meeting.id);
    setRenameValue(meeting.title);
    setTimeout(() => renameRef.current?.select(), 30);
  }

  function commitRename(id: string) {
    if (renameValue.trim()) onRename(id, renameValue.trim());
    setRenamingId(null);
  }

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
            onClick={() => renamingId !== meeting.id && onSelect(meeting.id)}
            className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
              selectedId === meeting.id
                ? "bg-primary/15 border border-primary/30"
                : "hover:bg-secondary/60 border border-transparent"
            }`}
          >
            <div className="flex items-start justify-between gap-1">
              {renamingId === meeting.id ? (
                <input
                  ref={renameRef}
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(meeting.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); commitRename(meeting.id); }
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 text-sm font-medium bg-card border border-primary/50 rounded px-1.5 py-0.5
                    focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
                  autoFocus
                />
              ) : (
                <p className={`text-sm font-medium leading-snug flex-1 ${
                  selectedId === meeting.id ? "text-foreground" : "text-foreground/80"
                }`}>
                  {meeting.title}
                </p>
              )}
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
                  allFolders={allFolders}
                  onMove={(folder) => onMove(meeting.id, folder)}
                  onDelete={() => onDelete(meeting.id)}
                  onRename={() => startRename(meeting)}
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
