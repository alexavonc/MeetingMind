import type { Meeting } from "@/types";

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeFlags(caseSensitive: boolean) {
  return caseSensitive ? "g" : "gi";
}

function countIn(text: string, find: string, caseSensitive: boolean): number {
  return (text.match(new RegExp(escapeRegex(find), makeFlags(caseSensitive))) ?? []).length;
}

function repIn(text: string, find: string, replace: string, caseSensitive: boolean): string {
  return text.replace(new RegExp(escapeRegex(find), makeFlags(caseSensitive)), replace);
}

export function countFindMatches(
  meeting: Meeting,
  find: string,
  caseSensitive = false
): number {
  if (!find) return 0;
  let n = 0;
  n += countIn(meeting.title, find, caseSensitive);
  n += countIn(meeting.summary, find, caseSensitive);
  for (const u of meeting.transcript) n += countIn(u.text, find, caseSensitive);
  for (const a of meeting.actions) {
    n += countIn(a.text, find, caseSensitive);
    if (a.owner) n += countIn(a.owner, find, caseSensitive);
  }
  for (const name of Object.values(meeting.speakers)) n += countIn(name, find, caseSensitive);
  if (meeting.pointers) n += countIn(meeting.pointers, find, caseSensitive);
  if (meeting.visualnotes) n += countIn(meeting.visualnotes, find, caseSensitive);
  return n;
}

export function applyFindReplace(
  meeting: Meeting,
  find: string,
  replace: string,
  caseSensitive = false
): Meeting {
  if (!find) return meeting;
  const rep = (s: string) => repIn(s, find, replace, caseSensitive);

  const speakers: Record<string, string> = {};
  for (const [k, v] of Object.entries(meeting.speakers)) {
    speakers[k] = rep(v);
  }

  let pointgroups = meeting.pointgroups;
  if (pointgroups) {
    try {
      const data = JSON.parse(pointgroups) as {
        groups: Array<{ title: string; timestamp?: string; points: string[] }>;
      };
      pointgroups = JSON.stringify({
        groups: data.groups.map((g) => ({
          ...g,
          title: rep(g.title),
          points: g.points.map(rep),
        })),
      });
    } catch {
      pointgroups = rep(pointgroups);
    }
  }

  return {
    ...meeting,
    title: rep(meeting.title),
    summary: rep(meeting.summary),
    transcript: meeting.transcript.map((u) => ({ ...u, text: rep(u.text) })),
    actions: meeting.actions.map((a) => ({
      ...a,
      text: rep(a.text),
      owner: rep(a.owner ?? ""),
    })),
    speakers,
    ...(meeting.pointers !== undefined ? { pointers: rep(meeting.pointers) } : {}),
    ...(pointgroups !== undefined ? { pointgroups } : {}),
    ...(meeting.visualnotes !== undefined ? { visualnotes: rep(meeting.visualnotes) } : {}),
  };
}
