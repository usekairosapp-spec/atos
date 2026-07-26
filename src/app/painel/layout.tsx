import { redirect } from "next/navigation";
import { getViewerContext } from "@/features/auth/viewer";
import { AppShell } from "@/shared/components/app-shell";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/entrar");

  const viewer = await getViewerContext();
  if (!viewer) {
    const [{ data: profile }, { data: platformRole }] = await Promise.all([
      supabase.from("profiles").select("full_name, avatar_path").eq("id", user.id).single(),
      supabase.from("platform_roles").select("role").maybeSingle(),
    ]);

    if (platformRole) redirect("/central");

    return (
      <AppShell
        fullName={profile?.full_name || user.user_metadata?.full_name || user.email || "Usuário"}
        avatarUrl={null}
        role="member"
        unreadCount={0}
        churchName={null}
        churchLogoUrl={null}
        primaryColor="#6d35d7"
      >
        {children}
      </AppShell>
    );
  }

  if (viewer.isPlatformAdmin) redirect("/central");
  const unreadQuery = supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  const { count: unreadCount } = viewer.currentChurch ? await unreadQuery.eq("church_id", viewer.currentChurch.id) : { count: 0 };
  return <AppShell fullName={viewer.profile.fullName} avatarUrl={viewer.profile.avatarUrl} role={viewer.role} unreadCount={unreadCount ?? 0} churchName={viewer.currentChurch?.name ?? null} churchLogoUrl={viewer.churchBranding.logoUrl} primaryColor={viewer.churchBranding.primaryColor}>{children}</AppShell>;
}
