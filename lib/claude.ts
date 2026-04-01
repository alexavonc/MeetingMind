import type { Meeting, Utterance, Action } from "@/types";

interface DiariseResult {
  speakers: Record<string, string>;
  transcript: Utterance[];
}

interface SummariseResult {
  summary: string;
  actions: Action[];
}

async function callClaude(
  apiKey: string,
  prompt: string,
  maxTokens = 2048
): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey, prompt, maxTokens }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error: ${err}`);
  }
  const data = (await res.json()) as { text: string };
  return data.text;
}

export async function diarise(
  apiKey: string,
  rawTranscript: string
): Promise<DiariseResult> {
  const prompt = `Diarise this transcript. Return ONLY valid JSON (no backticks, no markdown):
{"speakers":{"A":"name"},"transcript":[{"s":"A","t":"0:00","text":"cleaned"}]}

Rules:
- Translate any Mandarin/Chinese spoken words into English. Wrap the translation in [zh|English translation][/zh]
- Translate any Malay words or phrases into English. Wrap in [ms|English translation][/ms]. Common Malay words used by Singapore speakers:
  - "contohnya" → [ms|for example][/ms]
  - "boleh" → [ms|can][/ms]
  - "sudah" / "dah" → [ms|already][/ms]
  - "tak" / "tidak" → [ms|not][/ms]
  - "dengan" → [ms|with][/ms]
  - "kalau" → [ms|if][/ms]
  - "memang" → [ms|indeed][/ms]
  - "macam" → [ms|like / as if][/ms]
  - "sekarang" → [ms|now][/ms]
  - Full Malay sentences should be translated in full and wrapped in [ms|English translation][/ms]
- The speech recogniser often phonetically transcribes Mandarin/Hokkien words as English-sounding text. Identify and translate these too. Common examples:
  - "lai liao" / "lie there" / "lai lah" → [zh|come already][/zh]
  - "kuai dian" / "kuai teng" / "Kuai Teng" → [zh|faster / hurry up][/zh]
  - "mai lah" / "mai" → [zh|don't want][/zh]
  - "ho seh" / "ho say" → [zh|great / well done][/zh]
  - "sian" / "xian" (when expressing boredom) → [zh|bored / fed up][/zh]
  - "bo liao" → [zh|nothing better to do][/zh]
  - "aiyah" / "ai yah" → [zh|expression of exasperation][/zh]
  - "wah lau" / "walao" → [zh|expression of disbelief][/zh]
  - Any pinyin-like syllables (e.g. "ni", "wo", "ta", "men", "de", "shi", "bu") in unusual context
- Wrap Singlish slang in [sg]text[/sg]
- Max 4 speakers
- Keep timestamps as MM:SS

TRANSCRIPT:
${rawTranscript}`;

  const raw = await callClaude(apiKey, prompt, 4096);
  try {
    return JSON.parse(raw) as DiariseResult;
  } catch {
    throw new Error("Failed to parse diarisation response as JSON");
  }
}

export async function summarise(
  apiKey: string,
  transcript: Utterance[],
  speakers: Record<string, string>
): Promise<SummariseResult> {
  const text = transcript
    .map((u) => `${speakers[u.s] ?? u.s} [${u.t}]: ${u.text}`)
    .join("\n");

  const prompt = `Analyse this meeting transcript. Return ONLY valid JSON (no backticks, no markdown):
{"summary":"2-3 sentences","actions":[{"text":"action item","owner":"person name","done":false}]}

Rules:
- Maximum 6 action items
- Be specific and actionable
- Assign owner from speaker names

TRANSCRIPT:
${text}`;

  const raw = await callClaude(apiKey, prompt, 1024);
  try {
    return JSON.parse(raw) as SummariseResult;
  } catch {
    throw new Error("Failed to parse summary response as JSON");
  }
}

interface NotesResult {
  summary: string;
  actions: Action[];
  flow: string;
}

/**
 * Convert structured text notes (bullet points, headers, etc.) directly into
 * a meeting summary, action items, and flowchart — in a single Claude call.
 */
export async function notesToMeeting(
  apiKey: string,
  notes: string,
  title: string
): Promise<NotesResult> {
  const prompt = `You are given structured notes (may contain bullet points, numbered lists, headers, indented sub-items).
Convert them into a meeting record. Return ONLY valid JSON (no backticks, no markdown):
{
  "summary": "2-3 sentence overview of the content",
  "actions": [{"text": "specific action", "owner": "person or empty string", "done": false}],
  "flow": {"nodes":[{"id":"n1","label":"short label","type":"start"}],"edges":[{"source":"n1","target":"n2","label":"optional"}]}
}

Rules for actions:
- Max 6 items. Only include concrete tasks or decisions. Skip if none.

Rules for flowchart:
- 6–12 nodes, labels max 5 words
- CRITICALLY: honour the hierarchy of the notes. If a bullet point has sub-bullets A, B, C, the parent node must be the SOURCE of SEPARATE edges to A, B, and C — never a chain A→B→C unless the text is genuinely sequential
- Top-level sections / headers → "step" or "start" nodes
- Branching choices → "decision" nodes with labelled edges
- Final outcomes / conclusions → "end" nodes
- If the notes enumerate a list under a heading, fan out from that heading node to each list item in parallel

TITLE: ${title}
NOTES:
${notes}`;

  const raw = await callClaude(apiKey, prompt, 2048);
  let parsed: { summary: string; actions: Action[]; flow: unknown };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    throw new Error("Failed to parse notes response as JSON");
  }
  const flowStr = typeof parsed.flow === "string"
    ? parsed.flow
    : JSON.stringify(parsed.flow);
  // Validate flowchart JSON
  JSON.parse(flowStr);
  return { summary: parsed.summary, actions: parsed.actions, flow: flowStr };
}

export async function genFlow(
  apiKey: string,
  meeting: Pick<Meeting, "title" | "summary" | "transcript" | "speakers">
): Promise<string> {
  const excerpts = meeting.transcript
    .slice(0, 20)
    .map((u) => `${meeting.speakers[u.s] ?? u.s}: ${u.text}`)
    .join("\n");

  const prompt = `Generate a flowchart for this meeting as JSON. Return ONLY valid JSON — no backticks, no markdown, no explanation.

Format:
{"nodes":[{"id":"n1","label":"short label","type":"start"}],"edges":[{"source":"n1","target":"n2","label":"optional"}]}

Node types: "start" (opening context), "end" (outcome or next step), "decision" (branch point), "step" (default)
Rules:
- 6–12 nodes
- Labels max 5 words each
- When content enumerates multiple items under a parent (e.g. "three rules: A, B, C"), the parent node must appear as the "source" in SEPARATE edges to each child — NOT a chain (A→B→C). Example: {"source":"rules","target":"ruleA"},{"source":"rules","target":"ruleB"},{"source":"rules","target":"ruleC"}
- Use "decision" nodes when there is a genuine yes/no or multiple-choice point; label each outgoing edge
- Linear chains are fine when steps are genuinely sequential
- Multiple "end" nodes are fine if there are distinct outcomes

MEETING: ${meeting.title}
SUMMARY: ${meeting.summary}
DISCUSSION EXCERPT:
${excerpts}`;

  const raw = await callClaude(apiKey, prompt, 1024);
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  JSON.parse(cleaned); // validate — throws if Claude returned garbage
  return cleaned;
}
