const WEEKDAY_NAMES = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
// Plural correto em portugues: "segunda-feira" -> "segundas-feiras" (nao "segunda-feiras").
const WEEKDAY_NAMES_PLURAL = ["domingos", "segundas-feiras", "terças-feiras", "quartas-feiras", "quintas-feiras", "sextas-feiras", "sábados"];

export type PatternAssignment = { positionId: string; userId: string };

export type MonthlySchedulePattern = {
  weekday: number;
  weekdayLabel: string;
  weekdayLabelPlural: string;
  startTime: string;
  endTime: string;
  title: string;
  location: string | null;
  notes: string | null;
  assignments: PatternAssignment[];
  occurrences: number;
};

type SourceSchedule = {
  startsAtIso: string;
  weekday: number;
  startTime: string;
  endTime: string;
  title: string;
  location: string | null;
  notes: string | null;
  assignments: PatternAssignment[];
};

// Extrai ano/mes/dia/hora no fuso de Brasilia a partir de um timestamptz,
// igual a convencao usada no resto do app para escalas.
export function brasiliaParts(iso: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date(iso));
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const year = Number(get("year"));
  const month = Number(get("month"));
  const day = Number(get("day"));
  const weekday = new Date(year, month - 1, day).getDay();
  return { year, month, day, weekday, time: `${get("hour")}:${get("minute")}` };
}

export function toSourceSchedule(input: {
  startsAt: string;
  endsAt: string;
  title: string;
  location: string | null;
  notes: string | null;
  assignments: PatternAssignment[];
}): SourceSchedule {
  const start = brasiliaParts(input.startsAt);
  const end = brasiliaParts(input.endsAt);
  return {
    startsAtIso: input.startsAt,
    weekday: start.weekday,
    startTime: start.time,
    endTime: end.time,
    title: input.title,
    location: input.location,
    notes: input.notes,
    assignments: input.assignments,
  };
}

// Agrupa as escalas do mes anterior por dia da semana + horario de inicio, e
// considera "padrao" o grupo mais comum, desde que tenha pelo menos 2 ocorrencias.
export function detectMonthlyPattern(schedules: SourceSchedule[]): MonthlySchedulePattern | null {
  if (!schedules.length) return null;
  const groups = new Map<string, SourceSchedule[]>();
  for (const schedule of schedules) {
    const key = `${schedule.weekday}|${schedule.startTime}`;
    groups.set(key, [...(groups.get(key) ?? []), schedule]);
  }
  let best: SourceSchedule[] | null = null;
  for (const group of groups.values()) {
    if (!best || group.length > best.length) best = group;
  }
  if (!best || best.length < 2) return null;
  const latest = best.reduce((a, b) => (a.startsAtIso > b.startsAtIso ? a : b));
  return {
    weekday: latest.weekday,
    weekdayLabel: WEEKDAY_NAMES[latest.weekday],
    weekdayLabelPlural: WEEKDAY_NAMES_PLURAL[latest.weekday],
    startTime: latest.startTime,
    endTime: latest.endTime,
    title: latest.title,
    location: latest.location,
    notes: latest.notes,
    assignments: latest.assignments,
    occurrences: best.length,
  };
}

export function datesForWeekdayInMonth(year: number, month: number, weekday: number): string[] {
  const dates: string[] = [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  for (let day = 1; day <= daysInMonth; day++) {
    if (new Date(year, month, day).getDay() === weekday) {
      dates.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`);
    }
  }
  return dates;
}
