"use client";

import { useState, useRef, useEffect } from "react";
import { Settings, Plus, Trash2, FolderOpen, X, Check } from "lucide-react";
import type { Folder, Meeting } from "@/types";
import type { TranscriptionProvider } from "@/types";
import MeetingList from "./MeetingList";
import CostSummaryBar from "./CostSummaryBar";

interface Props {
  meetings: Meeting[];
  selectedId: string | null;
  selectedFolder: Folder;
  folders: string[];
  onSelectFolder: (f: Folder) => void;
  onSelectMeeting: (id: string) => void;
  onOpenSettings: () => void;
  onMoveMeeting: (id: string, folder: Folder) => void;
  onDeleteMeeting: (id: string) => void;
  onRenameMeeting: (id: string, title: string) => void;
  onCreateFolder: (name: string) => void;
  onDeleteFolder: (name: string) => void;
  transcriptionProvider?: TranscriptionProvider;
}

function DeleteFolderDialog({
  folder,
  count,
  onConfirm,
  onCancel,
}: {
  folder: string;
  count: number;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mx-2 my-1 p-3 rounded-lg bg-red-50 border border-red-200 text-xs space-y-2">
      <p className="font-medium text-red-700">Delete &ldquo;{folder}&rdquo;?</p>
      <p className="text-red-600">
        {count > 0
          ? `This will permanently delete ${count} meeting${count !== 1 ? "s" : ""} inside. This cannot be undone.`
          : "This folder is empty and will be removed."}
      </p>
      <div className="flex gap-2 pt-0.5">
        <button
          type="button"
          onClick={onConfirm}
          className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-2.5 py-1 rounded-md bg-white border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({
  meetings,
  selectedId,
  selectedFolder,
  folders,
  onSelectFolder,
  onSelectMeeting,
  onOpenSettings,
  onMoveMeeting,
  onDeleteMeeting,
  onRenameMeeting,
  onCreateFolder,
  onDeleteFolder,
  transcriptionProvider = "groq",
}: Props) {
  const folderMeetings = meetings.filter((m) => m.folder === selectedFolder);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (creatingFolder) inputRef.current?.focus();
  }, [creatingFolder]);

  function submitNewFolder() {
    const name = newFolderName.trim();
    if (name) {
      onCreateFolder(name);
      onSelectFolder(name);
    }
    setCreatingFolder(false);
    setNewFolderName("");
  }

  return (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-5 py-5 border-b border-border flex-shrink-0">
        <h1 className="text-lg font-bold tracking-tight text-foreground font-mono">
          MeetingMind
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">Apple Watch → AI</p>
      </div>

      {/* Folder tabs */}
      <div className="px-2 py-3 border-b border-border flex-shrink-0">
        <div className="flex items-center justify-between px-1 mb-1.5">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
            Folders
          </span>
          <button
            type="button"
            onClick={() => setCreatingFolder(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="New folder"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <nav className="space-y-0.5">
          {folders.map((folder) => {
            const count = meetings.filter((m) => m.folder === folder).length;
            const isConfirming = confirmDelete === folder;
            return (
              <div key={folder}>
                <div className="group/folder flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => { onSelectFolder(folder); setConfirmDelete(null); }}
                    className={`flex-1 flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedFolder === folder
                        ? "bg-primary/15 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <FolderOpen className="w-3.5 h-3.5 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{folder}</span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        selectedFolder === folder
                          ? "bg-primary/20 text-primary"
                          : "bg-secondary text-muted-foreground"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setConfirmDelete(isConfirming ? null : folder);
                    }}
                    className="opacity-0 group-hover/folder:opacity-100 focus:opacity-100 p-1.5 rounded text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0"
                    aria-label={`Delete ${folder} folder`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                {isConfirming && (
                  <DeleteFolderDialog
                    folder={folder}
                    count={count}
                    onConfirm={() => {
                      setConfirmDelete(null);
                      onDeleteFolder(folder);
                    }}
                    onCancel={() => setConfirmDelete(null)}
                  />
                )}
              </div>
            );
          })}

          {/* New folder input */}
          {creatingFolder && (
            <div className="flex items-center gap-1 px-1 py-1">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0 ml-2" />
              <input
                ref={inputRef}
                type="text"
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitNewFolder();
                  if (e.key === "Escape") { setCreatingFolder(false); setNewFolderName(""); }
                }}
                placeholder="Folder name…"
                className="flex-1 text-sm bg-input border border-primary/50 rounded px-2 py-1
                  focus:outline-none focus:ring-1 focus:ring-primary text-foreground min-w-0"
              />
              <button type="button" onClick={submitNewFolder} className="text-primary hover:text-primary/80 transition-colors p-1">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setCreatingFolder(false); setNewFolderName(""); }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </nav>
      </div>

      {/* Meeting list */}
      <div className="flex-1 overflow-y-auto py-2">
        <MeetingList
          meetings={folderMeetings}
          selectedId={selectedId}
          onSelect={onSelectMeeting}
          onMove={onMoveMeeting}
          onDelete={onDeleteMeeting}
          onRename={onRenameMeeting}
          currentFolder={selectedFolder}
          allFolders={folders}
        />
      </div>

      {/* Cost summary across all meetings */}
      <CostSummaryBar meetings={meetings} provider={transcriptionProvider} />

      {/* Footer */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border">
        <button
          type="button"
          onClick={onOpenSettings}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </div>
  );
}
