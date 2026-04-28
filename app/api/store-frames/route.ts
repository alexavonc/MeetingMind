import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  try {
    const { meetingId, frames } = (await req.json()) as {
      meetingId: string;
      frames: { dataUrl: string; timestamp: number }[];
    };

    if (!meetingId || !frames?.length) {
      return NextResponse.json({ error: "Missing meetingId or frames" }, { status: 400 });
    }

    const results: { url: string; timestamp: number }[] = [];

    for (const frame of frames) {
      const base64 = frame.dataUrl.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(base64, "base64");
      const path = `${meetingId}/frame-${Math.round(frame.timestamp)}.jpg`;

      const { error } = await sb.storage
        .from("recordings")
        .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

      if (error) continue; // skip individual failures silently

      const { data } = sb.storage.from("recordings").getPublicUrl(path);
      results.push({ url: data.publicUrl, timestamp: frame.timestamp });
    }

    return NextResponse.json({ frameUrls: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
