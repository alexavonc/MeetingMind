import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, unlink, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";

const execAsync = promisify(exec);

export const maxDuration = 300;

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";
const SG_PROMPT = "Singapore English meeting. Code-switching between English, Singlish, and Mandarin Chinese. Common Singlish: lah, lor, meh, can, cannot, sia, walao, alamak, shiok, confirm, already.";

export async function POST(req: NextRequest) {
  const id = randomUUID();
  const tmpIn = join(tmpdir(), `mm-video-${id}-in`);
  const tmpOut = join(tmpdir(), `mm-video-${id}.mp3`);

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const whisperKey = formData.get("whisperKey") as string;
    const provider = (formData.get("provider") as string) || "groq";

    if (!file) return NextResponse.json({ error: "Missing video file" }, { status: 400 });
    if (!whisperKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });

    // Write video to temp file
    const buf = await file.arrayBuffer();
    await writeFile(tmpIn, Buffer.from(buf));

    // Extract audio: 16kHz mono mp3 at 32kbps — 40 min ≈ 10 MB, well under Groq limit
    await execAsync(
      `ffmpeg -y -i "${tmpIn}" -vn -ar 16000 -ac 1 -b:a 32k "${tmpOut}"`
    );

    const audioBuffer = await readFile(tmpOut);
    const audioFile = new File([audioBuffer], "audio.mp3", { type: "audio/mpeg" });

    // Transcribe
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
    // Clean up temp files
    await unlink(tmpIn).catch(() => {});
    await unlink(tmpOut).catch(() => {});
  }
}
