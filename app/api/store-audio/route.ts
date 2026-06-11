import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const meetingId = formData.get("meetingId") as string | null;

    if (!file || !meetingId) {
      return NextResponse.json({ error: "Missing file or meetingId" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "audio";
    const key = `${meetingId}/audio.${ext}`;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const url = await uploadToR2(key, buffer, file.type || "audio/mpeg");
    if (!url) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

    return NextResponse.json({ url });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
