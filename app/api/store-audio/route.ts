import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ error: "Storage not configured" }, { status: 503 });

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const meetingId = formData.get("meetingId") as string | null;

    if (!file || !meetingId) {
      return NextResponse.json({ error: "Missing file or meetingId" }, { status: 400 });
    }

    const ext = file.name.split(".").pop() ?? "audio";
    const path = `${meetingId}/${Date.now()}.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const { error } = await sb.storage
      .from("recordings")
      .upload(path, arrayBuffer, { contentType: file.type, upsert: true });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const { data } = sb.storage.from("recordings").getPublicUrl(path);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Upload failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
