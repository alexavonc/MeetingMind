import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

/** GET /api/store-frames?meetingId=xxx — list frames already in Storage for this meeting */
export async function GET(req: NextRequest) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  const meetingId = req.nextUrl.searchParams.get("meetingId");
  if (!meetingId) return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });

  const { data, error } = await sb.storage.from("recordings").list(meetingId, { limit: 200 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const frameUrls = (data ?? [])
    .filter((f: { name: string }) => /^frame-(\d+)\.jpg$/.test(f.name))
    .map((f: { name: string }) => {
      const timestamp = parseInt(f.name.replace("frame-", "").replace(".jpg", ""), 10);
      const { data: urlData } = sb.storage.from("recordings").getPublicUrl(`${meetingId}/${f.name}`);
      return { url: urlData.publicUrl, timestamp };
    })
    .sort((a: { timestamp: number }, b: { timestamp: number }) => a.timestamp - b.timestamp);

  return NextResponse.json({ frameUrls });
}

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

    // Upload all frames in parallel
    const uploads = await Promise.allSettled(
      frames.map(async (frame) => {
        const base64 = frame.dataUrl.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64, "base64");
        const path = `${meetingId}/frame-${Math.round(frame.timestamp)}.jpg`;

        const { error } = await sb.storage
          .from("recordings")
          .upload(path, buffer, { contentType: "image/jpeg", upsert: true });

        if (error) return null;

        const { data } = sb.storage.from("recordings").getPublicUrl(path);
        return { url: data.publicUrl, timestamp: frame.timestamp };
      })
    );

    const results = uploads
      .filter((r) => r.status === "fulfilled" && r.value !== null)
      .map((r) => (r as PromiseFulfilledResult<{ url: string; timestamp: number }>).value);

    return NextResponse.json({ frameUrls: results });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
