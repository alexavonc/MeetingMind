import { NextRequest, NextResponse } from "next/server";
import { getServerSupabase } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { meetingId } = (await req.json()) as { meetingId: string };
    if (!meetingId) return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });

    const sb = getServerSupabase();
    if (!sb) return NextResponse.json({ error: "DB not configured" }, { status: 500 });

    // Check if a sharetoken already exists
    const { data: existing } = await sb
      .from("meetings")
      .select("sharetoken")
      .eq("id", meetingId)
      .single();

    let token = existing?.sharetoken as string | null;
    if (!token) {
      token = crypto.randomUUID();
      const { error } = await sb
        .from("meetings")
        .update({ sharetoken: token })
        .eq("id", meetingId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ token });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
