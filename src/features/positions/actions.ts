"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const positionSchema = z.object({
  departmentId: z.string().uuid(),
  name: z.string().trim().min(2, "Informe o nome da função.").max(80),
});

export async function createPosition(formData: FormData) {
  const parsed = positionSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/painel/setores?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Função inválida.")}`);
  const supabase = await createClient();
  const { error } = await supabase.from("positions").insert({ department_id: parsed.data.departmentId, name: parsed.data.name });
  if (error) redirect(`/painel/setores/${parsed.data.departmentId}?erro=${encodeURIComponent(error.code === "23505" ? "Essa função já existe." : "Não foi possível adicionar a função.")}`);
  revalidatePath(`/painel/setores/${parsed.data.departmentId}`);
}

export async function updatePosition(formData: FormData) {
  const positionId = z.string().uuid().safeParse(formData.get("positionId"));
  const parsed = positionSchema.safeParse(Object.fromEntries(formData));
  if (!positionId.success || !parsed.success) redirect("/painel/setores?erro=Função inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("positions").update({ name: parsed.data.name, updated_at: new Date().toISOString() }).eq("id", positionId.data).eq("department_id", parsed.data.departmentId);
  if (error) redirect(`/painel/setores/${parsed.data.departmentId}?erro=Não foi possível atualizar a função.`);
  revalidatePath(`/painel/setores/${parsed.data.departmentId}`);
}

export async function togglePosition(formData: FormData) {
  const parsed = z.object({ positionId: z.string().uuid(), departmentId: z.string().uuid(), active: z.enum(["true", "false"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/setores?erro=Função inválida.");
  const supabase = await createClient();
  const { error } = await supabase.from("positions").update({ active: parsed.data.active === "true", updated_at: new Date().toISOString() }).eq("id", parsed.data.positionId).eq("department_id", parsed.data.departmentId);
  if (error) redirect(`/painel/setores/${parsed.data.departmentId}?erro=Não foi possível alterar a função.`);
  revalidatePath(`/painel/setores/${parsed.data.departmentId}`);
}
