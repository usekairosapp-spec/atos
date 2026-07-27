"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// Preserva o contexto de "voltar pra revisao do lote" (?voltarLote=) atraves
// de redirects, senao a pessoa perde o caminho de volta ao ajustar um dia.
function withVoltarLote(url: string, formData: FormData) {
  const voltarLote = formData.get("voltarLote");
  if (typeof voltarLote === "string" && voltarLote) {
    return `${url}${url.includes("?") ? "&" : "?"}voltarLote=${encodeURIComponent(voltarLote)}`;
  }
  return url;
}

const newScheduleSchema = z.object({
  departmentId: z.string().uuid(),
  title: z.string().trim().min(2, "Informe o nome do evento.").max(120),
  date: z.string().min(1, "Informe a data."),
  startTime: z.string().min(1, "Informe o início."),
  endTime: z.string().min(1, "Informe o término."),
  location: z.string().trim().max(160).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
});

function localDateTimeToIso(value: string) {
  const date = new Date(`${value}:00-03:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

const batchServiceSchema = z.object({
  title: z.string().trim().min(2, "Informe o nome do evento.").max(120),
  startTime: z.string().min(1, "Informe o horário de início."),
  endTime: z.string().min(1, "Informe o horário de término."),
  location: z.string().trim().max(160).optional().default(""),
  notes: z.string().trim().max(1000).optional().default(""),
  assignments: z.array(z.object({ positionId: z.string().uuid(), userId: z.string().uuid() })).min(1, "Cada culto precisa de pelo menos uma pessoa na equipe."),
});

const batchScheduleSchema = z.object({
  departmentId: z.string().uuid(),
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1, "Selecione pelo menos um dia no calendário."),
  services: z.array(batchServiceSchema).min(1, "Informe pelo menos um culto."),
});

export async function createSchedulesBatch(formData: FormData) {
  const departmentIdRaw = formData.get("departmentId");
  const backTo = typeof departmentIdRaw === "string" && departmentIdRaw
    ? `/painel/escalas/lote?departmentId=${encodeURIComponent(departmentIdRaw)}`
    : "/painel/escalas/lote";
  const withError = (msg: string) => `${backTo}${backTo.includes("?") ? "&" : "?"}erro=${encodeURIComponent(msg)}`;

  const serviceCount = Number(formData.get("serviceCount") ?? "0");
  const rawServices = Array.from({ length: serviceCount }, (_, index) => ({
    title: formData.get(`title-${index}`),
    startTime: formData.get(`startTime-${index}`),
    endTime: formData.get(`endTime-${index}`),
    location: formData.get(`location-${index}`),
    notes: formData.get(`notes-${index}`),
    assignments: formData.getAll(`selection-${index}`).map(String).map((value) => {
      const [positionId, userId] = value.split("|");
      return { positionId, userId };
    }),
  }));

  const parsed = batchScheduleSchema.safeParse({
    departmentId: formData.get("departmentId"),
    dates: formData.getAll("dates").map(String),
    services: rawServices,
  });
  if (!parsed.success) redirect(withError(parsed.error.issues[0]?.message ?? "Dados inválidos."));

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_department_schedules_batch", {
    target_department_id: parsed.data.departmentId,
    target_dates: parsed.data.dates,
    target_services: parsed.data.services,
  });
  if (error) redirect(withError(error.message));

  const batchId = data?.[0]?.batch_id;
  if (!batchId) redirect(withError("Não foi possível montar o lote."));
  revalidatePath("/painel/escalas");
  redirect(`/painel/escalas/lote/revisar/${batchId}`);
}

export async function publishScheduleBatch(formData: FormData) {
  const batchId = z.string().uuid().safeParse(formData.get("batchId"));
  if (!batchId.success) redirect("/painel/escalas?erro=Lote inválido.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_schedule_batch", { target_batch_id: batchId.data });
  if (error) redirect(`/painel/escalas/lote/revisar/${batchId.data}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/painel/escalas");
  revalidatePath("/painel", "layout");
  redirect(`/painel/escalas?sucesso=${encodeURIComponent("Escalas do lote publicadas.")}`);
}

export async function createSchedule(formData: FormData) {
  const parsed = newScheduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect(`/painel/escalas/nova?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Dados inválidos.")}`);
  const startsAt = localDateTimeToIso(`${parsed.data.date}T${parsed.data.startTime}`);
  const endsAt = localDateTimeToIso(`${parsed.data.date}T${parsed.data.endTime}`);
  if (!startsAt || !endsAt) redirect("/painel/escalas/nova?erro=Data ou horário inválido.");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_department_schedule", {
    target_department_id: parsed.data.departmentId,
    schedule_title: parsed.data.title,
    schedule_starts_at: startsAt,
    schedule_ends_at: endsAt,
    schedule_location: parsed.data.location,
    schedule_notes: parsed.data.notes,
  });
  if (error) redirect(`/painel/escalas/nova?erro=${encodeURIComponent(error.message)}`);
  redirect(`/painel/escalas/${data}?sucesso=Escala criada como rascunho.`);
}

