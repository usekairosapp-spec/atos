import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewerContext } from "@/features/auth/viewer";

export async function GET() {
  const [supabase, viewer] = await Promise.all([createClient(), getViewerContext()]);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ count: 0 }, { status: 401 });
  if (!viewer?.currentChurch) return NextResponse.json({ count: 0 });
  const { count } = await supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("church_id", viewer.currentChurch.id).is("read_at", null);
  return NextResponse.json({ count: count ?? 0 });
}
