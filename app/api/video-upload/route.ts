import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { appendFile, mkdir, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

const execAsync = promisify(exec);
export const maxDuration = 300;

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";
const SG_PROMPT = "Singapore English meeting. Code-switching between English, Singlish, and Mandarin Chinese. Common Singlish: lah, lor, meh, can, cannot, sia, walao, alamak, shiok, confirm, already.";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const chunk = formData.get("chunk") as File | null;
  const uploadId = formData.get("uploadId") as string;
  const chunkIndex = parseInt(formData.get("chunkIndex") as string, 10);
  const totalChunks = parseInt(formData.get("totalChunks") as string, 10);

  if (!chunk || !uploadId || isNaN(chunkIndex) || isNaN(totalChunks)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const dir = join(tmpdir(), `mm-upload-${uploadId}`);
  const videoPath = join(dir, "video");
  const audioPath = join(dir, "audio.mp3");
  const isLast = chunkIndex === totalChunks - 1;

  try {
    // Append this chunk directly to the assembling video file (sequential uploads only)
    await mkdir(dir, { recursive: true });
    const buf = await chunk.arrayBuffer();
    await appendFile(videoPath, Buffer.from(buf));

    if (!isLast) {
      return NextResponse.json({ received: true, chunkIndex });
    }

    // ── Final chunk: extract audio + transcribe ───────────────────────────────
    const whisperKey = formData.get("whisperKey") as string;
    const provider = (formData.get("provider") as string) || "groq";

    if (!whisperKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });

    // Extract audio: 32kbps mono mp3 — 40 min ≈ 10 MB, well under Groq's 25 MB limit
    await execAsync(`ffmpeg -y -i "${videoPath}" -vn -ar 16000 -ac 1 -b:a 32k "${audioPath}"`);

    const audioBuffer = await readFile(audioPath);
    const audioFile = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });

    const form = new FormData();
    form.append("file", audioFile);
    form.append("model", provider === "openai" ? "whisper-1" : "whisper-large-v3");
    form.append("response_format", "text");
    form.append("prompt", SG_PROMPT);
    if (provider === "groq") form.append("language", "en");

    const apiUrl = provider === "openai" ? OPENAI_URL : GROQ_URL;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${whisperKey}` },
      body: form,
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: `Transcription failed: ${err}` }, { status: 502 });
    }

    const text = await res.text();
    return NextResponse.json({ text });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (isLast) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
