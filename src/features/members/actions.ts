"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const inviteSchema = z.string().trim().min(6).max(16);

export async function requestMembership(formData: FormData) {
  const parsed = inviteSchema.safeParse(formData.get("inviteCode"));
  if (!parsed.success) redirect("/painel?erro=Código de igreja inválido.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_church_membership", { code: parsed.data });
  if (error) redirect(`/painel?erro=${encodeURIComponent(error.message)}`);
  redirect("/painel?sucesso=Solicitação enviada para a administradora.");
}

export async function reviewMembership(formData: FormData) {
  const membershipId = z.string().uuid().safeParse(formData.get("membershipId"));
  const decision = z.enum(["active", "rejected", "suspended"]).safeParse(formData.get("decision"));
  if (!membershipId.success || !decision.success) redirect("/painel/membros?erro=Solicitação inválida.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_church_membership", {
    target_membership_id: membershipId.data,
    decision: decision.data,
  });
  if (error) redirect(`/painel/membros?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/painel/membros");
  revalidatePath("/painel", "layout");
  redirect(`/painel/membros?sucesso=${decision.data === "active" ? "Membro aprovado com sucesso." : "Solicitação recusada."}`);
}

export async function assignDepartment(formData: FormData) {
  const parsed = z.object({
    userId: z.string().uuid(),
    role: z.enum(["leader", "member"]),
    departmentIds: z.array(z.string().uuid()).min(1),
  }).safeParse({
    userId: formData.get("userId"),
    role: formData.get("role"),
    departmentIds: formData.getAll("departmentId"),
  });
  if (!parsed.success) redirect("/painel/membros?erro=Vínculo de setor inválido.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_department_memberships", {
    target_department_ids: parsed.data.departmentIds,
    target_user_id: parsed.data.userId,
    target_role: parsed.data.role,
  });
  if (error) redirect(`/painel/membros?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/painel/membros");
  revalidatePath("/painel", "layout");
  revalidatePath("/painel/setores");
  revalidatePath("/painel/escalas");
  redirect(`/painel/membros?sucesso=${encodeURIComponent(parsed.data.departmentIds.length === 1 ? "Pessoa adicionada à equipe." : `Pessoa adicionada a ${parsed.data.departmentIds.length} equipes.`)}`);
}

export async function removeDepartmentLeadership(formData: FormData) {
  const parsed = z.object({
    departmentId: z.string().uuid(),
    userId: z.string().uuid(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/membros?erro=Liderança inválida.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("assign_department_membership", {
    target_department_id: parsed.data.departmentId,
    target_user_id: parsed.data.userId,
    target_role: "member",
  });
  if (error) redirect(`/painel/membros?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/painel/membros");
  revalidatePath("/painel", "layout");
  revalidatePath("/painel/setores");
  revalidatePath("/painel/escalas");
  redirect("/painel/membros?sucesso=Liderança atualizada. A pessoa continua como membro do setor.");
}

export async function removeChurchMember(formData: FormData) {
  const membershipId = z.string().uuid().safeParse(formData.get("membershipId"));
  if (!membershipId.success) redirect("/painel/membros?erro=Membro inválido.");

  const supabase = await createClient();
  const { data: removedAssignments, error } = await supabase.rpc("remove_church_member", {
    target_membership_id: membershipId.data,
  });
  if (error) redirect(`/painel/membros?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/painel/membros");
  revalidatePath("/painel/escalas");
  revalidatePath("/painel");
  const count = Number(removedAssignments ?? 0);
  redirect(`/painel/membros?sucesso=${encodeURIComponent(count > 0 ? `Membro removido e ${count} participação(ões) futura(s) cancelada(s).` : "Membro removido da igreja e dos setores.")}`);
}

export async function platformReviewMembership(formData: FormData) {
  const parsed = z.object({ membershipId: z.string().uuid(), decision: z.enum(["active", "rejected"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/central/solicitacoes?erro=Solicitação inválida.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("platform_review_church_membership", { target_membership_id: parsed.data.membershipId, decision: parsed.data.decision });
  if (error) redirect(`/central/solicitacoes?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/central/solicitacoes");
  revalidatePath("/central/notificacoes");
  revalidatePath("/central", "layout");
  redirect(`/central/solicitacoes?sucesso=${parsed.data.decision === "active" ? "Membro aprovado com sucesso." : "Solicitação recusada."}`);
}

export async function removeDepartmentMember(formData: FormData) {
  const parsed = z.object({
    departmentId: z.string().uuid(),
    userId: z.string().uuid(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/setores?erro=Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.from("department_memberships").delete().eq("department_id", parsed.data.departmentId).eq("user_id", parsed.data.userId);
  if (error) redirect(`/painel/setores?erro=${encodeURIComponent(error.message)}`);

  revalidatePath("/painel/membros");
  revalidatePath("/painel/setores");
  revalidatePath("/painel/escalas");
  redirect(`/painel/setores?sucesso=Pessoa removida do setor.`);
}
