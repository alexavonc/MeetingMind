import { notFound } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase";
import type { Meeting } from "@/types";
import ShareView from "./ShareView";

export default async function SharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const sb = getServerSupabase();
  if (!sb) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground text-sm">
        Supabase not configured.
      </div>
    );
  }

  const { data, error } = await sb
    .from("meetings")
    .select("*")
    .eq("sharetoken", token)
    .single();

  if (error || !data) {
    notFound();
  }

  const meeting = data as Meeting;

  return <ShareView meeting={meeting} />;
}
