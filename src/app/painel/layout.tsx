import { redirect } from "next/navigation";
import { getViewerContext } from "@/features/auth/viewer";
import { AppShell } from "@/shared/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const viewer = await getViewerContext();
  if (!viewer) redirect("/entrar");
  if (viewer.isPlatformAdmin) redirect("/central");
  const supabase = await createClient();
  const unreadQuery = supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const { count: unreadCount } = viewer.currentChurch ? await unreadQuery.eq("church_id", viewer.currentChurch.id) : { count: 0 };
  return <AppShell fullName={viewer.profile.fullName} avatarUrl={viewer.profile.avatarUrl} role={viewer.role} unreadCount={unreadCount ?? 0} churchName={viewer.currentChurch?.name ?? null} churchLogoUrl={viewer.churchBranding.logoUrl} primaryColor={viewer.churchBranding.primaryColor}>{children}</AppShell>;
}
