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


describe("troca entre funções da mesma escala", () => {
  const migration = read("supabase/migrations/20260906010000_allow_peer_swap_multiple_positions.sql");
  const [candidates, request, response] = migration.split("create or replace function public.").slice(1);

  it("restringe duplicidade à mesma função na listagem, envio e aceite", () => {
    expect(candidates).toContain("existing.position_id = rs.position_id");
    expect(request).toContain("and position_id = target_position_id");
    expect(response).toContain("and position_id = target_position_id");
    expect(migration).not.toContain("já está nesta escala.");
  });

  it("excetua a própria escala do conflito e preserva conflitos externos", () => {
    for (const sql of [candidates, request]) {
      expect(sql).toContain("other_ds.id <> target_schedule_id");
      expect(sql).toContain("other_ds.status = 'published'");
      expect(sql).toMatch(/other_s.starts_at < (rs\.)?event_end/);
      expect(sql).toMatch(/other_s.ends_at > (rs\.)?event_start/);
    }
  });

  it("mantém autorização e altera somente a participação substituída", () => {
    expect(candidates).toContain("sa.user_id = (select auth.uid())");
    expect(request).toContain("public.is_active_assignment_owner(target_assignment_id)");
    expect(request).toContain("dm.status = 'active'");
    expect(response).toContain("recipient_id <> (select auth.uid())");
    expect(response).toContain("for update of sr, sa");
    expect(response).toContain("set user_id = recipient_id, status = 'confirmed'");
    expect(response).toContain("where id = target_assignment_id and status = 'replacement_requested'");
    expect(response).toContain("set status = prior_status");
  });
});
