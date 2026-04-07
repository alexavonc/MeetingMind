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

/** Look up which Supabase user owns this Telegram chat ID. Returns null if unlinked. */
async function resolveUserId(chatId: number): Promise<string | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("telegram_links")
    .select("user_id")
    .eq("telegram_chat_id", chatId)
    .maybeSingle();
  return data?.user_id ?? null;
}

/** Fetch the API keys a user has saved in their MeetingMind settings. */
async function getUserApiKeys(userId: string): Promise<{ groqKey?: string; anthropicKey?: string } | null> {
  const sb = getServerSupabase();
  if (!sb) return null;
  const { data } = await sb
    .from("user_settings")
    .select("groq_api_key, anthropic_api_key")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) return null;
  return {
    groqKey: data.groq_api_key ?? undefined,
    anthropicKey: data.anthropic_api_key ?? undefined,
  };
}

export async function POST(req: NextRequest) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return NextResponse.json({ ok: true });

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  // Return 200 immediately so Telegram never retries (long meetings take minutes to process)
  void processUpdate(token, update);
  return NextResponse.json({ ok: true });
}

async function processUpdate(token: string, update: TgUpdate) {
  let groqKey = process.env.GROQ_API_KEY;
  let anthropicKey = process.env.ANTHROPIC_API_KEY;

  const msg = update.message;
  if (!msg) return NextResponse.json({ ok: true });

  const chatId = msg.chat.id;

  // ── /start <token> — link this Telegram chat to a MeetingMind account ───────
  if (msg.text?.startsWith("/start")) {
    const linkToken = msg.text.split(" ")[1]?.trim();
    if (!linkToken) {
      await tgSend(token, chatId,
        "👋 <b>MeetingMind bot</b>\n\nSend me a voice note or audio file and I'll transcribe and summarise your meeting.\n\nTo link your account, use the <b>Link Telegram</b> button in the MeetingMind Settings.");
      return NextResponse.json({ ok: true });
    }

    const sb = getServerSupabase();
    if (!sb) return NextResponse.json({ ok: true });

    // Validate the token
    const { data: row } = await sb
      .from("telegram_link_tokens")
      .select("user_id, expires_at")
      .eq("token", linkToken)
      .maybeSingle();

    if (!row) {
      await tgSend(token, chatId, "❌ Invalid or already-used link code. Generate a new one from MeetingMind Settings.");
      return NextResponse.json({ ok: true });
    }
    if (new Date(row.expires_at) < new Date()) {
      await tgSend(token, chatId, "⏰ This link code has expired. Generate a new one from MeetingMind Settings.");
      await sb.from("telegram_link_tokens").delete().eq("token", linkToken);
      return NextResponse.json({ ok: true });
    }

    // Persist the chat_id → user_id mapping
    await sb.from("telegram_links").upsert(
      { telegram_chat_id: chatId, user_id: row.user_id },
      { onConflict: "telegram_chat_id" }
    );
    // Consume the token
    await sb.from("telegram_link_tokens").delete().eq("token", linkToken);

    await tgSend(token, chatId,
      "✅ <b>Account linked!</b>\n\nYour Telegram is now connected to MeetingMind. Send me any voice note or audio file and your meeting will appear in your dashboard.");
    return NextResponse.json({ ok: true });
  }

  // Non-audio message → send instructions
  const fileRef =
    msg.voice ??
    msg.audio ??
    (msg.document?.mime_type?.startsWith("audio/") ? msg.document : undefined);

  if (!fileRef) {
    await tgSend(
      token,
      chatId,
      "👋 <b>MeetingMind bot</b>\n\nSend me a voice note or audio file and I'll transcribe and summarise your meeting automatically.\n\nTo link your account, use the <b>Link Telegram</b> button in MeetingMind Settings."
    );
    return NextResponse.json({ ok: true });
  }

  // Prefer the linked user's own API keys; fall back to server env vars
  const linkedUserId = await resolveUserId(chatId);
  if (linkedUserId) {
    const userKeys = await getUserApiKeys(linkedUserId);
    if (userKeys?.groqKey) groqKey = userKeys.groqKey;
    if (userKeys?.anthropicKey) anthropicKey = userKeys.anthropicKey;
  }

  if (!groqKey || !anthropicKey) {
    await tgSend(
      token,
      chatId,
      "❌ No API keys found. Please add your Groq and Anthropic keys in MeetingMind Settings, or ask the admin to configure server-side keys."
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
- Identify DIFFERENT speakers by listening for: natural conversation turns, question-answer patterns, different speaking styles, topic handoffs, or phrases like "yeah", "okay", "so" that signal a response. Even if not obvious, try to assign at least 2 speakers if the content suggests a dialogue or briefing with responses.
- Translate any Mandarin/Chinese spoken words to English. Wrap in [zh|English translation][/zh]
- Phonetically transcribed Mandarin/Hokkien: "lai liao"/"lie there" → [zh|come already][/zh], "kuai teng" → [zh|faster][/zh], "mai lah" → [zh|don't want][/zh], "ho seh" → [zh|great][/zh]
- Translate any Malay words or phrases to English. Wrap in [ms|English translation][/ms]. e.g. "contohnya" → [ms|for example][/ms], "boleh" → [ms|can][/ms], "sudah"/"dah" → [ms|already][/ms], full Malay sentences translated fully
- Wrap Singlish slang in [sg]text[/sg]
- Max 4 speakers. Use "Speaker A", "Speaker B" etc. if names are unknown.
TRANSCRIPT: ${rawTranscript}`;

    const diariseRaw = await callClaude(anthropicKey, diarisePrompt, 16000);
    const { speakers, transcript } = JSON.parse(diariseRaw) as {
      speakers: Record<string, string>;
      transcript: { s: string; t: string; text: string }[];
    };

    // 4. Summarise
    const transcriptText = transcript
      .map((u) => `${speakers[u.s] ?? u.s} [${u.t}]: ${u.text}`)
      .join("\n");

    const summaryPrompt = `Analyse this meeting transcript. Return ONLY valid JSON (no backticks, no markdown wrapper):
{"summary":"<markdown>","actions":[{"text":"item","owner":"person or empty string","done":false}]}

For the "summary" field, produce a STRUCTURED document in markdown with headed sections:
- ## Section Title  (e.g. "## What it is", "## Core challenges", "## How it works today", "## Goals", "## Vision", "## Next steps")
- Use "-" for bullet lists, "1." for numbered/ordered goals
- Use **bold** for key terms or vision statements
- Choose sections that fit the content. Aim for 4-7 sections.
- Keep bullets concise (one idea each).

Rules for actions: Max 6 items, concrete tasks only, assign owner from speaker names where clear.
TRANSCRIPT: ${transcriptText}`;

    const summaryRaw = await callClaude(anthropicKey, summaryPrompt, 2048);
    const { summary, actions } = JSON.parse(summaryRaw) as {
      summary: string;
      actions: { text: string; owner: string }[];
    };

    // 5. Generate flowchart
    let flow = "";
    try {
      const flowPrompt = `You are building a MIND MAP (not a flowchart) for a meeting discussion. Return ONLY valid JSON — no backticks, no markdown, no explanation.
Format: {"nodes":[{"id":"n1","label":"short label","type":"start"}],"edges":[{"source":"n1","target":"n2"}]}
Node types: "start" (root topic), "step" (theme or sub-point), "end" (conclusion/outcome), "decision" (fork)
Rules:
1. Single root "start" node = overall meeting topic
2. 2-5 main theme nodes connected to root
3. 1-3 sub-point nodes per theme, connected to their parent
4. Labels = clean concepts (3-5 words), NOT speech paraphrases
5. Parallel sub-points fan out from parent — NEVER chain A→B→C
6. ONLY add edge labels on decision node edges. Never label fan-out edges.
7. Aim for 10-18 nodes total
MEETING: Voice memo
SUMMARY: ${summary}
TRANSCRIPT: ${transcriptText}`;
      const flowRaw = await callClaude(anthropicKey, flowPrompt, 2048);
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
      ...(/\[ms\|/.test(allText) ? ["ms"] : []),
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
    if (sb) {
      const userId = linkedUserId ?? process.env.ADMIN_USER_ID;
      const row = userId ? { ...meeting, user_id: userId } : meeting;
      await sb.from("meetings").upsert(row);
    }

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
}
