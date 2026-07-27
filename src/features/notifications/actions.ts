"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getViewerContext } from "@/features/auth/viewer";

export async function markAllNotificationsRead() {
  const [supabase, viewer] = await Promise.all([createClient(), getViewerContext()]);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  if (!viewer?.currentChurch) return;
  await supabase.rpc("mark_church_notifications_read", { target_church_id: viewer.currentChurch.id });
  revalidatePath("/painel/notificacoes");
}

export async function markAllPlatformNotificationsRead() {
  const supabase = await createClient();
  const { data: platformRole } = await supabase.from("platform_roles").select("role").maybeSingle();
  if (!platformRole) return;
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/central/notificacoes");
  revalidatePath("/central", "layout");
}
