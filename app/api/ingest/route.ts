import { NextRequest, NextResponse } from "next/server";

/**
 * POST /api/ingest
 *
 * Two modes:
 *
 * 1. Audio file mode (recommended — Voice Memos + Groq):
 *    Record on Apple Watch with built-in Voice Memos → iOS Shortcut sends the
 *    m4a file here → Groq whisper-large-v3 transcribes → Claude processes.
 *    Fields: file, title, folder, secret, provider ("groq" default)
 *    Server reads GROQ_API_KEY / WHISPER_API_KEY env var automatically.
 *
 * 2. Raw text mode (if you already have a transcript):
 *    Send transcript text directly, skip transcription entirely.
 *    Fields: text, title, folder, secret
 *
 * All fields are multipart/form-data.
 * secret must match MEETINGMIND_INGEST_SECRET env var (set in Railway Variables).
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();

    // Auth
    const secret = formData.get("secret") as string | null;
    const envSecret = process.env.MEETINGMIND_INGEST_SECRET;
    if (envSecret && secret !== envSecret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const claudeKey = (formData.get("claudeKey") as string) || process.env.ANTHROPIC_API_KEY || "";
    const title =
      (formData.get("title") as string) ||
      `Meeting ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`;
    const folder = (formData.get("folder") as string) || "personal";

    if (!claudeKey) return NextResponse.json({ error: "Missing claudeKey" }, { status: 400 });

    // Determine raw transcript — audio file (Groq) or pre-existing text
    let rawTranscript: string;
    const text = formData.get("text") as string | null;
    const file = formData.get("file") as File | null;

    if (file) {
      // Mode 1 (primary): audio file → Groq whisper-large-v3
      const whisperKey = (formData.get("whisperKey") as string) || process.env.GROQ_API_KEY || process.env.WHISPER_API_KEY || "";
      if (!whisperKey) return NextResponse.json({ error: "Missing whisperKey" }, { status: 400 });

      const provider = (formData.get("provider") as string) || "groq";
      const whisperProviders = {
        groq: { url: "https://api.groq.com/openai/v1/audio/transcriptions", model: "whisper-large-v3" },
        openai: { url: "https://api.openai.com/v1/audio/transcriptions", model: "whisper-1" },
      };
      const { url, model } = whisperProviders[provider as keyof typeof whisperProviders] ?? whisperProviders.groq;

      const wForm = new FormData();
      wForm.append("file", file);
      wForm.append("model", model);
      wForm.append("response_format", "text");
      const wRes = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${whisperKey}` },
        body: wForm,
      });
      if (!wRes.ok) {
        const e = await wRes.text();
        return NextResponse.json({ error: `Transcription failed: ${e}` }, { status: 502 });
      }
      rawTranscript = await wRes.text();
    } else if (text?.trim()) {
      // Mode 2 (fallback): pre-existing transcript text
      rawTranscript = text.trim();
    } else {
      return NextResponse.json({ error: "Provide either 'file' (audio) or 'text' (transcript)" }, { status: 400 });
    }

    // Step 2: Diarise via Claude
    const diarisePrompt = `Diarise this transcript. Return ONLY valid JSON (no backticks):
{"speakers":{"A":"name"},"transcript":[{"s":"A","t":"0:00","text":"cleaned"}]}
Rules:
- Wrap Mandarin in [zh|English translation|原文中文][/zh]
- Wrap Singlish slang in [sg]text[/sg]
- Max 4 speakers
TRANSCRIPT: ${rawTranscript}`;

    const claudeRes = await callClaude(claudeKey, diarisePrompt, 4096);
    const diarised = JSON.parse(claudeRes) as {
      speakers: Record<string, string>;
      transcript: { s: string; t: string; text: string }[];
    };

    // Step 3: Summarise
    const transcriptText = diarised.transcript
      .map((u) => `${diarised.speakers[u.s] ?? u.s} [${u.t}]: ${u.text}`)
      .join("\n");
    const summaryPrompt = `Analyse this meeting. Return ONLY JSON (no backticks):
{"summary":"2-3 sentences","actions":[{"text":"item","owner":"person","done":false}]}
Max 6 action items.
TRANSCRIPT: ${transcriptText}`;

    const summaryRaw = await callClaude(claudeKey, summaryPrompt, 1024);
    const { summary, actions } = JSON.parse(summaryRaw) as {
      summary: string;
      actions: { text: string; owner: string; done: boolean }[];
    };

    // Step 4: Flowchart
    const flowPrompt = `Generate a Mermaid.js flowchart. Return ONLY mermaid code, no backticks.
Use flowchart TD. Short labels. Emojis. Show discussion flow and next steps.
MEETING: ${title}
SUMMARY: ${summary}`;

    const flowRaw = await callClaude(claudeKey, flowPrompt, 1024);
    const flow = flowRaw.replace(/^```(?:mermaid)?\n?/m, "").replace(/\n?```$/m, "").trim();

    // Detect languages
    const allText = diarised.transcript.map((u) => u.text).join(" ");
    const languages = ["en", ...(/\[zh\|/.test(allText) ? ["zh"] : []), ...(/\[sg\]/.test(allText) ? ["sg"] : [])];

    const meeting = {
      id: `meeting-${Date.now()}`,
      title,
      folder,
      date: new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }),
      duration: `${Math.ceil(diarised.transcript.length * 0.5)} min`,
      languages,
      speakers: diarised.speakers,
      transcript: diarised.transcript,
      summary,
      actions,
      flow,
    };

    return NextResponse.json({ meeting });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

async function callClaude(apiKey: string, prompt: string, maxTokens: number): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(await res.text());
  const data = (await res.json()) as { content: { type: string; text: string }[] };
  return data.content.find((c) => c.type === "text")?.text ?? "";
}
