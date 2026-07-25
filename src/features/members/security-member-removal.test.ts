import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(join(process.cwd(), "supabase/migrations/20260722021500_security_member_removal.sql"), "utf8");
const centralVisibilityMigration = readFileSync(join(process.cwd(), "supabase/migrations/20260722024500_platform_membership_visibility.sql"), "utf8");

describe("segurança de membros e tenants", () => {
  it("exige igreja e membership ativas nos helpers operacionais", () => {
    expect(migration).toContain("join public.churches c");
    expect(migration).toContain("cm.status = 'active'");
    expect(migration).toContain("c.status = 'active'");
  });

  it("revoga setores quando o vínculo da igreja deixa de ser ativo", () => {
    expect(migration).toContain("revoke_department_access_after_membership_change");
    expect(migration).toContain("set status = 'suspended'");
  });

  it("protege administradores e preserva assignments históricos", () => {
    expect(migration).toContain("target_role = 'church_admin'");
    expect(migration).toContain("public.platform_roles");
    expect(migration).toContain("s.ends_at >= now()");
    expect(migration).toContain("set status = 'replaced'");
  });

  it("remove mutações diretas dos vínculos do Google Calendar", () => {
    expect(migration).toContain('drop policy if exists "calendar events insert own"');
    expect(migration).toContain('drop policy if exists "calendar events update own"');
    expect(migration).toContain('drop policy if exists "calendar events delete own"');
  });

  it("permite à administradora da plataforma contabilizar vínculos sem administrar a igreja", () => {
    expect(centralVisibilityMigration).toContain("for select to authenticated");
    expect(centralVisibilityMigration).toContain("public.is_platform_admin()");
    expect(centralVisibilityMigration).not.toContain("for all to authenticated");
  });
});
