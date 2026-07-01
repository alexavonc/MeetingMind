import { NextRequest, NextResponse } from "next/server";
import { appendFile, mkdir, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { uploadFileToR2 } from "@/lib/r2";

export const maxDuration = 300;

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const chunk = formData.get("chunk") as File | null;
  const uploadId = formData.get("uploadId") as string;
  const chunkIndex = parseInt(formData.get("chunkIndex") as string, 10);
  const totalChunks = parseInt(formData.get("totalChunks") as string, 10);
  const meetingId = formData.get("meetingId") as string;
  const fileExt = (formData.get("fileExt") as string | null) ?? "mp4";

  if (!chunk || !uploadId || !meetingId || isNaN(chunkIndex) || isNaN(totalChunks)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const dir = join(tmpdir(), `mm-video-${uploadId}`);
  const videoPath = join(dir, `video.${fileExt}`);
  const isLast = chunkIndex === totalChunks - 1;

  try {
    await mkdir(dir, { recursive: true });
    const buf = await chunk.arrayBuffer();
    await appendFile(videoPath, Buffer.from(buf));

    if (!isLast) {
      return NextResponse.json({ received: true, chunkIndex });
    }

    const { size } = await stat(videoPath);
    if (size > MAX_BYTES) {
      return NextResponse.json({ error: "File too large" }, { status: 413 });
    }

    const ext = fileExt.replace(/^\./, "");
    const key = `${meetingId}/video.${ext}`;
    const contentType = ext === "webm" ? "video/webm"
      : ext === "mov" ? "video/quicktime"
      : ext === "avi" ? "video/x-msvideo"
      : "video/mp4";

    // Stream from disk instead of loading the whole video into RAM (avoids OOM)
    const url = await uploadFileToR2(key, videoPath, size, contentType);
    if (!url) {
      return NextResponse.json({ error: "R2 storage not configured or upload failed" }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (isLast) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
