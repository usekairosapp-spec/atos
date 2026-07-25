import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/entrar", request.url));
  const { data: platformRole } = await supabase.from("platform_roles").select("role").maybeSingle();
  if (!platformRole) return NextResponse.redirect(new URL("/painel", request.url));
  const { data: notification } = await supabase.from("notifications").select("href").eq("id", notificationId).eq("user_id", user.id).maybeSingle();
  if (!notification) return NextResponse.redirect(new URL("/central/notificacoes", request.url));
  await Promise.all([
    supabase.rpc("mark_notification_read", { target_notification_id: notificationId }),
    supabase.from("notifications").delete().eq("id", notificationId),
  ]);
  const destination = notification.href?.startsWith("/central") ? notification.href : "/central/igrejas";
  return NextResponse.redirect(new URL(destination, request.url));
}
