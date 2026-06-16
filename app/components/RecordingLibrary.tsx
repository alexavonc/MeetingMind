"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  FileAudio,
  MoreVertical,
  Trash2,
  FolderInput,
  Pencil,
  Bookmark,
  ChevronRight,
  List,
  LayoutGrid,
} from "lucide-react";
import type { Meeting, Language, Folder } from "@/types";

interface Props {
  meetings: Meeting[];
  selectedFolder: Folder;
  selectedId: string | null;
  allFolders: string[];
  onSelectMeeting: (id: string) => void;
  onSelectFolder: (f: Folder) => void;
  onMoveMeeting: (id: string, folder: Folder) => void;
  onDeleteMeeting: (id: string) => void;
  onRenameMeeting: (id: string, title: string) => void;
}

const LANG_BADGES: Record<Language, { label: string; className: string }> = {
  en: { label: "EN", className: "bg-blue-100 text-blue-700 border-blue-200" },
  zh: { label: "ZH", className: "bg-amber-100 text-amber-700 border-amber-200" },
  ms: { label: "MS", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  sg: { label: "SG", className: "bg-pink-100 text-pink-700 border-pink-200" },
};

type SortOrder = "newest" | "oldest" | "title";

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
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
          setShowMove(false);
        }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                  onRename();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 hover:bg-secondary text-foreground transition-colors"
              >
                <Pencil className="w-3.5 h-3.5 text-muted-foreground" />
                Rename
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowMove(true);
                }}
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
              <p className="px-3 py-1.5 text-xs text-muted-foreground font-medium">
                Move to folder
              </p>
              {allFolders
                .filter((f) => f !== currentFolder)
                .map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpen(false);
                      setShowMove(false);
                      onMove(f);
                    }}
                    className="flex items-center w-full px-3 py-2 hover:bg-secondary text-foreground transition-colors truncate"
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

function Thumbnail({ meeting }: { meeting: Meeting }) {
  const imgUrl = meeting.frameurls?.[0]?.url;

  return (
    <div className="relative w-20 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 flex items-center justify-center">
      {imgUrl ? (
        <img
          src={imgUrl}
          alt={meeting.title}
          className="w-full h-full object-cover"
        />
      ) : (
        <FileAudio className="w-6 h-6 text-gray-400" />
      )}
      {meeting.duration && (
        <span className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/70 text-white text-[10px] font-mono leading-none">
          {meeting.duration}
        </span>
      )}
    </div>
  );
}

function SpeakerBadges({ speakers }: { speakers: Record<string, string> }) {
  const entries = Object.entries(speakers);
  const visible = entries.slice(0, 3);
  const extra = entries.length - visible.length;

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {visible.map(([key, name]) => (
        <span
          key={key}
          className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium bg-violet-50 text-violet-700 border-violet-100 leading-none"
        >
          {name || key}
        </span>
      ))}
      {extra > 0 && (
        <span className="text-[10px] px-1.5 py-0.5 rounded-full border font-medium bg-gray-100 text-gray-500 border-gray-200 leading-none">
          +{extra}
        </span>
      )}
    </div>
  );
}

