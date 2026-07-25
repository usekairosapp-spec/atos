"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type GoogleEvent = { id?: string; htmlLink?: string };

function safeNext(value: FormDataEntryValue | null, fallback = "/painel/calendario") {
  const next = String(value ?? fallback);
  return next === "/painel" || next.startsWith("/painel/") ? next : fallback;
}

function withMessage(next: string, kind: "erro" | "sucesso", message: string) {
  const separator = next.includes("?") ? "&" : "?";
  return `${next}${separator}${kind}=${encodeURIComponent(message)}`;
}

function brazilDateTime(value: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}

function googleEventPayload(event: Record<string, string | null>) {
  return {
    summary: `${event.service_title} — ${event.department_name}`,
    location: event.service_location || undefined,
    description: [`Função: ${event.position_name}`, event.service_notes, "Adicionado pelo ATOS."].filter(Boolean).join("\n\n"),
    start: { dateTime: brazilDateTime(event.service_starts_at ?? ""), timeZone: "America/Sao_Paulo" },
    end: { dateTime: brazilDateTime(event.service_ends_at ?? ""), timeZone: "America/Sao_Paulo" },
    reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 1440 }, { method: "popup", minutes: 120 }] },
    extendedProperties: { private: { appescalaAssignmentId: event.assignment_id } },
  };
}

async function googleRequest(providerToken: string, url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${providerToken}`, ...(init.body ? { "Content-Type": "application/json" } : {}), ...init.headers },
  });
}

async function processPendingCleanup(supabase: SupabaseServerClient, providerToken: string) {
  const { data } = await supabase.rpc("get_my_pending_google_calendar_cleanup");
  for (const item of data ?? []) {
    const response = await googleRequest(providerToken, `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(item.google_event_id)}`, { method: "DELETE" });
    if (response.ok || response.status === 404 || response.status === 410) {
      await supabase.rpc("complete_my_google_calendar_cleanup", { target_cleanup_id: item.cleanup_id });
    }
  }
}

async function saveCalendarLink(supabase: SupabaseServerClient, assignmentId: string, lockToken: string, googleEvent: GoogleEvent) {
  if (!googleEvent.id) return false;
  const { error } = await supabase.rpc("save_my_google_calendar_event", {
    target_assignment_id: assignmentId,
    target_google_event_id: googleEvent.id,
    target_html_link: googleEvent.htmlLink ?? null,
    target_lock_token: lockToken,
  });
  return !error;
}

async function reconnectCalendar(next: string) {
  const reconnect = new FormData();
  reconnect.set("next", next);
  return connectGoogleCalendar(reconnect);
}

export async function connectGoogleCalendar(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(withMessage("/entrar", "erro", "Entre novamente antes de conectar o Google Agenda."));
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callback = `${siteUrl}/auth/callback?calendar=1&next=${encodeURIComponent(next)}`;
  const options = {
    redirectTo: callback,
    scopes: "https://www.googleapis.com/auth/calendar.events",
    queryParams: {
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
      ...(user.email ? { login_hint: user.email } : {}),
    },
  };
  const hasGoogleIdentity = user.identities?.some((identity) => identity.provider === "google") ?? false;

  // Contas que já entram com Google precisam renovar o consentimento, não
  // vincular novamente uma identidade que já existe.
  const result = hasGoogleIdentity
    ? await supabase.auth.signInWithOAuth({ provider: "google", options })
    : await supabase.auth.linkIdentity({ provider: "google", options });

  if (result.error || !result.data?.url) {
    redirect(withMessage(next, "erro", result.error?.message || "Não foi possível abrir a autorização do Google Agenda."));
  }
  const cookieStore = await cookies();
  cookieStore.set("atos_calendar_oauth_user", user.id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/auth/callback",
    maxAge: 10 * 60,
  });
  redirect(result.data.url);
}

export async function addAssignmentToGoogleCalendar(formData: FormData) {
  const parsed = z.object({
    assignmentId: z.string().uuid(),
    scheduleId: z.string().uuid(),
    returnTo: z.string().optional(),
  }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirect("/painel/escalas?erro=Escala inválida.");
  const fallback = `/painel/escalas/${parsed.data.scheduleId}?visao=minhas`;
  const next = safeNext(parsed.data.returnTo ?? null, fallback);
  const supabase = await createClient();
  const [{ data: sessionData }, { data: userData }, { data: eventRows }] = await Promise.all([
    supabase.auth.getSession(),
    supabase.auth.getUser(),
    supabase.rpc("get_my_calendar_event_data", { target_assignment_id: parsed.data.assignmentId }),
  ]);
  const event = eventRows?.[0] as Record<string, string | null> | undefined;
  if (!event) redirect(withMessage(next, "erro", "Confirme sua presença antes de adicionar ao calendário."));
  const session = sessionData.session;
  if (!session || !userData.user || session.user.id !== userData.user.id) redirect(withMessage("/entrar", "erro", "Sua sessão mudou. Entre novamente antes de acessar o Google Agenda."));
  const providerToken = session.provider_token;
  if (!providerToken) return reconnectCalendar(next);

  await processPendingCleanup(supabase, providerToken);
  const { data: lockToken, error: lockError } = await supabase.rpc("claim_my_google_calendar_sync", { target_assignment_id: parsed.data.assignmentId });
  if (lockError || !lockToken) redirect(withMessage(next, "erro", "Esta escala já está sendo sincronizada. Aguarde alguns instantes e tente novamente."));

  try {
    const payload = googleEventPayload(event);
    const { data: stored } = await supabase.from("google_calendar_events").select("google_event_id").eq("assignment_id", parsed.data.assignmentId).maybeSingle();
    let existingId = stored?.google_event_id as string | undefined;

    if (!existingId) {
      const lookup = await googleRequest(providerToken, `https://www.googleapis.com/calendar/v3/calendars/primary/events?singleEvents=true&maxResults=1&privateExtendedProperty=${encodeURIComponent(`appescalaAssignmentId=${event.assignment_id}`)}`);
      if (lookup.status === 401 || lookup.status === 403) return reconnectCalendar(next);
      if (lookup.ok) {
        const found = await lookup.json() as { items?: GoogleEvent[] };
        existingId = found.items?.[0]?.id;
      }
    }

    let response = existingId
      ? await googleRequest(providerToken, `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(existingId)}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await googleRequest(providerToken, "https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", body: JSON.stringify(payload) });

    if (existingId && (response.status === 404 || response.status === 410)) {
      response = await googleRequest(providerToken, "https://www.googleapis.com/calendar/v3/calendars/primary/events", { method: "POST", body: JSON.stringify(payload) });
    }
    if (response.status === 401 || response.status === 403) return reconnectCalendar(next);
    if (!response.ok) redirect(withMessage(next, "erro", "O Google não permitiu sincronizar o evento. Verifique se a API do Agenda está ativada."));
    const googleEvent = await response.json() as GoogleEvent;
    if (!googleEvent.id) redirect(withMessage(next, "erro", "O Google não retornou o evento sincronizado."));
    if (!await saveCalendarLink(supabase, parsed.data.assignmentId, lockToken, googleEvent)) redirect(withMessage(next, "erro", "Evento sincronizado, mas não foi possível salvar o vínculo no ATOS."));
    redirect(withMessage(next, "sucesso", existingId ? "Evento atualizado no Google Agenda." : "Escala adicionada ao Google Agenda com lembretes."));
  } finally {
    await supabase.rpc("release_my_google_calendar_sync", { target_assignment_id: parsed.data.assignmentId, target_lock_token: lockToken });
  }
}
