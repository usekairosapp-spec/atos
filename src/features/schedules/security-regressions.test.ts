import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("regressões críticas de escalas", () => {
  it("mantém apenas o fluxo dedicado de troca no detalhe", () => {
    const detail = read("src/app/painel/escalas/[scheduleId]/page.tsx");
    expect(detail).not.toContain("Deixar o líder escolher");
    expect(detail).not.toContain("requestAssignmentSwap");
    expect(detail).toContain("/troca/${ownAssignment.id}");
  });

  it("restringe confirmação a participação pendente e escala publicada", () => {
    const migration = read("supabase/migrations/20260721053000_security_and_state_hardening.sql");
    expect(migration).toContain("sa.status = 'pending' and ds.status = 'published'");
    expect(migration).toContain("for update of sr, sa");
    expect(migration).toContain('drop policy if exists "department memberships managed by leaders"');
  });

  it("usa chaves idempotentes nas notificações", () => {
    const migration = read("supabase/migrations/20260721060000_idempotent_notifications.sql");
    expect(migration).toContain("notifications_user_event_key_unique");
    expect(migration).toContain("on conflict (user_id, event_key) do nothing");
  });
});