export async function addScheduleAssignment(formData: FormData) {
  const parsed = z.object({ scheduleId: z.string().uuid(), positionId: z.string().uuid(), userId: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/escalas?erro=Participante inválido.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_schedule_assignment", {
    target_schedule_id: parsed.data.scheduleId,
    target_position_id: parsed.data.positionId,
    target_user_id: parsed.data.userId,
  });
  if (error) redirect(`/painel/escalas/${parsed.data.scheduleId}?erro=${encodeURIComponent(error.code === "23505" ? "Essa pessoa já está nessa função." : error.message)}`);
  revalidatePath(`/painel/escalas/${parsed.data.scheduleId}`);
  revalidatePath("/painel/escalas");
}

export async function addScheduleAssignments(formData: FormData) {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  const selections = formData.getAll("selection").map(String);
  if (!scheduleId.success || !selections.length) redirect(`/painel/escalas/${scheduleId.success ? scheduleId.data : ""}?erro=Selecione pelo menos uma pessoa.`);
  const parsedSelections = selections.map((value) => {
    const [positionId, userId] = value.split("|");
    return z.object({ positionId: z.string().uuid(), userId: z.string().uuid() }).safeParse({ positionId, userId });
  });
  if (parsedSelections.some((item) => !item.success)) redirect(`/painel/escalas/${scheduleId.data}?erro=Uma das seleções é inválida.`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("add_schedule_assignments", {
    target_schedule_id: scheduleId.data,
    selections: parsedSelections.flatMap((selection) => selection.success ? [{ positionId: selection.data.positionId, userId: selection.data.userId }] : []),
  });
  if (error) redirect(withVoltarLote(`/painel/escalas/${scheduleId.data}?erro=${encodeURIComponent(error.code === "23505" ? "Uma das pessoas já está nessa função." : error.message)}`, formData));
  revalidatePath(`/painel/escalas/${scheduleId.data}`);
  revalidatePath("/painel/escalas");
  redirect(withVoltarLote(`/painel/escalas/${scheduleId.data}?sucesso=Equipe atualizada.`, formData));
}

export async function publishSchedule(formData: FormData) {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) redirect("/painel/escalas?erro=Escala inválida.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_department_schedule", { target_schedule_id: scheduleId.data });
  if (error) redirect(`/painel/escalas/${scheduleId.data}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(`/painel/escalas/${scheduleId.data}`);
  revalidatePath("/painel/escalas");
  redirect(`/painel/escalas/${scheduleId.data}?sucesso=Escala publicada com sucesso.`);
}

const confirmAssignmentSchema = z.object({
  assignmentId: z.string().uuid(),
  scheduleId: z.string().uuid(),
  availability: z.enum(["full", "partial"]).default("full"),
  serviceDate: z.string().optional(),
  availableUntilTime: z.string().optional(),
});

export async function confirmAssignment(formData: FormData) {
  const parsed = confirmAssignmentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/escalas?erro=Confirmação inválida.");

  let availableUntil: string | null = null;
  if (parsed.data.availability === "partial") {
    if (!parsed.data.serviceDate || !parsed.data.availableUntilTime) {
      redirect(`/painel/escalas/${parsed.data.scheduleId}?erro=Informe até que horário você pode ficar.`);
    }
    const candidate = new Date(`${parsed.data.serviceDate}T${parsed.data.availableUntilTime}:00-03:00`);
    if (Number.isNaN(candidate.getTime())) redirect(`/painel/escalas/${parsed.data.scheduleId}?erro=Horário inválido.`);
    availableUntil = candidate.toISOString();
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_schedule_assignment", { target_assignment_id: parsed.data.assignmentId, target_available_until: availableUntil });
  if (error) redirect(`/painel/escalas/${parsed.data.scheduleId}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(`/painel/escalas/${parsed.data.scheduleId}`);
  redirect(`/painel/escalas/${parsed.data.scheduleId}/confirmado/${parsed.data.assignmentId}`);
}

export async function requestAssignmentSwap(formData: FormData) {
  const parsed = z.object({ assignmentId: z.string().uuid(), scheduleId: z.string().uuid(), suggestedUserId: z.string().uuid(), reason: z.string().trim().max(500).optional() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/escalas?erro=Solicitação inválida.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("request_assignment_swap", {
    target_assignment_id: parsed.data.assignmentId,
    target_suggested_user_id: parsed.data.suggestedUserId,
    swap_reason: parsed.data.reason || null,
  });
  if (error) redirect(`/painel/escalas/${parsed.data.scheduleId}?erro=${encodeURIComponent(error.code === "23505" ? "Já existe uma solicitação de troca pendente." : error.message)}`);
  revalidatePath(`/painel/escalas/${parsed.data.scheduleId}`);
  redirect(`/painel/escalas/${parsed.data.scheduleId}?sucesso=Solicitação de troca enviada ao líder.`);
}

export async function respondToPeerSwap(formData: FormData) {
  const parsed = z.object({ requestId: z.string().uuid(), scheduleId: z.string().uuid(), decision: z.enum(["accept", "reject"]) }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/escalas?erro=Resposta inválida.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_to_peer_swap", { target_request_id: parsed.data.requestId, accept_request: parsed.data.decision === "accept" });
  if (error) redirect(`/painel/escalas/${parsed.data.scheduleId}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath(`/painel/escalas/${parsed.data.scheduleId}`); revalidatePath("/painel/escalas");
  redirect(`/painel/escalas/${parsed.data.scheduleId}?sucesso=${parsed.data.decision === "accept" ? "Troca aceita. Esta escala agora é sua." : "Troca recusada."}`);
}

export async function updateSchedule(formData: FormData) {
  const parsed = z.object({ scheduleId: z.string().uuid(), title: z.string().trim().min(2).max(120), date: z.string().min(1), startTime: z.string().min(1), endTime: z.string().min(1), location: z.string().trim().max(160).optional().default(""), notes: z.string().trim().max(1000).optional().default("") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/escalas?erro=Dados da escala inválidos.");
  const startsAt = localDateTimeToIso(`${parsed.data.date}T${parsed.data.startTime}`);
  const endsAt = localDateTimeToIso(`${parsed.data.date}T${parsed.data.endTime}`);
  if (!startsAt || !endsAt) redirect(`/painel/escalas/${parsed.data.scheduleId}?erro=Data ou horário inválido.`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_department_schedule", { target_schedule_id: parsed.data.scheduleId, schedule_title: parsed.data.title, schedule_starts_at: startsAt, schedule_ends_at: endsAt, schedule_location: parsed.data.location, schedule_notes: parsed.data.notes });
  if (error) redirect(withVoltarLote(`/painel/escalas/${parsed.data.scheduleId}?erro=${encodeURIComponent(error.message)}`, formData));
  revalidatePath(`/painel/escalas/${parsed.data.scheduleId}`); revalidatePath("/painel/escalas");
  redirect(withVoltarLote(`/painel/escalas/${parsed.data.scheduleId}?sucesso=Escala atualizada.`, formData));
}

export async function removeScheduleAssignment(formData: FormData) {
  const parsed = z.object({ assignmentId: z.string().uuid(), scheduleId: z.string().uuid() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/escalas?erro=Participante inválido.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_schedule_assignment", { target_assignment_id: parsed.data.assignmentId });
  if (error) redirect(withVoltarLote(`/painel/escalas/${parsed.data.scheduleId}?erro=${encodeURIComponent(error.message)}`, formData));
  revalidatePath(`/painel/escalas/${parsed.data.scheduleId}`); revalidatePath("/painel/escalas");
  redirect(withVoltarLote(`/painel/escalas/${parsed.data.scheduleId}?sucesso=Pessoa removida da escala.`, formData));
}

export async function deleteSchedule(formData: FormData) {
  const scheduleId = z.string().uuid().safeParse(formData.get("scheduleId"));
  if (!scheduleId.success) redirect("/painel/escalas?erro=Escala inválida.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_department_schedule", { target_schedule_id: scheduleId.data });
  if (error) redirect(`/painel/escalas/${scheduleId.data}?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/painel/escalas"); revalidatePath("/painel");
  redirect("/painel/escalas?sucesso=Escala excluída.");
}

const scheduleIdsSchema = z.array(z.string().uuid()).min(1, "Selecione pelo menos uma escala.");

export async function deleteSchedulesBatch(formData: FormData) {
  const parsed = scheduleIdsSchema.safeParse(formData.getAll("scheduleIds"));
  if (!parsed.success) redirect(`/painel/escalas?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Seleção inválida.")}`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_schedules_batch", { target_schedule_ids: parsed.data });
  if (error) redirect(`/painel/escalas?erro=${encodeURIComponent(error.message)}`);
  revalidatePath("/painel/escalas");
  revalidatePath("/painel", "layout");
  redirect(`/painel/escalas?sucesso=${encodeURIComponent(`${parsed.data.length} ${parsed.data.length === 1 ? "escala excluída" : "escalas excluídas"}.`)}`);
}

export async function replicateSchedulesToNextMonth(formData: FormData) {
  const parsed = scheduleIdsSchema.safeParse(formData.getAll("scheduleIds"));
  if (!parsed.success) redirect(`/painel/escalas?erro=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Seleção inválida.")}`);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("replicate_schedules_to_next_month", { target_schedule_ids: parsed.data });
  if (error) redirect(`/painel/escalas?erro=${encodeURIComponent(error.message)}`);
  const batchId = data?.[0]?.batch_id;
  if (!batchId) redirect("/painel/escalas?erro=Não foi possível replicar as escalas selecionadas.");
  revalidatePath("/painel/escalas");
  redirect(`/painel/escalas/lote/revisar/${batchId}`);
}
