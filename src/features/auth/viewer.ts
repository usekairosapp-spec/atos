import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { cache } from "react";
import { resolveTimezone } from "@/shared/lib/timezone";

export type ViewerRole = "admin" | "leader" | "member";

export const getViewerContext = cache(async function getViewerContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: platformRole }, { data: churchMemberships }, { data: departmentMemberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_path, timezone").eq("id", user.id).single(),
    supabase.from("platform_roles").select("role").maybeSingle(),
    supabase.from("church_memberships").select("church_id, role, status").eq("user_id", user.id).eq("status", "active"),
    supabase.from("department_memberships").select("department_id, role, status").eq("user_id", user.id).eq("status", "active"),
  ]);

  const membershipChurchIds = churchMemberships?.map((item) => item.church_id) ?? [];
  const { data: churches } = platformRole
    ? await supabase.from("churches").select("id, name, logo_path, cover_path, primary_color, secondary_color").eq("status", "active").order("name")
    : membershipChurchIds.length
      ? await supabase.from("churches").select("id, name, logo_path, cover_path, primary_color, secondary_color").in("id", membershipChurchIds).eq("status", "active").order("name")
      : { data: [] as { id: string; name: string; logo_path: string | null; cover_path: string | null; primary_color: string; secondary_color: string }[] };
  const cookieStore = await cookies();
  const requestedChurchId = cookieStore.get("appescala_church_id")?.value;
  const currentChurch = churches?.find((church) => church.id === requestedChurchId) ?? churches?.[0] ?? null;


  const currentChurchMembership = churchMemberships?.find((item) => item.church_id === currentChurch?.id);
  const { data: currentDepartments } = currentChurch
    ? await supabase.from("departments").select("id").eq("church_id", currentChurch.id)
    : { data: [] as { id: string }[] };
  const currentDepartmentIds = new Set(currentDepartments?.map((item) => item.id) ?? []);
  const currentDepartmentMemberships = departmentMemberships?.filter((item) => currentDepartmentIds.has(item.department_id)) ?? [];
  const isAdmin = Boolean(platformRole) || currentChurchMembership?.role === "church_admin";
  const isLeader = currentDepartmentMemberships.some((item) => item.role === "leader");
  const role: ViewerRole = isAdmin ? "admin" : isLeader ? "leader" : "member";
  let avatarUrl: string | null = null;
  const churchLogoUrl = currentChurch?.logo_path ? supabase.storage.from("church-branding").getPublicUrl(currentChurch.logo_path).data.publicUrl : null;
  const churchCoverUrl = currentChurch?.cover_path ? supabase.storage.from("church-branding").getPublicUrl(currentChurch.cover_path).data.publicUrl : null;
  if (profile?.avatar_path) {
    const { data } = await supabase.storage.from("avatars").createSignedUrl(profile.avatar_path, 3600);
    avatarUrl = data?.signedUrl ?? null;
  }

  return {
    user,
    role,
    profile: { fullName: profile?.full_name || String(user.user_metadata.full_name ?? user.email ?? "Usuário"), avatarUrl, timezone: resolveTimezone(profile?.timezone) },
    churchMemberships: churchMemberships ?? [],
    departmentMemberships: currentDepartmentMemberships,
    churches: churches ?? [],
    currentChurch,
    churchBranding: { logoUrl: churchLogoUrl, coverUrl: churchCoverUrl, primaryColor: currentChurch?.primary_color ?? "#3584d7", textColor: currentChurch?.secondary_color ?? "#ffffff" },
    isPlatformAdmin: Boolean(platformRole),
    isChurchAdmin: currentChurchMembership?.role === "church_admin",
    isLeader,
  };
});
