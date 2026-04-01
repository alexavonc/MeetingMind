import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getServerSupabase } from "@/lib/supabase";

/**
 * POST /api/telegram/generate-link
 * Authenticated — caller must send their Supabase access token as Bearer.
 * Returns a short-lived one-time token the user sends to the Telegram bot
 * via `/start <token>` to link their Telegram chat ID to their account.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const accessToken = auth.slice(7);

  // Verify the user via their access token
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    return NextResponse.json({ error: "Supabase not configured" }, { status: 500 });
  }
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const sb = getServerSupabase();
  if (!sb) return NextResponse.json({ error: "Server error" }, { status: 500 });

  // Generate a random token and store it with a 15-minute expiry
  const token = Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 16);

  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  // Delete any existing token for this user, then insert a fresh one
  await sb.from("telegram_link_tokens").delete().eq("user_id", user.id);
  const { error: insertError } = await sb.from("telegram_link_tokens").insert(
    { token, user_id: user.id, expires_at: expiresAt }
  );

  if (insertError) {
    console.error("telegram_link_tokens insert failed:", insertError);
    return NextResponse.json({ error: `DB error: ${insertError.message}` }, { status: 500 });
  }

  return NextResponse.json({ token });
}
