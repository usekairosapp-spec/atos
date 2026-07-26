"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getViewerContext } from "@/features/auth/viewer";

const createDepartmentSchema = z.object({
  name: z.string().trim().min(2, "Nome do setor deve ter ao menos 2 caracteres.").max(100),
});

export async function createDepartment(formData: FormData) {
  const viewer = await getViewerContext();
  if (!viewer?.currentChurch || viewer.role !== "admin") {
    redirect("/painel?erro=Sem permissão para criar setores.");
  }

  const parsed = createDepartmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    redirect(`/painel/setores?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("departments").insert({
    church_id: viewer.currentChurch.id,
    name: parsed.data.name,
    type: "custom",
    active: true,
  }).select("id").single();

  if (error) {
    redirect(`/painel/setores?erro=${encodeURIComponent(error.message)}`);
  }

  redirect(`/painel/setores/${data.id}?sucesso=Setor criado com sucesso. Agora adicione funções e membros.`);
}

export async function deleteDepartment(formData: FormData) {
  const viewer = await getViewerContext();
  if (!viewer?.currentChurch || viewer.role !== "admin") {
    redirect("/painel?erro=Sem permissão para deletar setores.");
  }

  const departmentId = z.string().uuid().safeParse(formData.get("departmentId"));
  if (!departmentId.success) {
    redirect("/painel/setores?erro=Setor inválido.");
  }

  const supabase = await createClient();
  const { data: department } = await supabase.from("departments").select("church_id, name").eq("id", departmentId.data).single();

  if (!department || department.church_id !== viewer.currentChurch.id) {
    redirect("/painel/setores?erro=Setor não encontrado ou não pertence à sua igreja.");
  }

  const { error } = await supabase.from("departments").update({ active: false }).eq("id", departmentId.data);

  if (error) {
    redirect(`/painel/setores?erro=${encodeURIComponent(error.message)}`);
  }

  redirect(`/painel/setores?sucesso=Setor ${department.name} deletado com sucesso.`);
}
