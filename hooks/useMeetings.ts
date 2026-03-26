"use client";

import { useState, useEffect, useCallback } from "react";
import type { Meeting, Settings, Folder, ProcessingState } from "@/types";
import { loadDB, saveDB, loadSettings, saveSettings } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";
import { SEED_MEETINGS } from "@/lib/seeds";
import { diarise, summarise, genFlow } from "@/lib/claude";
import { transcribeAudio } from "@/lib/whisper";

// ── Supabase helpers ─────────────────────────────────────────────────────────

async function dbLoad(): Promise<Meeting[] | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("meetings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return null;
  return (data ?? []) as Meeting[];
}

async function dbUpsert(meeting: Meeting) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("meetings").upsert(meeting);
}

async function dbUpsertMany(meetings: Meeting[]) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("meetings").upsert(meetings);
}

async function dbUpdate(id: string, patch: Partial<Meeting>) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("meetings").update(patch).eq("id", id);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [settings, setSettings] = useState<Settings>({
    claudeKey: "", whisperKey: "", transcriptionProvider: "groq",
    ingestSecret: "", hfToken: "", hfEndpointUrl: "",
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder>("govtech");
  const [processing, setProcessing] = useState<ProcessingState>({
    active: false, step: null, error: null,
  });

  // Hydrate on mount — Supabase if configured, else localStorage
  useEffect(() => {
    setSettings(loadSettings());

    dbLoad().then((remote) => {
      if (remote === null) {
        // Supabase not configured — use localStorage
        const local = loadDB();
        if (local.length === 0) {
          setMeetings(SEED_MEETINGS);
          saveDB(SEED_MEETINGS);
        } else {
          setMeetings(local);
        }
        return;
      }

      if (remote.length === 0) {
        // Supabase is empty — migrate localStorage meetings if any
        const local = loadDB().filter((m) => !m.id.startsWith("seed-"));
        if (local.length > 0) {
          dbUpsertMany(local);
          setMeetings(local);
        } else {
          setMeetings(SEED_MEETINGS);
        }
        return;
      }

      setMeetings(remote);
    });
  }, []);

  const persistMeetings = useCallback((updated: Meeting[]) => {
    setMeetings(updated);
    saveDB(updated); // keep localStorage in sync as fallback
  }, []);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
  }, []);

  const toggleAction = useCallback((meetingId: string, actionIndex: number) => {
    setMeetings((prev) => {
      const updated = prev.map((m) => {
        if (m.id !== meetingId) return m;
        const actions = m.actions.map((a, i) =>
          i === actionIndex ? { ...a, done: !a.done } : a
        );
        const patched = { ...m, actions };
        dbUpdate(meetingId, { actions }); // async, fire-and-forget
        return patched;
      });
      saveDB(updated);
      return updated;
    });
  }, []);

  const regenerateFlow = useCallback(async (meetingId: string) => {
    if (!settings.claudeKey) throw new Error("Claude API key not set");
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;

    setProcessing({ active: true, step: "flowcharting", error: null });
    try {
      const flow = await genFlow(settings.claudeKey, meeting);
      setMeetings((prev) => {
        const updated = prev.map((m) => m.id === meetingId ? { ...m, flow } : m);
        saveDB(updated);
        return updated;
      });
      dbUpdate(meetingId, { flow });
    } finally {
      setProcessing({ active: false, step: null, error: null });
    }
  }, [meetings, settings.claudeKey]);

  const processUpload = useCallback(
    async (input: File | string, title: string, folder: Folder) => {
      if (!settings.claudeKey) throw new Error("Claude API key not set");
      setProcessing({ active: true, step: "transcribing", error: null });

      try {
        let raw: string;
        if (typeof input === "string") {
          raw = input;
          setProcessing({ active: true, step: "diarising", error: null });
        } else {
          if (settings.transcriptionProvider === "huggingface" && !settings.hfToken)
            throw new Error("HuggingFace token not set");
          if (settings.transcriptionProvider !== "huggingface" && !settings.whisperKey)
            throw new Error("Transcription API key not set");
          raw = await transcribeAudio(
            settings.whisperKey, input, settings.transcriptionProvider,
            settings.hfToken ?? "", settings.hfEndpointUrl ?? ""
          );
          setProcessing({ active: true, step: "diarising", error: null });
        }

        const diarised = await diarise(settings.claudeKey, raw);
        setProcessing({ active: true, step: "summarising", error: null });

        const { summary, actions } = await summarise(
          settings.claudeKey, diarised.transcript, diarised.speakers
        );
        setProcessing({ active: true, step: "flowcharting", error: null });

        const tmpMeeting = {
          id: "", title, folder, date: "", duration: "",
          languages: [] as Meeting["languages"],
          speakers: diarised.speakers, transcript: diarised.transcript,
          summary, actions, flow: "",
        } as Meeting;

        const flow = await genFlow(settings.claudeKey, tmpMeeting);
        setProcessing({ active: true, step: "saving", error: null });

        const newMeeting: Meeting = {
          ...tmpMeeting,
          id: `meeting-${Date.now()}`,
          date: new Date().toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
          }),
          duration: `${Math.ceil(diarised.transcript.length * 0.5)} min`,
          languages: detectLanguages(diarised.transcript),
          flow,
        };

        setMeetings((prev) => {
          const updated = [newMeeting, ...prev];
          saveDB(updated);
          return updated;
        });
        await dbUpsert(newMeeting); // save to Supabase

        setSelectedFolder(folder);
        setSelectedId(newMeeting.id);
        setProcessing({ active: false, step: "done", error: null });
        return newMeeting;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        setProcessing({ active: false, step: "error", error: msg });
        throw err;
      }
    },
    [settings]
  );

  const selectedMeeting = meetings.find((m) => m.id === selectedId) ?? null;

  return {
    meetings,
    selectedMeeting,
    selectedId,
    setSelectedId,
    selectedFolder,
    setSelectedFolder,
    settings,
    updateSettings,
    processing,
    toggleAction,
    regenerateFlow,
    processUpload,
  };
}

function detectLanguages(transcript: { text: string }[]): ("en" | "zh" | "sg")[] {
  const all = transcript.map((u) => u.text).join(" ");
  const langs: ("en" | "zh" | "sg")[] = ["en"];
  if (/\[zh\|/.test(all)) langs.push("zh");
  if (/\[sg\]/.test(all)) langs.push("sg");
  return langs;
}
