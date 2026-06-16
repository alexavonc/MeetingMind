"use client";

import { useState, useRef, useEffect } from "react";
import {
  Search,
  FileAudio,
  Folder as FolderIcon,
  MoreVertical,
  Trash2,
  FolderInput,
  Pencil,
  Bookmark,
  ChevronRight,
  List,
  LayoutGrid,
  Plus,
  Check,
  X,
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
  onCreateFolder: (name: string) => void;
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
  onCreateFolder,
}: Props) {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [creatingSubfolder, setCreatingSubfolder] = useState(false);
  const [newSubfolderName, setNewSubfolderName] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const newSubfolderRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingSubfolder) setTimeout(() => newSubfolderRef.current?.focus(), 20);
  }, [creatingSubfolder]);

  function startRename(meeting: Meeting) {
    setRenamingId(meeting.id);
    setRenameValue(meeting.title);
    setTimeout(() => renameRef.current?.select(), 30);
  }

  function commitRename(id: string) {
    if (renameValue.trim()) onRenameMeeting(id, renameValue.trim());
    setRenamingId(null);
  }

  function submitSubfolder() {
    const name = newSubfolderName.trim();
    if (name) {
      const newPath = selectedFolder ? `${selectedFolder}/${name}` : name;
      onCreateFolder(newPath);
      onSelectFolder(newPath);
    }
    setCreatingSubfolder(false);
    setNewSubfolderName("");
  }

  // Breadcrumb segments
  const breadcrumbs = selectedFolder === "" ? [] : selectedFolder.split("/");

  // Direct subfolders of the current folder
  const directSubfolders = allFolders.filter((f) => {
    if (selectedFolder === "") return !f.includes("/");
    return (
      f.startsWith(selectedFolder + "/") &&
      !f.slice(selectedFolder.length + 1).includes("/")
    );
  }).sort();

  // Count meetings (including in subfolders) for a given folder path
  function folderCount(path: string) {
    return meetings.filter(
      (m) => m.folder === path || m.folder.startsWith(path + "/")
    ).length;
  }

  // Meetings: when searching show all in subtree, otherwise only direct
  const baseMeetings = search.trim()
    ? meetings.filter(
        (m) =>
          (selectedFolder === ""
            ? true
            : m.folder === selectedFolder || m.folder.startsWith(selectedFolder + "/")) &&
          m.title.toLowerCase().includes(search.toLowerCase())
      )
    : meetings.filter((m) => m.folder === selectedFolder);

  const sorted = [...baseMeetings].sort((a, b) => {
    if (sortOrder === "title") return a.title.localeCompare(b.title);
    if (sortOrder === "oldest") return a.date.localeCompare(b.date);
    return b.date.localeCompare(a.date);
  });

  const hasContent = directSubfolders.length > 0 || sorted.length > 0;

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
        {breadcrumbs.map((segment: string, i: number) => {
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

      <div className="flex-1 overflow-y-auto px-3 pb-3">
        {!hasContent && !creatingSubfolder ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-16">
            <FileAudio className="w-10 h-10 text-muted-foreground/40" />
            <div>
              <p className="text-sm font-medium text-foreground">Nothing here yet</p>
              <p className="text-xs text-muted-foreground mt-1">Upload a recording or create a subfolder.</p>
            </div>
            <button
              type="button"
              onClick={() => setCreatingSubfolder(true)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New subfolder
            </button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Subfolders section */}
            {(directSubfolders.length > 0 || creatingSubfolder) && !search.trim() && (
              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Folders
                  </span>
                  <button
                    type="button"
                    onClick={() => setCreatingSubfolder(true)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title="New subfolder"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* New subfolder input */}
                {creatingSubfolder && (
                  <div className="flex items-center gap-1 mb-1.5 px-1">
                    <FolderIcon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      ref={newSubfolderRef}
                      type="text"
                      value={newSubfolderName}
                      onChange={(e) => setNewSubfolderName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") submitSubfolder();
                        if (e.key === "Escape") { setCreatingSubfolder(false); setNewSubfolderName(""); }
                      }}
                      placeholder="Subfolder name…"
                      className="flex-1 text-xs bg-input border border-primary/50 rounded px-2 py-1
                        focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
                    />
                    <button type="button" onClick={submitSubfolder} className="text-primary p-0.5 flex-shrink-0">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCreatingSubfolder(false); setNewSubfolderName(""); }}
                      className="text-muted-foreground p-0.5 flex-shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-1.5">
                  {directSubfolders.map((path) => {
                    const name = path.split("/").pop() ?? path;
                    const count = folderCount(path);
                    return (
                      <button
                        key={path}
                        type="button"
                        onClick={() => onSelectFolder(path)}
                        className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-border
                          bg-gray-50 hover:bg-violet-50 hover:border-violet-200 transition-colors text-left group"
                      >
                        <FolderIcon className="w-4 h-4 text-violet-400 flex-shrink-0 group-hover:text-violet-600" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium text-foreground truncate">{name}</p>
                          <p className="text-[10px] text-muted-foreground">{count} item{count !== 1 ? "s" : ""}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Recordings section */}
            {sorted.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-1.5 px-1">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                    Recordings
                  </span>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                      className="text-[11px] text-muted-foreground bg-transparent border-0 focus:outline-none cursor-pointer font-medium"
                    >
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="title">Title</option>
                    </select>
                    <div className="flex items-center border border-border rounded overflow-hidden">
                      <button type="button" onClick={() => setViewMode("list")}
                        className={`p-0.5 transition-colors ${viewMode === "list" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        <List className="w-3 h-3" />
                      </button>
                      <button type="button" onClick={() => setViewMode("grid")}
                        className={`p-0.5 transition-colors ${viewMode === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                        <LayoutGrid className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  {sorted.map((meeting) => {
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
                                  if (e.key === "Enter") { e.preventDefault(); commitRename(meeting.id); }
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
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
