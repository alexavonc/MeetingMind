import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import { appendFile, mkdir, readFile, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { uploadToR2, getR2Client } from "@/lib/r2";

const execAsync = promisify(exec);
export const maxDuration = 300;

const GROQ_URL = "https://api.groq.com/openai/v1/audio/transcriptions";
const OPENAI_URL = "https://api.openai.com/v1/audio/transcriptions";
const SG_PROMPT = "Singapore English meeting. Code-switching between English, Singlish, and Mandarin Chinese. Common Singlish: lah, lor, meh, can, cannot, sia, walao, alamak, shiok, confirm, already.";

const MAX_VIDEO_STORE_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB — R2 has no per-file limit on free tier

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
    await mkdir(dir, { recursive: true });
    const buf = await chunk.arrayBuffer();
    await appendFile(videoPath, Buffer.from(buf));

    if (!isLast) {
      return NextResponse.json({ received: true, chunkIndex });
    }

    // ── Final chunk: extract audio + transcribe ───────────────────────────────
    const whisperKey = formData.get("whisperKey") as string;
    const provider = (formData.get("provider") as string) || "groq";
    const meetingId = formData.get("meetingId") as string | null;
    const originalExt = (formData.get("fileExt") as string | null) ?? "mp4";

    if (!whisperKey) return NextResponse.json({ error: "Missing API key" }, { status: 400 });

    // Check for audio stream before attempting extraction
    try {
      const { stdout } = await execAsync(`ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "${videoPath}"`);
      if (!stdout.trim()) {
        return NextResponse.json({ error: "This video has no audio track — MeetingMind needs audio to transcribe." }, { status: 422 });
      }
    } catch {
      // ffprobe not available — proceed and let ffmpeg error naturally
    }

    try {
      await execAsync(`ffmpeg -y -i "${videoPath}" -vn -ar 16000 -ac 1 -b:a 32k "${audioPath}"`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("does not contain any stream") || msg.includes("Invalid argument")) {
        return NextResponse.json({ error: "This video has no audio track — MeetingMind needs audio to transcribe." }, { status: 422 });
      }
      throw err;
    }

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

    // ── Store original video in R2 (only when R2 is configured) ─────────────
    let videoUrl = "";
    if (meetingId && getR2Client()) {
      try {
        const fileStats = await stat(videoPath);
        if (fileStats.size <= MAX_VIDEO_STORE_BYTES) {
          const videoBuffer = await readFile(videoPath);
          const ext = originalExt.replace(/^\./, "");
          const key = `${meetingId}/video.${ext}`;
          const contentType = ext === "webm" ? "video/webm"
            : ext === "mov" ? "video/quicktime"
            : ext === "avi" ? "video/x-msvideo"
            : "video/mp4";
          videoUrl = (await uploadToR2(key, videoBuffer, contentType)) ?? "";
        }
      } catch { /* non-critical — transcription succeeded, video storage optional */ }
    }

    return NextResponse.json({ text, videoUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (isLast) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
