import { describe, expect, it } from "vitest";
import { loginSchema, signUpSchema } from "./auth.schemas";

describe("schemas de autenticação", () => {
  it("aceita um cadastro válido", () => {
    expect(signUpSchema.safeParse({ fullName: "Maria Silva", email: "maria@example.com", password: "segura123" }).success).toBe(true);
  });

  it("rejeita senha curta e e-mail inválido", () => {
    expect(loginSchema.safeParse({ email: "invalido", password: "123" }).success).toBe(false);
  });
});
