import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const CLAUDE_API = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const SG_PROMPT =
  "Singapore English meeting. Code-switching between English, Singlish, and Mandarin Chinese. Common Singlish: lah, lor, meh, can, cannot, sia, walao, alamak, shiok, confirm, already.";

// ── Telegram helpers ─────────────────────────────────────────────────────────

async function tgSend(token: string, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

async function downloadTgFile(
  token: string,
  fileId: string
): Promise<{ buffer: ArrayBuffer; ext: string }> {
  const r = await fetch(
    `https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`
  );
  const json = (await r.json()) as {
    ok: boolean;
    result?: { file_path: string; file_size?: number };
  };
  if (!json.ok || !json.result) {
    throw new Error("File too large to download — Telegram bot API limit is 20 MB. Please trim the recording or split it.");
  }
  const { result } = json;
  if ((result.file_size ?? 0) > 20 * 1024 * 1024) {
    throw new Error("File too large — Telegram limit is 20 MB via bot API");
  }
  const audioRes = await fetch(
    `https://api.telegram.org/file/bot${token}/${result.file_path}`
  );
  const buffer = await audioRes.arrayBuffer();
  const ext = result.file_path.split(".").pop() ?? "ogg";
  return { buffer, ext };
}

// ── Groq transcription ───────────────────────────────────────────────────────

async function transcribe(
  groqKey: string,
  buffer: ArrayBuffer,
  ext: string
): Promise<string> {
  const mime: Record<string, string> = {
    ogg: "audio/ogg",
    oga: "audio/ogg",
    mp3: "audio/mpeg",
    m4a: "audio/m4a",
    mp4: "audio/mp4",
    wav: "audio/wav",
    webm: "audio/webm",
  };
  // Groq doesn't accept .oga — normalise to .ogg (same codec)
  const safeExt = ext === "oga" ? "ogg" : ext;
  const file = new File([buffer], `rec.${safeExt}`, {
    type: mime[ext] ?? "audio/ogg",
  });
  const form = new FormData();
  form.append("file", file);
  form.append("model", "whisper-large-v3");
  form.append("response_format", "text");
  form.append("prompt", SG_PROMPT);
  const res = await fetch(GROQ_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${groqKey}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Transcription failed: ${await res.text()}`);
  return res.text();
}

// ── Claude helper ────────────────────────────────────────────────────────────

async function callClaude(
  apiKey: string,
  prompt: string,
  maxTokens = 2048
): Promise<string> {
  const res = await fetch(CLAUDE_API, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`);
  const data = (await res.json()) as {
    content: { type: string; text: string }[];
  };
  return data.content.find((c) => c.type === "text")?.text ?? "";
}

// ── Formatting helpers ───────────────────────────────────────────────────────

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function stripMarkup(s: string) {
  return s
    .replace(/\[zh\|([^\]]+)\]\[\/zh\]/g, "$1")
    .replace(/\[sg\]([\s\S]*?)\[\/sg\]/g, "$1");
}

// ── Main webhook handler ─────────────────────────────────────────────────────

interface TgFileRef {
  file_id: string;
  duration?: number;
  file_size?: number;
  mime_type?: string;
}

