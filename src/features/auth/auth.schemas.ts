import { z } from "zod";

export const loginSchema = z.object({
  email: z.string().trim().email("Informe um e-mail válido."),
  password: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres."),
});

export const signUpSchema = loginSchema.extend({
  fullName: z.string().trim().min(2, "Informe seu nome completo.").max(120),
});

export const recoverySchema = loginSchema.pick({ email: true });
