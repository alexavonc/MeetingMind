import type { Meeting, Utterance, Action } from "@/types";
import type { VideoFrame } from "@/lib/extractVideoFrames";

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

  const raw = await callClaude(apiKey, prompt, 16000);
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

  const prompt = `Analyse this meeting transcript. Return ONLY valid JSON (no backticks, no markdown wrapper):
{"summary":"<markdown>","actions":[{"text":"action item","owner":"person name or empty string","done":false}]}

For the "summary" field, produce a STRUCTURED document in markdown with headed sections. Use only these elements:
- ## Section Title  (for main sections, e.g. "## What it is", "## Core challenges", "## How it works today", "## Goals", "## Vision", "## Next steps")
- Bullet points with "-" for lists
- Numbered lists "1." for ordered goals/steps
- **bold** for emphasis on key terms or vision statements
- Plain sentences for section intros if needed

Choose sections that fit the content — don't force all sections if they don't apply.
If the discussion has a clear vision statement, give it its own "## Vision" section.
If there are numbered goals, use a numbered list under "## Goals".
Keep each bullet concise (one idea per bullet). Aim for 4-7 sections total.

Rules for action items:
- Maximum 6 items
- Only concrete tasks or decisions, not goals
- Assign owner from speaker names where clear

TRANSCRIPT:
${text}`;

  const raw = await callClaude(apiKey, prompt, 3000);
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
Convert them into a meeting record. Return ONLY valid JSON (no backticks, no markdown wrapper):
{
  "summary": "<markdown>",
  "actions": [{"text": "specific action", "owner": "person or empty string", "done": false}],
  "flow": {"nodes":[{"id":"n1","label":"short label","type":"start"}],"edges":[{"source":"n1","target":"n2"}]}
}

For the "summary" field, produce a STRUCTURED document in markdown with headed sections:
- ## Section Title  (e.g. "## What it is", "## Core challenges", "## How it works today", "## Goals", "## Vision", "## Next steps")
- Use "-" for bullet lists, "1." for numbered/ordered goals
- Use **bold** for key terms or vision statements
- Choose sections that fit the content — don't force sections that don't apply
- Keep bullets concise (one idea each). Aim for 4-7 sections.

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

/**
 * Analyze keyframes extracted from a meeting video using Claude Vision.
 * Returns a markdown string describing visible content (whiteboards, slides, screens).
 * Non-blocking — returns empty string on failure.
 */
export async function analyzeVisuals(
  apiKey: string,
  frames: VideoFrame[]
): Promise<string> {
  if (!frames.length) return "";

  try {
    const res = await fetch("/api/claude-vision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        apiKey,
        images: frames.map((f) => ({ base64: f.dataUrl, timestamp: f.timestamp })),
        prompt: `These are frames extracted from a meeting recording. For each frame that shows a whiteboard, screen, slide, or any visible text/diagram, describe what you see. Focus only on content that adds context to the meeting discussion — skip frames that just show people talking with no visible content. Format as bullet points referencing the timestamp label above each frame.`,
        maxTokens: 1500,
      }),
    });
    if (!res.ok) return "";
    const data = (await res.json()) as { text?: string };
    return data.text ?? "";
  } catch {
    return "";
  }
}

export async function genFlow(
  apiKey: string,
  meeting: Pick<Meeting, "title" | "summary" | "transcript" | "speakers">
): Promise<string> {
  const fullTranscript = meeting.transcript
    .map((u) => `${meeting.speakers[u.s] ?? u.s}: ${u.text}`)
    .join("\n");

  const prompt = `You are building a MIND MAP (not a flowchart) for a meeting discussion. Return ONLY valid JSON — no backticks, no markdown, no explanation.

Format:
{"nodes":[{"id":"n1","label":"short label","type":"start"}],"edges":[{"source":"n1","target":"n2","label":"optional"}]}

Node types: "start" (the overall meeting topic — root node), "step" (main theme or sub-point), "end" (key conclusion or outcome), "decision" (a genuine question or fork in the discussion)

YOUR TASK:
1. Identify the overall topic → make it the single root "start" node
2. Identify the 2–5 MAIN THEMES or sections of the discussion (e.g. if a speaker says "three things: first X, second Y, third Z" — those ARE your main theme nodes). Connect each directly to the root.
3. Under each main theme, add 1–3 specific insight/sub-point nodes with the key idea captured concisely. Connect them to their parent theme node.
4. Add "end" nodes only for genuine conclusions, decisions made, or next steps.
5. NEVER chain items sequentially (A→B→C) when they are parallel sub-points of the same parent — they must each connect directly to the parent node.

NODE LABELLING RULES:
- Labels must be CLEAN CONCEPTS (3–5 words), NOT paraphrases of speech
- Bad: "Young people avoid management" | Good: "Management Role Reluctance"
- Bad: "Define fractional managers" | Good: "Definition of Fractional"
- Capitalise main theme nodes. Lowercase for sub-points is fine.
- Aim for 10–18 nodes total for a rich discussion

EDGE LABEL RULES:
- ONLY add edge labels on edges coming OUT of "decision" nodes (e.g. "yes", "no", "policy track")
- NEVER add labels to edges from a parent to its parallel fan-out children — omit the label field entirely for those

MEETING: ${meeting.title}
SUMMARY: ${meeting.summary}
FULL TRANSCRIPT:
${fullTranscript}`;

  const raw = await callClaude(apiKey, prompt, 2048);
  const cleaned = raw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
  JSON.parse(cleaned); // validate — throws if Claude returned garbage
  return cleaned;
}
