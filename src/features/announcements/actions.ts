"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewerContext } from "@/features/auth/viewer";

const announcementSchema = z.object({
  title: z.string().trim().min(2, "Informe um título.").max(150),
  body: z.string().trim().min(2, "Escreva o comunicado.").max(2000),
  scope: z.string().min(1),
  targetUserId: z.string().uuid().optional().or(z.literal("")),
});

export async function createAnnouncement(formData: FormData) {
  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
    scope: formData.get("scope"),
    targetUserId: formData.get("targetUserId") ?? "",
  });
  if (!parsed.success) redirect(`/painel/comunicados?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`);

  const viewer = await getViewerContext();
  if (!viewer?.currentChurch) redirect("/painel?erro=Nenhuma igreja selecionada.");

  const [scopeKind, scopeId] = parsed.data.scope.split(":");
  const departmentId = scopeKind === "dept" ? scopeId : null;
  const targetUserId = parsed.data.targetUserId || null;

  if (scopeKind !== "church" && scopeKind !== "dept") redirect("/painel/comunicados?erro=Destino inválido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_announcement", {
    target_church_id: viewer.currentChurch.id,
    target_department_id: departmentId,
    target_user_id_param: targetUserId,
    announcement_title: parsed.data.title,
    announcement_body: parsed.data.body,
  });
  if (error) redirect(`/painel/comunicados?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/painel/comunicados");
  revalidatePath("/painel/notificacoes");
  redirect("/painel/comunicados?sucesso=Comunicado publicado com sucesso.");
}

export async function deleteAnnouncement(formData: FormData) {
  const parsed = z.object({ announcementId: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/comunicados?erro=Comunicado inválido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_announcement", { target_announcement_id: parsed.data.announcementId });
  if (error) redirect(`/painel/comunicados?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/painel/comunicados");
  revalidatePath("/painel/notificacoes");
  redirect("/painel/comunicados?sucesso=Comunicado removido.");
}
