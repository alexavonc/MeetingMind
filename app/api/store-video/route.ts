import { NextRequest, NextResponse } from "next/server";
import { appendFile, mkdir, readFile, rm, stat } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { getServerSupabase } from "@/lib/supabase";

export const maxDuration = 300;

// Supabase Storage default max per file is 50 MB on the free tier.
// Users can raise this in their Supabase dashboard → Storage → Settings.
const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB ceiling on our end

export async function POST(req: NextRequest) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

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

    const videoBuffer = await readFile(videoPath);
    const ext = fileExt.replace(/^\./, "");
    const storagePath = `${meetingId}/video.${ext}`;
    const contentType = ext === "webm" ? "video/webm"
      : ext === "mov" ? "video/quicktime"
      : ext === "avi" ? "video/x-msvideo"
      : "video/mp4";

    const { error } = await sb.storage
      .from("recordings")
      .upload(storagePath, videoBuffer, { contentType, upsert: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data } = sb.storage.from("recordings").getPublicUrl(storagePath);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  } finally {
    if (isLast) {
      await rm(dir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