interface TgUpdate {
  message?: {
    chat: { id: number };
    voice?: TgFileRef;
    audio?: TgFileRef;
    document?: TgFileRef & { file_name?: string };
    text?: string;
  };
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const groqKey = process.env.GROQ_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!token) return NextResponse.json({ ok: true }); // silently ignore if not configured

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const msg = update.message;
  if (!msg) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;

  // Non-audio message → send instructions
  const fileRef =
    msg.voice ??
    msg.audio ??
    (msg.document?.mime_type?.startsWith("audio/") ? msg.document : undefined);

  if (!fileRef) {
    await tgSend(
      token,
      chatId,
      "👋 <b>MeetingMind bot</b>\n\nSend me a voice note or audio file and I'll transcribe and summarise your meeting automatically."
    );
    return NextResponse.json({ ok: true });
  }

  if (!groqKey || !anthropicKey) {
    await tgSend(
      token,
      chatId,
      "❌ Bot not fully configured — set <code>GROQ_API_KEY</code> and <code>ANTHROPIC_API_KEY</code> in Railway Variables."
    );
    return NextResponse.json({ ok: true });
  }

  await tgSend(token, chatId, "⏳ Transcribing your meeting…");

  try {
    // 1. Download from Telegram
    const { buffer, ext } = await downloadTgFile(token, fileRef.file_id);

    // 2. Transcribe with Groq
    const rawTranscript = await transcribe(groqKey, buffer, ext);

    await tgSend(token, chatId, "🧠 Analysing speakers and summarising…");

    // 3. Diarise
    const diarisePrompt = `Diarise this transcript. Return ONLY valid JSON (no backticks):
{"speakers":{"A":"name"},"transcript":[{"s":"A","t":"0:00","text":"cleaned"}]}
Rules:
- Translate any Mandarin/Chinese spoken words to English. Wrap in [zh|English translation][/zh]
- Phonetically transcribed Mandarin/Hokkien: "lai liao"/"lie there" → [zh|come already][/zh], "kuai teng" → [zh|faster][/zh], "mai lah" → [zh|don't want][/zh], "ho seh" → [zh|great][/zh]
- Wrap Singlish slang in [sg]text[/sg]
- Max 4 speakers
TRANSCRIPT: ${rawTranscript}`;

    const diariseRaw = await callClaude(anthropicKey, diarisePrompt, 4096);
    const { speakers, transcript } = JSON.parse(diariseRaw) as {
      speakers: Record<string, string>;
      transcript: { s: string; t: string; text: string }[];
    };

    // 4. Summarise
    const transcriptText = transcript
      .map((u) => `${speakers[u.s] ?? u.s} [${u.t}]: ${u.text}`)
      .join("\n");

    const summaryPrompt = `Analyse this meeting. Return ONLY JSON (no backticks):
{"summary":"2-3 sentences","actions":[{"text":"item","owner":"person","done":false}]}
Max 6 action items. Be specific and actionable.
TRANSCRIPT: ${transcriptText}`;

    const summaryRaw = await callClaude(anthropicKey, summaryPrompt, 1024);
    const { summary, actions } = JSON.parse(summaryRaw) as {
      summary: string;
      actions: { text: string; owner: string }[];
    };

    // 5. Generate flowchart
    let flow = "";
    try {
      const excerpts = transcript
        .slice(0, 20)
        .map((u) => `${speakers[u.s] ?? u.s}: ${u.text}`)
        .join("\n");
      const flowPrompt = `Generate a flowchart for this meeting as JSON. Return ONLY valid JSON — no backticks, no markdown, no explanation.
Format: {"nodes":[{"id":"n1","label":"short label","type":"start"}],"edges":[{"source":"n1","target":"n2","label":"optional"}]}
Node types: "start","end","decision","step"
Rules: 6-12 nodes, labels max 5 words. When content lists multiple items under a parent (e.g. "three rules: A, B, C"), that parent node must be the "source" in SEPARATE edges to each child — NOT a chain A→B→C. Use decision nodes for yes/no or multi-choice points. Linear chains are fine when genuinely sequential.
MEETING: Voice memo
SUMMARY: ${summary}
DISCUSSION: ${excerpts}`;
      const flowRaw = await callClaude(anthropicKey, flowPrompt, 1024);
      const flowCleaned = flowRaw.replace(/^```(?:json)?\n?/m, "").replace(/\n?```$/m, "").trim();
      JSON.parse(flowCleaned); // validate
      flow = flowCleaned;
    } catch {
      // Non-critical — meeting saved without flowchart
    }

    // 6. Upload audio to Supabase Storage (best-effort)
    const meetingId = `tg-${Date.now()}`;
    let audioUrl: string | undefined;
    const mimeMap: Record<string, string> = {
      ogg: "audio/ogg", oga: "audio/ogg", mp3: "audio/mpeg",
      m4a: "audio/m4a", mp4: "audio/mp4", wav: "audio/wav", webm: "audio/webm",
    };
    try {
      const sb2 = getServerSupabase();
      if (sb2) {
        const storageExt = ext === "oga" ? "ogg" : ext;
        const storagePath = `${meetingId}/${Date.now()}.${storageExt}`;
        const { error: uploadErr } = await sb2.storage
          .from("recordings")
          .upload(storagePath, buffer, { contentType: mimeMap[ext] ?? "audio/ogg", upsert: true });
        if (!uploadErr) {
          const { data: urlData } = sb2.storage.from("recordings").getPublicUrl(storagePath);
          audioUrl = urlData.publicUrl;
        }
      }
    } catch { /* non-critical */ }

    // 7. Save to Supabase
    const allText = transcript.map((u) => u.text).join(" ");
    const languages = [
      "en",
      ...(/\[zh\|/.test(allText) ? ["zh"] : []),
      ...(/\[sg\]/.test(allText) ? ["sg"] : []),
    ];
    const meeting = {
      id: meetingId,
      title: `Voice memo ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      folder: "personal",
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      duration: `${Math.ceil(transcript.length * 0.5)} min`,
      languages,
      speakers,
      transcript,
      summary,
      actions,
      flow,
      ...(audioUrl ? { audiourl: audioUrl } : {}),
    };
    const sb = getServerSupabase();
    if (sb) await sb.from("meetings").upsert(meeting);

    // 6. Format reply
    const speakerNames = Object.values(speakers).join(", ");
    const actionLines =
      actions.length > 0
        ? actions
            .map((a) => `• ${esc(stripMarkup(a.text))}${a.owner ? ` — <i>${esc(a.owner)}</i>` : ""}`)
            .join("\n")
        : "None identified";

    const reply = [
      "🎙 <b>Meeting processed</b>",
      "",
      "<b>Summary</b>",
      esc(stripMarkup(summary)),
      "",
      "<b>Action Items</b>",
      actionLines,
      "",
      `<b>Speakers:</b> ${esc(speakerNames)}`,
    ].join("\n");

    await tgSend(token, chatId, reply);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Unknown error";
    await tgSend(token, chatId, `❌ <b>Failed:</b> ${esc(errMsg)}`);
  }

  return NextResponse.json({ ok: true });
}
