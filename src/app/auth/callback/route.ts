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
      const { data: platformRole } = await supabase.from("platform_roles").select("role").maybeSingle();
      const response = NextResponse.redirect(new URL(platformRole ? "/central" : next, url.origin));
      response.cookies.delete("atos_calendar_oauth_user");
      return response;
    }
  }

  return NextResponse.redirect(new URL("/entrar?erro=Não foi possível confirmar sua sessão.", url.origin));
}
