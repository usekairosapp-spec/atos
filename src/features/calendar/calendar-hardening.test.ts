import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const actions = readFileSync(join(process.cwd(), "src/features/calendar/actions.ts"), "utf8");
const page = readFileSync(join(process.cwd(), "src/app/painel/calendario/page.tsx"), "utf8");
const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260722023000_google_calendar_hardening.sql"), "utf8");

describe("Google Agenda e calendário pessoal", () => {
  it("atualiza o evento existente e só recria quando ele não existe mais", () => {
    expect(actions).toContain('method: "PATCH"');
    expect(actions).toContain("response.status === 404 || response.status === 410");
    expect(actions).toContain('method: "POST"');
  });

  it("serializa sincronizações e bloqueia escrita direta do vínculo", () => {
    expect(migration).toContain("claim_my_google_calendar_sync");
    expect(migration).toContain('drop policy if exists "calendar events update own"');
    expect(migration).toContain("target_lock_token uuid");
  });

  it("enfileira limpeza quando a participação é removida ou transferida", () => {
    expect(migration).toContain("update of user_id, status");
    expect(migration).toContain("cleanup_reason := 'assignment_removed'");
    expect(migration).toContain("cleanup_reason := 'assignment_transferred'");
  });

  it("normaliza a navegação de mês e preserva a tela de retorno", () => {
    expect(page).toContain("new Date(year, month, 1)");
    expect(page).toContain("monthKey(year, month - 1)");
    expect(page).toContain("monthKey(year, month + 1)");
    expect(page).toContain('name="returnTo"');
  });
});