export default function RecordingLibrary({
  meetings,
  selectedFolder,
  selectedId,
  allFolders,
  onSelectMeeting,
  onSelectFolder,
  onMoveMeeting,
  onDeleteMeeting,
  onRenameMeeting,
}: Props) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  function startRename(meeting: Meeting) {
    setRenamingId(meeting.id);
    setRenameValue(meeting.title);
    setTimeout(() => renameRef.current?.select(), 30);
  }

  function commitRename(id: string) {
    if (renameValue.trim()) onRenameMeeting(id, renameValue.trim());
    setRenamingId(null);
  }

  // Breadcrumb segments from selected folder
  const breadcrumbs = selectedFolder === ""
    ? []
    : selectedFolder.split("/");

  // Filter meetings to those in the selected folder (and subfolders if "All Meetings")
  const folderMeetings = selectedFolder === ""
    ? meetings
    : meetings.filter(
        (m) =>
          m.folder === selectedFolder ||
          m.folder.startsWith(selectedFolder + "/")
      );

  // Apply search
  const searched = search.trim()
    ? folderMeetings.filter((m) =>
        m.title.toLowerCase().includes(search.toLowerCase())
      )
    : folderMeetings;

  // Sort
  const sorted = [...searched].sort((a, b) => {
    if (sortOrder === "title") return a.title.localeCompare(b.title);
    if (sortOrder === "oldest") return a.date.localeCompare(b.date);
    // newest: reverse date sort
    return b.date.localeCompare(a.date);
  });

  return (
    <div className="flex flex-col h-full w-[360px] flex-shrink-0 border-r border-border bg-white">
      {/* Breadcrumbs */}
      <div className="px-4 pt-4 pb-2 flex items-center gap-1 flex-wrap flex-shrink-0">
        <button
          type="button"
          onClick={() => onSelectFolder("")}
          className={`text-xs transition-colors ${
            breadcrumbs.length === 0
              ? "font-semibold text-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          All Recordings
        </button>
        {breadcrumbs.map((segment, i) => {
          const partialPath = breadcrumbs.slice(0, i + 1).join("/");
          const isLast = i === breadcrumbs.length - 1;
          return (
            <span key={partialPath} className="flex items-center gap-1">
              <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <button
                type="button"
                onClick={() => onSelectFolder(partialPath)}
                className={`text-xs transition-colors ${
                  isLast
                    ? "font-semibold text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {segment}
              </button>
            </span>
          );
        })}
      </div>

      {/* Search */}
      <div className="px-4 pb-3 flex-shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recordings, speakers, keywords…"
            className="w-full pl-8 pr-3 py-2 text-sm rounded-xl bg-gray-50 border border-border
              focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary
              text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>


      {/* Count + sort + view toggle */}
      <div className="px-4 pb-3 flex items-center justify-between gap-2 flex-shrink-0">
        <span className="text-xs text-muted-foreground">
          {sorted.length} recording{sorted.length !== 1 ? "s" : ""}
        </span>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Sort:</span>
            <select
              value={sortOrder}
              onChange={(e) => setSortOrder(e.target.value as SortOrder)}
              className="text-xs text-foreground bg-transparent border-0 focus:outline-none cursor-pointer pr-1 font-medium"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="title">Title</option>
            </select>
          </div>
          <div className="flex items-center border border-border rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1 transition-colors ${
                viewMode === "list"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1 transition-colors ${
                viewMode === "grid"
                  ? "bg-secondary text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              aria-label="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Recording list */}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-1">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
            <FileAudio className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">No recordings yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a recording to get started.
              </p>
            </div>
          </div>
        ) : (
          sorted.map((meeting) => {
            const isSelected = selectedId === meeting.id;
            const isRenaming = renamingId === meeting.id;
            return (
              <div
                key={meeting.id}
                className={`group relative flex items-start gap-3 p-2.5 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-violet-50 border border-violet-200"
                    : "hover:bg-gray-50 border border-transparent"
                }`}
                onClick={() => !isRenaming && onSelectMeeting(meeting.id)}
              >
                <Thumbnail meeting={meeting} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    {isRenaming ? (
                      <input
                        ref={renameRef}
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={() => commitRename(meeting.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            commitRename(meeting.id);
                          }
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="flex-1 text-sm font-medium bg-card border border-primary/50 rounded px-1.5 py-0.5
                          focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
                        autoFocus
                      />
                    ) : (
                      <p className="text-sm font-medium leading-snug flex-1 truncate text-foreground">
                        {meeting.title}
                      </p>
                    )}
                    <div className="flex items-center gap-0.5 flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => e.stopPropagation()}
                        className="p-1 rounded text-muted-foreground hover:text-violet-600 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                        aria-label="Bookmark"
                      >
                        <Bookmark className="w-3 h-3" />
                      </button>
                      <MeetingMenu
                        meeting={meeting}
                        currentFolder={selectedFolder}
                        allFolders={allFolders}
                        onMove={(folder) => onMoveMeeting(meeting.id, folder)}
                        onDelete={() => onDeleteMeeting(meeting.id)}
                        onRename={() => startRename(meeting)}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-muted-foreground mt-0.5">
                    {meeting.date} · {meeting.duration}
                  </p>

                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {meeting.languages.map((lang) => (
                      <span
                        key={lang}
                        className={`text-[10px] px-1.5 py-0.5 rounded border font-medium leading-none ${LANG_BADGES[lang].className}`}
                      >
                        {LANG_BADGES[lang].label}
                      </span>
                    ))}
                    <SpeakerBadges speakers={meeting.speakers} />
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
