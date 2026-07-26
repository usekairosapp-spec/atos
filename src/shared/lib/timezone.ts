export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export const TIMEZONE_OPTIONS: { value: string; label: string }[] = [
  { value: "America/Noronha", label: "Fernando de Noronha (UTC-2)" },
  { value: "America/Sao_Paulo", label: "Brasília — SP, RJ, MG, Sul e Nordeste (UTC-3)" },
  { value: "America/Manaus", label: "Manaus, Amazonas (UTC-4)" },
  { value: "America/Rio_Branco", label: "Rio Branco, Acre (UTC-5)" },
  { value: "America/Bogota", label: "Bogotá, Lima, Quito (UTC-5)" },
  { value: "America/New_York", label: "Nova York, Miami (UTC-5/-4)" },
  { value: "America/Chicago", label: "Chicago (UTC-6/-5)" },
  { value: "America/Denver", label: "Denver (UTC-7/-6)" },
  { value: "America/Los_Angeles", label: "Los Angeles (UTC-8/-7)" },
  { value: "Atlantic/Azores", label: "Açores (UTC-1)" },
  { value: "Europe/Lisbon", label: "Lisboa, Portugal (UTC+0/+1)" },
  { value: "Europe/London", label: "Londres (UTC+0/+1)" },
];

function isValidTimeZone(timeZone: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimezone(timeZone: string | null | undefined): string {
  if (!timeZone || !isValidTimeZone(timeZone)) return DEFAULT_TIMEZONE;
  return timeZone;
}

export function formatDate(date: Date, timeZone: string, options?: Intl.DateTimeFormatOptions) {
  return date.toLocaleDateString("pt-BR", { ...options, timeZone: resolveTimezone(timeZone) });
}

export function formatTime(date: Date, timeZone: string, options?: Intl.DateTimeFormatOptions) {
  return date.toLocaleTimeString("pt-BR", { ...options, timeZone: resolveTimezone(timeZone) });
}

// Converte um instante para os componentes de data/hora "de parede" (wall-clock)
// em um fuso horário específico, no formato aceito pela Google Calendar API (sem offset).
export function toZonedDateTimeString(value: string, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimezone(timeZone), year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`;
}
