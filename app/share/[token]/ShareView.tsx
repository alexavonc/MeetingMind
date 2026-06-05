"use client";

import { useState, useEffect, type ReactNode } from "react";
import { FileAudio, List, AlignLeft, GitBranch } from "lucide-react";
import type { Meeting } from "@/types";
import TranscriptView from "@/app/components/TranscriptView";
import PointersView from "@/app/components/PointersView";
import SummaryView from "@/app/components/SummaryView";
import FlowchartView from "@/app/components/FlowchartView";
import { getSupabase } from "@/lib/supabase";

type Tab = "transcript" | "pointers" | "summary" | "flowchart";

const TABS: { value: Tab; label: string; icon: ReactNode }[] = [
  { value: "transcript", label: "Transcript", icon: <FileAudio className="w-4 h-4" /> },
  { value: "pointers",   label: "Pointers",   icon: <List className="w-4 h-4" /> },
  { value: "summary",    label: "Summary",    icon: <AlignLeft className="w-4 h-4" /> },
  { value: "flowchart",  label: "Flowchart",  icon: <GitBranch className="w-4 h-4" /> },
];

const LANG_LABELS: Record<string, string> = {
  en: "English", zh: "Mandarin", sg: "Singlish", ms: "Malay",
};

// ── Save banner ───────────────────────────────────────────────────────────────

function SaveBanner({ meeting }: { meeting: Meeting }) {
  const [state, setState] = useState<"checking" | "save" | "saving" | "saved" | "hidden">("checking");

  useEffect(() => {
    async function check() {
      const sb = getSupabase();
      if (!sb) { setState("hidden"); return; }
      const { data: { session } } = await sb.auth.getSession();
      if (!session) { setState("hidden"); return; }
      const { data } = await sb.from("meetings").select("id").eq("id", meeting.id).maybeSingle();
      setState(data ? "hidden" : "save");
    }
    check();
  }, [meeting.id]);

  async function handleSave() {
    setState("saving");
    const sb = getSupabase();
    if (!sb) { setState("save"); return; }
    const { data: { session } } = await sb.auth.getSession();
    if (!session) { setState("save"); return; }
    const newId = `shared-${meeting.id}-${session.user.id.slice(0, 8)}`;
    await sb.from("meetings").upsert({
      ...meeting,
      id: newId,
      folder: "personal",
      sharetoken: null,
      user_id: session.user.id,
    });
    setState("saved");
  }

  if (state === "hidden" || state === "checking") return null;

  return (
    <div className="bg-violet-600 text-white px-6 py-3 flex items-center justify-between gap-4 flex-shrink-0">
      <p className="text-sm">
        {state === "saved"
          ? "Saved to your Personal folder in MeetingMind."
          : "You're signed in to MeetingMind — save this meeting to your account?"}
      </p>
      {state !== "saved" && (
        <button
          type="button"
          onClick={handleSave}
          disabled={state === "saving"}
          className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-white text-violet-700 text-sm font-semibold
            hover:bg-violet-50 transition-colors disabled:opacity-60"
        >
          {state === "saving" ? "Saving…" : "Save to my MeetingMind"}
        </button>
      )}
    </div>
  );
}

// ── Share page ─────────────────────────────────────────────────────────────────

export default function ShareView({ meeting }: { meeting: Meeting }) {
  const [activeTab, setActiveTab] = useState<Tab>("transcript");

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Save banner */}
      <SaveBanner meeting={meeting} />

      {/* Header */}
      <header className="bg-primary text-primary-foreground px-6 py-6 flex-shrink-0">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-2 mb-2 text-primary-foreground/60 text-xs font-medium uppercase tracking-widest">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15.232 5.232l3.536 3.536M9 13l6.586-6.586a2 2 0 112.828 2.828L11.828 15.828a2 2 0 01-1.414.586H9v-2.414a2 2 0 01.586-1.414z" />
            </svg>
            MeetingMind · Shared Meeting
          </div>
          <h1 className="text-xl font-bold">{meeting.title}</h1>
          <p className="text-primary-foreground/70 text-sm mt-1">
            {meeting.date}{meeting.duration ? ` · ${meeting.duration}` : ""}
          </p>
          {meeting.languages.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {meeting.languages.map((l) => (
                <span key={l}
                  className="px-2 py-0.5 rounded-full bg-primary-foreground/20 text-primary-foreground/90 text-xs font-medium">
                  {LANG_LABELS[l] ?? l}
                </span>
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Tab bar */}
      <div className="border-b border-border bg-card flex-shrink-0">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map(({ value, label, icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === value
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"}`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {activeTab === "transcript" && (
            <TranscriptView meeting={meeting} />
          )}
          {activeTab === "pointers" && (
            <PointersView meeting={meeting} />
          )}
          {activeTab === "summary" && (
            <SummaryView meeting={meeting} onToggleAction={() => {}} />
          )}
          {activeTab === "flowchart" && (
            <FlowchartView
              meeting={meeting}
              onRegenerate={async () => {}}
              onRegeneratePointers={async () => {}}
              hasApiKey={false}
            />
          )}
        </div>
      </main>

      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground flex-shrink-0">
        Generated by MeetingMind · Read-only shared view
      </footer>
    </div>
  );
}
