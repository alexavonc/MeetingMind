"use client";

import { Settings } from "lucide-react";
import type { Folder, Meeting } from "@/types";
import MeetingList from "./MeetingList";

const FOLDERS: { value: Folder; label: string; emoji: string }[] = [
  { value: "govtech", label: "Govtech", emoji: "🏛️" },
  { value: "flow-three", label: "flow-three", emoji: "🎨" },
  { value: "personal", label: "Personal", emoji: "🗂️" },
];

interface Props {
  meetings: Meeting[];
  selectedId: string | null;
  selectedFolder: Folder;
  onSelectFolder: (f: Folder) => void;
  onSelectMeeting: (id: string) => void;
  onOpenSettings: () => void;
  onMoveMeeting: (id: string, folder: Folder) => void;
  onDeleteMeeting: (id: string) => void;
}

export default function Sidebar({
  meetings,
  selectedId,
  selectedFolder,
  onSelectFolder,
  onSelectMeeting,
  onOpenSettings,
  onMoveMeeting,
  onDeleteMeeting,
}: Props) {
  const folderMeetings = meetings.filter((m) => m.folder === selectedFolder);

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
        <nav className="space-y-0.5">
          {FOLDERS.map((folder) => {
            const count = meetings.filter((m) => m.folder === folder.value).length;
            return (
              <button
                key={folder.value}
                type="button"
                onClick={() => onSelectFolder(folder.value)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                  selectedFolder === folder.value
                    ? "bg-primary/15 text-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                <span>{folder.emoji}</span>
                <span className="flex-1 text-left">{folder.label}</span>
                <span
                  className={`text-xs px-1.5 py-0.5 rounded-full ${
                    selectedFolder === folder.value
                      ? "bg-primary/20 text-primary"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
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
          currentFolder={selectedFolder}
        />
      </div>

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
