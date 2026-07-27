"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function markAllPlatformNotificationsRead() {
  const supabase = await createClient();
  const { data: platformRole } = await supabase.from("platform_roles").select("role").maybeSingle();
  if (!platformRole) return;
  await supabase.rpc("mark_all_notifications_read");
  revalidatePath("/central/notificacoes");
  revalidatePath("/central", "layout");
}
