"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createChurchSchema, createSlug } from "@/features/churches/church.schemas";

export async function createChurch(formData: FormData) {
  const parsed = createChurchSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) redirect(`/central?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Nome inválido.")}`);

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_church_with_admin", {
    church_name: parsed.data.name,
    church_slug: createSlug(parsed.data.name),
  });

  if (error) redirect(`/central?erro=${encodeURIComponent(error.message)}`);
  redirect("/central?sucesso=Igreja criada com os seis setores.");
}

export async function assignChurchAdmin(formData: FormData) {
  const userIds = formData.getAll("userId").map(String).filter((id) => id);
  const churchId = z.string().uuid().safeParse(formData.get("churchId"));
  if (!churchId.success) redirect("/central?erro=Igreja inválida.");
  if (!userIds.length) redirect("/central?erro=Selecione pelo menos um responsável.");

  const supabase = await createClient();

  // Remove todos os responsáveis antigos
  await supabase.from("church_memberships").update({ role: "member" }).eq("church_id", churchId.data).eq("role", "church_admin");

  const errors: string[] = [];

  // Adiciona novos responsáveis
  for (const userId of userIds) {
    if (!z.string().uuid().safeParse(userId).success) {
      errors.push("Um dos responsáveis é inválido.");
      continue;
    }
    const { error } = await supabase.from("church_memberships").update({ role: "church_admin" }).eq("church_id", churchId.data).eq("user_id", userId);
    if (error) errors.push(error.message);
  }

  if (errors.length) redirect(`/central?erro=${encodeURIComponent(errors[0])}`);
  redirect("/central?sucesso=Responsáveis da igreja atualizados.");
}

export async function deleteChurch(formData: FormData) {
  const parsed = z.object({ churchId: z.string().uuid(), expectedName: z.string().min(2).max(120) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/central/igrejas?erro=Confirmação de exclusão inválida.");
  const supabase = await createClient();
  const { data: storedFiles } = await supabase.storage.from("church-branding").list(parsed.data.churchId, { limit: 100 });
  const { data: deletedName, error } = await supabase.rpc("delete_church_permanently", { target_church_id: parsed.data.churchId, expected_church_name: parsed.data.expectedName });
  if (error) redirect(`/central/igrejas?erro=${encodeURIComponent(error.message)}`);
  const paths = storedFiles?.map((file) => `${parsed.data.churchId}/${file.name}`) ?? [];
  if (paths.length) await supabase.storage.from("church-branding").remove(paths);
  redirect(`/central/igrejas?sucesso=${encodeURIComponent(`Igreja ${deletedName ?? parsed.data.expectedName} excluída permanentemente.`)}`);
}

export async function switchAdminChurch(formData: FormData) {
  const churchId = z.string().uuid().safeParse(formData.get("churchId"));
  if (!churchId.success) redirect("/painel?erro=Igreja inválida.");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");
  const { data: membership } = await supabase.from("church_memberships").select("id").eq("church_id", churchId.data).eq("user_id", user.id).eq("role", "church_admin").eq("status", "active").maybeSingle();
  if (!membership) redirect("/painel?erro=Você não administra esta igreja.");
  const cookieStore = await cookies();
  cookieStore.set("appescala_church_id", churchId.data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });
  redirect("/painel?sucesso=Igreja selecionada. O painel agora mostra somente os dados dela.");
}
