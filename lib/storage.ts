import type { Meeting, Settings } from "@/types";

const DB_KEY = "meetingmind_db";
const SETTINGS_KEY = "meetingmind_settings";

export function loadDB(): Meeting[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DB_KEY);
    return raw ? (JSON.parse(raw) as Meeting[]) : [];
  } catch {
    return [];
  }
}

export function saveDB(meetings: Meeting[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(DB_KEY, JSON.stringify(meetings));
}

export function loadSettings(): Settings {
  if (typeof window === "undefined") return { claudeKey: "", whisperKey: "" };
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    return raw ? (JSON.parse(raw) as Settings) : { claudeKey: "", whisperKey: "" };
  } catch {
    return { claudeKey: "", whisperKey: "" };
  }
}

export function saveSettings(settings: Settings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
