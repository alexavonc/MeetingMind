"use client";

import type { Meeting, Language } from "@/types";

interface Props {
  meetings: Meeting[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const LANG_BADGES: Record<Language, { label: string; className: string }> = {
  en: { label: "EN", className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  zh: { label: "ZH", className: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  sg: { label: "SG", className: "bg-pink-500/20 text-pink-400 border-pink-500/30" },
};

export default function MeetingList({ meetings, selectedId, onSelect }: Props) {
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
        <li key={meeting.id}>
          <button
            type="button"
            onClick={() => onSelect(meeting.id)}
            className={`w-full text-left px-3 py-3 rounded-lg transition-colors ${
              selectedId === meeting.id
                ? "bg-primary/15 border border-primary/30"
                : "hover:bg-secondary/60 border border-transparent"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <p className={`text-sm font-medium leading-snug flex-1 ${
                selectedId === meeting.id ? "text-foreground" : "text-foreground/80"
              }`}>
                {meeting.title}
              </p>
              <div className="flex gap-1 flex-shrink-0 mt-0.5">
                {meeting.languages.map((lang) => (
                  <span
                    key={lang}
                    className={`text-[10px] px-1.5 py-0.5 rounded border font-medium ${LANG_BADGES[lang].className}`}
                  >
                    {LANG_BADGES[lang].label}
                  </span>
                ))}
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
