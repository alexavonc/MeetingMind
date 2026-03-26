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

export async function genFlow(
  apiKey: string,
  meeting: Pick<Meeting, "title" | "summary" | "transcript" | "speakers">
): Promise<string> {
  const excerpts = meeting.transcript
    .slice(0, 20)
    .map((u) => `${meeting.speakers[u.s] ?? u.s}: ${u.text}`)
    .join("\n");

  const prompt = `Generate a Mermaid.js flowchart for this meeting. Return ONLY the mermaid code — no backticks, no markdown fences, no explanation.

Rules:
- Use flowchart TD
- Short node labels (max 5 words each)
- Use emojis for visual interest
- Show discussion flow and decision points
- End with next steps / action items

MEETING: ${meeting.title}
SUMMARY: ${meeting.summary}
DISCUSSION EXCERPT:
${excerpts}`;

  const raw = await callClaude(apiKey, prompt, 1024);
  // Strip any accidental backtick fences
  return raw.replace(/^```(?:mermaid)?\n?/m, "").replace(/\n?```$/m, "").trim();
}
