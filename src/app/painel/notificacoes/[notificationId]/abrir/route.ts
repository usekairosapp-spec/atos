import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getViewerContext } from "@/features/auth/viewer";

export async function GET(request: Request, { params }: { params: Promise<{ notificationId: string }> }) {
  const { notificationId } = await params;
  const [supabase, viewer] = await Promise.all([createClient(), getViewerContext()]);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/entrar", request.url));
  const { data: notification } = await supabase.from("notifications").select("href, kind").eq("id", notificationId).eq("user_id", user.id).eq("church_id", viewer?.currentChurch?.id ?? "00000000-0000-0000-0000-000000000000").maybeSingle();
  if (!notification) return NextResponse.redirect(new URL("/painel/notificacoes", request.url));
  await supabase.rpc("mark_notification_read", { target_notification_id: notificationId });
  const personalKinds = new Set(["schedule_published", "schedule_added", "schedule_updated", "swap_accepted", "swap_rejected"]);
  const safeHref = notification.href?.startsWith("/painel/") ? notification.href : "/painel/notificacoes";
  const destination = personalKinds.has(notification.kind) && /^\/painel\/escalas\/[^/?]+$/.test(safeHref)
    ? `${safeHref}?visao=minhas`
    : safeHref;
  return NextResponse.redirect(new URL(destination, request.url));
}
