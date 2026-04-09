"use client";

import { useState, useEffect, useCallback } from "react";
import type { Meeting, Settings, Folder, ProcessingState } from "@/types";
import { loadDB, saveDB, loadSettings, saveSettings } from "@/lib/storage";
import { getSupabase } from "@/lib/supabase";
import { SEED_MEETINGS } from "@/lib/seeds";
import { diarise, summarise, genFlow, notesToMeeting, analyzeVisuals } from "@/lib/claude";
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

async function dbUpsert(meeting: Meeting, userId?: string) {
  const sb = getSupabase();
  if (!sb) return;
  const row = userId ? { ...meeting, user_id: userId } : meeting;
  await sb.from("meetings").upsert(row);
}

async function dbUpsertMany(meetings: Meeting[], userId?: string) {
  const sb = getSupabase();
  if (!sb) return;
  const rows = userId ? meetings.map((m) => ({ ...m, user_id: userId })) : meetings;
  await sb.from("meetings").upsert(rows);
}

async function dbUpdate(id: string, patch: Partial<Meeting>) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("meetings").update(patch).eq("id", id);
}

async function dbDelete(id: string) {
  const sb = getSupabase();
  if (!sb) return;
  await sb.from("meetings").delete().eq("id", id);
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useMeetings() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [settings, setSettings] = useState<Settings>({
    claudeKey: "", whisperKey: "", transcriptionProvider: "groq",
    ingestSecret: "", hfToken: "", hfEndpointUrl: "", folders: ["personal"],
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFolder, setSelectedFolder] = useState<Folder>("personal");
  const [processing, setProcessing] = useState<ProcessingState>({
    active: false, step: null, error: null,
  });

  // Track the logged-in user
  useEffect(() => {
    const sb = getSupabase();
    if (!sb) return;
    sb.auth.getSession().then(({ data }) => setUserId(data.session?.user.id ?? null));
    const { data: { subscription } } = sb.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Hydrate on mount — Supabase if configured, else localStorage
  useEffect(() => {
    const sb = getSupabase();

    /** Add any folder names found in loaded meetings that aren't in the stored list. */
    function syncFolders(loadedMeetings: Meeting[]) {
      setSettings((prev) => {
        const discovered = loadedMeetings
          .map((m) => m.folder)
          .filter((f) => f && !prev.folders.includes(f));
        if (discovered.length === 0) return prev;
        const updated = { ...prev, folders: [...prev.folders, ...new Set(discovered)] };
        saveSettings(updated);
        return updated;
      });
    }

    setSettings(loadSettings());

    // Claim any orphaned meetings (no user_id) and assign them to this user.
    // Uses the service-role API route so it can bypass RLS.
    async function claimOrphaned(accessToken: string) {
      try {
        await fetch("/api/auth/claim-meetings", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      } catch { /* best-effort */ }
    }

    dbLoad().then(async (remote) => {
      if (remote === null) {
        // Supabase not configured — use localStorage
        const local = loadDB().filter((m) => !m.id.startsWith("seed-"));
        setMeetings(local);
        syncFolders(local);
        return;
      }

      // Claim orphaned meetings before loading (no-op if already claimed)
      if (sb) {
        const { data } = await sb.auth.getSession();
        if (data.session?.access_token) {
          await claimOrphaned(data.session.access_token);
          // Reload after claiming so we see the newly-claimed meetings
          const refreshed = await dbLoad();
          if (refreshed && refreshed.length > 0) {
            setMeetings(refreshed);
            syncFolders(refreshed);
            return;
          }
        }
      }

      if (remote.length === 0) {
        // Supabase is empty — migrate localStorage meetings if any (skip seeds)
        const local = loadDB().filter((m) => !m.id.startsWith("seed-"));
        if (local.length > 0) {
          const uid = sb ? (await sb.auth.getSession()).data.session?.user.id : undefined;
          dbUpsertMany(local, uid);
          setMeetings(local);
          syncFolders(local);
        }
        // else: genuinely new user — start with empty state
        return;
      }

      setMeetings(remote);
      syncFolders(remote);
    });
  }, []);

  const persistMeetings = useCallback((updated: Meeting[]) => {
    setMeetings(updated);
    saveDB(updated); // keep localStorage in sync as fallback
  }, []);

  // Load API keys from Supabase when user signs in (overrides localStorage for keys only)
  useEffect(() => {
    if (!userId) return;
    const sb = getSupabase();
    if (!sb) return;
    sb.from("user_settings")
      .select("groq_api_key,anthropic_api_key,transcription_provider,hf_token,hf_endpoint_url")
      .eq("user_id", userId)
      .single()
      .then(({ data }) => {
        if (!data) return;
        setSettings((prev) => {
          const updated: Settings = {
            ...prev,
            ...(data.groq_api_key ? { whisperKey: data.groq_api_key } : {}),
            ...(data.anthropic_api_key ? { claudeKey: data.anthropic_api_key } : {}),
            ...(data.transcription_provider ? { transcriptionProvider: data.transcription_provider } : {}),
            ...(data.hf_token ? { hfToken: data.hf_token } : {}),
            ...(data.hf_endpoint_url ? { hfEndpointUrl: data.hf_endpoint_url } : {}),
          };
          saveSettings(updated);
          return updated;
        });
      });
  }, [userId]);

  const updateSettings = useCallback((s: Settings) => {
    setSettings(s);
    saveSettings(s);
    // Sync API keys to Supabase so they sync across devices and the Telegram bot can use them
    if (userId) {
      const sb = getSupabase();
      void sb?.from("user_settings").upsert({
        user_id: userId,
        groq_api_key: s.whisperKey || null,
        anthropic_api_key: s.claudeKey || null,
        transcription_provider: s.transcriptionProvider,
        hf_token: s.hfToken || null,
        hf_endpoint_url: s.hfEndpointUrl || null,
      });
    }
  }, [userId]);

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

  const reprocessMeeting = useCallback(async (meetingId: string, newFile?: File) => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;
    if (!settings.claudeKey) throw new Error("Claude API key not set");
    if (settings.transcriptionProvider !== "huggingface" && !settings.whisperKey)
      throw new Error("Transcription API key not set");

    setProcessing({ active: true, step: "transcribing", error: null });
    await Promise.resolve();

    try {
      // Resolve audio file — new upload or fetch existing URL
      let audioFile: File;
      let audiourl = meeting.audiourl;

      if (newFile) {
        // Upload the new file first so it's saved even if processing fails later
        setProcessing({ active: true, step: "saving", error: null });
        try {
          const form = new FormData();
          form.append("file", newFile);
          form.append("meetingId", meetingId);
          const res = await fetch("/api/store-audio", { method: "POST", body: form });
          if (res.ok) {
            const { url } = (await res.json()) as { url: string };
            audiourl = url;
          }
        } catch { /* non-critical */ }
        audioFile = newFile;
        setProcessing({ active: true, step: "transcribing", error: null });
      } else if (meeting.audiourl) {
        const res = await fetch(meeting.audiourl);
        const blob = await res.blob();
        const ext = meeting.audiourl.split(".").pop() ?? "ogg";
        audioFile = new File([blob], `recording.${ext}`, { type: blob.type || "audio/ogg" });
      } else {
        throw new Error("No audio attached — upload a file first");
      }

      const raw = await transcribeAudio(
        settings.whisperKey, audioFile, settings.transcriptionProvider,
        settings.hfToken ?? "", settings.hfEndpointUrl ?? ""
      );

      setProcessing({ active: true, step: "diarising", error: null });
      const diarised = await diarise(settings.claudeKey, raw);

      setProcessing({ active: true, step: "summarising", error: null });
      const { summary, actions } = await summarise(settings.claudeKey, diarised.transcript, diarised.speakers);

      setProcessing({ active: true, step: "flowcharting", error: null });
      const flow = await genFlow(settings.claudeKey, { ...meeting, speakers: diarised.speakers, transcript: diarised.transcript, summary });

      setProcessing({ active: true, step: "saving", error: null });
      const patch: Partial<Meeting> = {
        speakers: diarised.speakers,
        transcript: diarised.transcript,
        summary,
        actions,
        flow,
        languages: detectLanguages(diarised.transcript),
        ...(audiourl ? { audiourl } : {}),
      };

      setMeetings((prev) => {
        const updated = prev.map((m) => m.id === meetingId ? { ...m, ...patch } : m);
        saveDB(updated);
        return updated;
      });
      await dbUpdate(meetingId, patch);
      setProcessing({ active: false, step: "done", error: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setProcessing({ active: false, step: "error", error: msg });
      throw err;
    }
  }, [meetings, settings]);

  const attachAudio = useCallback(async (meetingId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    form.append("meetingId", meetingId);
    const res = await fetch("/api/store-audio", { method: "POST", body: form });
    if (!res.ok) throw new Error("Audio upload failed");
    const { url } = (await res.json()) as { url: string };
    setMeetings((prev) => {
      const updated = prev.map((m) => m.id === meetingId ? { ...m, audiourl: url } : m);
      saveDB(updated);
      return updated;
    });
    dbUpdate(meetingId, { audiourl: url });
  }, []);

  const renameMeeting = useCallback((id: string, title: string) => {
    if (!title.trim()) return;
    setMeetings((prev) => {
      const updated = prev.map((m) => m.id === id ? { ...m, title: title.trim() } : m);
      saveDB(updated);
      return updated;
    });
    dbUpdate(id, { title: title.trim() });
  }, []);

  const moveMeeting = useCallback((id: string, folder: Folder) => {
    setMeetings((prev) => {
      const updated = prev.map((m) => m.id === id ? { ...m, folder } : m);
      saveDB(updated);
      return updated;
    });
    dbUpdate(id, { folder });
  }, []);

  const deleteMeeting = useCallback((id: string) => {
    setMeetings((prev) => {
      const updated = prev.filter((m) => m.id !== id);
      saveDB(updated);
      return updated;
    });
    setSelectedId((prev) => prev === id ? null : prev);
    dbDelete(id);
  }, []);

  const generateShareLink = useCallback(async (meetingId: string): Promise<string> => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) throw new Error("Meeting not found");
    let token = meeting.sharetoken;
    if (!token) {
      token = crypto.randomUUID();
      setMeetings((prev) => prev.map((m) => m.id === meetingId ? { ...m, sharetoken: token! } : m));
      await dbUpdate(meetingId, { sharetoken: token });
    }
    return `${window.location.origin}/share/${token}`;
  }, [meetings]);

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

  const renameFolder = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) return;
    // Update all meetings in this folder
    setMeetings((prev) => {
      const updated = prev.map((m) =>
        m.folder === oldName ? { ...m, folder: trimmed } : m
      );
      // Batch-update Supabase for affected meetings
      updated.filter((m) => m.folder === trimmed && prev.find((p) => p.id === m.id)?.folder === oldName)
        .forEach((m) => dbUpdate(m.id, { folder: trimmed }));
      saveDB(updated);
      return updated;
    });
    setSelectedFolder((prev) => (prev === oldName ? trimmed : prev));
    setSettings((prev) => {
      const updated = {
        ...prev,
        folders: prev.folders.map((f) => (f === oldName ? trimmed : f)),
      };
      saveSettings(updated);
      return updated;
    });
  }, []);

  const createFolder = useCallback((name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSettings((prev) => {
      if (prev.folders.includes(trimmed)) return prev;
      const updated = { ...prev, folders: [...prev.folders, trimmed] };
      saveSettings(updated);
      return updated;
    });
  }, []);

  const deleteFolder = useCallback((name: string) => {
    setMeetings((prev) => {
      const toDelete = prev.filter((m) => m.folder === name);
      toDelete.forEach((m) => dbDelete(m.id));
      const updated = prev.filter((m) => m.folder !== name);
      saveDB(updated);
      return updated;
    });
    // Clear selection if the selected meeting was in this folder
    setSelectedId((prevId) => {
      const inFolder = meetings.some((m) => m.id === prevId && m.folder === name);
      return inFolder ? null : prevId;
    });
    setSelectedFolder((prev) => (prev === name ? "personal" : prev));
    setSettings((prev) => {
      const updated = { ...prev, folders: prev.folders.filter((f) => f !== name) };
      saveSettings(updated);
      return updated;
    });
  }, [meetings]);

  const processNotes = useCallback(
    async (notes: string, title: string, folder: Folder) => {
      setProcessing({ active: true, step: "summarising", error: null });
      try {
        if (!settings.claudeKey) throw new Error("Claude API key not set — add it in Settings");
        const { summary, actions, flow } = await notesToMeeting(
          settings.claudeKey, notes, title
        );
        setProcessing({ active: true, step: "saving", error: null });

        // Convert notes lines into a minimal transcript for display
        const lines = notes.split("\n").filter((l) => l.trim());
        const transcript = lines.map((line, i) => ({
          s: "A",
          t: `${i}:00`,
          text: line.replace(/^[\s•\-*]+/, "").trim(),
        })).filter((u) => u.text);

        const meetingId = `meeting-${Date.now()}`;
        const newMeeting: Meeting = {
          id: meetingId,
          title,
          folder,
          date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
          duration: `${Math.ceil(lines.length * 0.1)} min`,
          languages: ["en"],
          speakers: { A: "Notes" },
          transcript,
          summary,
          actions,
          flow,
        };

        setMeetings((prev) => {
          const updated = [newMeeting, ...prev];
          saveDB(updated);
          return updated;
        });
        await dbUpsert(newMeeting, userId ?? undefined);

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
    [settings, userId]
  );

  const processUpload = useCallback(
    async (input: File | File[] | string, title: string, folder: Folder) => {
      setProcessing({ active: true, step: "transcribing", error: null });
      await Promise.resolve(); // yield so React renders active:true before synchronous checks
      try {
        if (!settings.claudeKey) throw new Error("Claude API key not set — add it in Settings");
        let raw: string;
        let visualContext = ""; // hoisted so newMeeting can reference it
        if (typeof input === "string") {
          raw = input;
          setProcessing({ active: true, step: "diarising", error: null });
        } else {
          if (settings.transcriptionProvider === "huggingface" && !settings.hfToken)
            throw new Error("HuggingFace token not set");
          if (settings.transcriptionProvider !== "huggingface" && !settings.whisperKey)
            throw new Error("Transcription API key not set");

          const rawFiles = Array.isArray(input) ? input : [input];
          const isVideoFile = (f: File) =>
            f.type.startsWith("video/") || /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(f.name);

          // ── Video files: extract audio track + analyze keyframes ────────────
          const audioFiles: File[] = [];

          for (const f of rawFiles) {
            if (isVideoFile(f)) {
              // Extract audio from video (decodeAudioData works on video files)
              setProcessing({ active: true, step: "transcribing", error: null, detail: "Extracting audio from video…" });
              const { splitAudioFile } = await import("@/lib/splitAudio");
              const audioChunks = await splitAudioFile(f, (detail) =>
                setProcessing({ active: true, step: "transcribing", error: null, detail })
              );
              audioFiles.push(...audioChunks);

              // Extract + analyze keyframes for visual context (non-critical)
              try {
                setProcessing({ active: true, step: "transcribing", error: null, detail: "Scanning video frames…" });
                const { extractKeyframes } = await import("@/lib/extractVideoFrames");
                const frames = await extractKeyframes(f, (detail) =>
                  setProcessing({ active: true, step: "transcribing", error: null, detail })
                );
                if (frames.length > 0) {
                  setProcessing({ active: true, step: "transcribing", error: null, detail: `Analyzing ${frames.length} frames with Claude Vision…` });
                  const notes = await analyzeVisuals(settings.claudeKey, frames);
                  if (notes) visualContext += notes + "\n";
                }
              } catch { /* non-critical — continue without visual context */ }
            } else {
              audioFiles.push(f);
            }
          }

          // ── Auto-split any audio file that exceeds Groq's 25 MB limit ───────
          const GROQ_LIMIT = 25 * 1024 * 1024;
          const fileList: File[] = [];
          for (const f of audioFiles) {
            if (f.size > GROQ_LIMIT) {
              setProcessing({ active: true, step: "transcribing", error: null, detail: "Splitting large file…" });
              const { splitAudioFile } = await import("@/lib/splitAudio");
              const parts = await splitAudioFile(f, (detail) =>
                setProcessing({ active: true, step: "transcribing", error: null, detail })
              );
              fileList.push(...parts);
            } else {
              fileList.push(f);
            }
          }

          const parts: string[] = [];
          for (let i = 0; i < fileList.length; i++) {
            setProcessing({
              active: true, step: "transcribing", error: null,
              detail: fileList.length > 1 ? `Part ${i + 1} of ${fileList.length}` : undefined,
            });
            const part = await transcribeAudio(
              settings.whisperKey, fileList[i], settings.transcriptionProvider,
              settings.hfToken ?? "", settings.hfEndpointUrl ?? ""
            );
            parts.push(part);
          }
          raw = parts.length === 1
            ? parts[0]
            : parts.map((p, i) => `[Part ${i + 1}]\n${p}`).join("\n\n");

          // Prepend visual context from video frames so Claude incorporates it
          if (visualContext) {
            raw = `[VISUAL CONTEXT FROM VIDEO FRAMES]\n${visualContext.trim()}\n[END VISUAL CONTEXT]\n\n${raw}`;
          }

          setProcessing({ active: true, step: "diarising", error: null });
        }

        const diarised = await diarise(settings.claudeKey, raw);
        setProcessing({ active: true, step: "summarising", error: null });

        const { summary, actions } = await summarise(
          settings.claudeKey, diarised.transcript, diarised.speakers
        );
        setProcessing({ active: true, step: "flowcharting", error: null });

        const meetingId = `meeting-${Date.now()}`;

        const tmpMeeting = {
          id: meetingId, title, folder, date: "", duration: "",
          languages: [] as Meeting["languages"],
          speakers: diarised.speakers, transcript: diarised.transcript,
          summary, actions, flow: "",
        } as Meeting;

        const flow = await genFlow(settings.claudeKey, tmpMeeting);
        setProcessing({ active: true, step: "saving", error: null });

        // Upload audio to Supabase Storage (single file only, best-effort)
        let audioUrl: string | undefined;
        if (typeof input !== "string") {
          const fileList = Array.isArray(input) ? input : [input];
          if (fileList.length === 1) {
            try {
              const form = new FormData();
              form.append("file", fileList[0]);
              form.append("meetingId", meetingId);
              const res = await fetch("/api/store-audio", { method: "POST", body: form });
              if (res.ok) {
                const { url } = (await res.json()) as { url: string };
                audioUrl = url;
              }
            } catch { /* non-critical */ }
          }
        }

        const newMeeting: Meeting = {
          ...tmpMeeting,
          date: new Date().toLocaleDateString("en-GB", {
            day: "numeric", month: "short", year: "numeric",
          }),
          duration: `${Math.ceil(diarised.transcript.length * 0.5)} min`,
          languages: detectLanguages(diarised.transcript),
          flow,
          ...(audioUrl ? { audiourl: audioUrl } : {}),
          ...(visualContext ? { visualnotes: visualContext.trim() } : {}),
        };

        setMeetings((prev) => {
          const updated = [newMeeting, ...prev];
          saveDB(updated);
          return updated;
        });
        await dbUpsert(newMeeting, userId ?? undefined); // save to Supabase with user_id

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
    folders: settings.folders ?? ["personal"],
    createFolder,
    renameFolder,
    deleteFolder,
    settings,
    updateSettings,
    processing,
    toggleAction,
    reprocessMeeting,
    attachAudio,
    renameMeeting,
    moveMeeting,
    deleteMeeting,
    generateShareLink,
    regenerateFlow,
    processNotes,
    processUpload,
  };
}

function detectLanguages(transcript: { text: string }[]): ("en" | "zh" | "sg" | "ms")[] {
  const all = transcript.map((u) => u.text).join(" ");
  const langs: ("en" | "zh" | "sg" | "ms")[] = ["en"];
  if (/\[zh\|/.test(all)) langs.push("zh");
  if (/\[ms\|/.test(all)) langs.push("ms");
  if (/\[sg\]/.test(all)) langs.push("sg");
  return langs;
}
