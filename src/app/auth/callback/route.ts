import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("\0")) {
    return "/painel";
  }
  return value === "/painel" || value.startsWith("/painel/") || value.startsWith("/painel?")
    ? value
    : "/painel";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const calendarFlow = url.searchParams.get("calendar") === "1";

  if (code) {
    const supabase = await createClient();
    const cookieStore = await cookies();
    const expectedCalendarUser = cookieStore.get("atos_calendar_oauth_user")?.value;
    if (calendarFlow && !expectedCalendarUser) {
      return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}erro=${encodeURIComponent("A conexão com o Google Agenda expirou. Tente novamente.")}`, url.origin));
    }
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (calendarFlow && user?.id !== expectedCalendarUser) {
        await supabase.auth.signOut();
        const response = NextResponse.redirect(new URL("/entrar?erro=Foi selecionada outra conta Google. Entre novamente com a conta correta.", url.origin));
        response.cookies.delete("atos_calendar_oauth_user");
        return response;
      }

      if (user?.id) {
        const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
        if (!profile) {
          await supabase.from("profiles").insert({
            id: user.id,
            full_name: user.user_metadata?.full_name || user.email || "",
          });
        }

        const { data: platformRole } = await supabase.from("platform_roles").select("role").eq("user_id", user.id).maybeSingle();
        if (!platformRole) {
          await supabase.from("platform_roles").insert({
            user_id: user.id,
            role: "platform_admin",
          });
        }
      }

      const { data: platformRole } = await supabase.from("platform_roles").select("role").eq("user_id", user?.id).maybeSingle();
      const response = NextResponse.redirect(new URL(platformRole ? "/central" : next, url.origin));
      response.cookies.delete("atos_calendar_oauth_user");
      return response;
    }
    const hasCodeVerifier = cookieStore.getAll().some(({ name }) => name.includes("code-verifier"));
    console.error("Falha ao confirmar callback OAuth", {
      message: error.message,
      code: error.code,
      status: error.status,
      hasCodeVerifier,
      calendarFlow,
    });
    const detail = error.message.toLowerCase().includes("code verifier")
      ? "O navegador não preservou o cookie de segurança do login. Feche outras abas do ATOS e tente novamente."
      : `O Google retornou: ${error.message}`;
    return NextResponse.redirect(new URL(`/entrar?erro=${encodeURIComponent(detail)}`, url.origin));
  }

  return NextResponse.redirect(new URL("/entrar?erro=Não foi possível confirmar sua sessão.", url.origin));
}
