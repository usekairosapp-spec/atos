"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { loginSchema, recoverySchema, signUpSchema } from "@/features/auth/auth.schemas";

function redirectWithMessage(path: string, type: "erro" | "sucesso", message: string): never {
  redirect(`${path}?${type}=${encodeURIComponent(message)}`);
}

export async function login(formData: FormData) {
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) redirectWithMessage("/entrar", "erro", parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) redirectWithMessage("/entrar", "erro", "E-mail ou senha inválidos.");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirectWithMessage("/entrar", "erro", "Não foi possível confirmar sua sessão. Tente novamente.");
  const { data: platformRole } = await supabase.from("platform_roles").select("role").maybeSingle();
  redirect(platformRole ? "/central" : "/painel");
}

export async function signUp(formData: FormData) {
  const parsed = signUpSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) redirectWithMessage("/cadastro", "erro", parsed.error.issues[0]?.message ?? "Dados inválidos.");

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) redirectWithMessage("/cadastro", "erro", error.message);
  redirectWithMessage("/entrar", "sucesso", "Cadastro realizado. Confira seu e-mail para confirmar a conta.");
}

export async function recoverPassword(formData: FormData) {
  const parsed = recoverySchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) redirectWithMessage("/recuperar-senha", "erro", parsed.error.issues[0]?.message ?? "E-mail inválido.");

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback?next=/redefinir-senha`,
  });
  if (error) redirectWithMessage("/recuperar-senha", "erro", error.message);
  redirectWithMessage("/entrar", "sucesso", "Enviamos as instruções para seu e-mail.");
}

export async function updatePassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (password.length < 8) redirectWithMessage("/redefinir-senha", "erro", "A senha precisa ter pelo menos 8 caracteres.");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) redirectWithMessage("/redefinir-senha", "erro", error.message);
  redirectWithMessage("/entrar", "sucesso", "Senha atualizada. Entre com sua nova senha.");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const cookieStore = await cookies();
  cookieStore.delete("appescala_church_id");
  cookieStore.delete("atos_calendar_oauth_user");
  redirect("/entrar");
}
