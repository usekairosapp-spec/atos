import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("\\") || value.includes("\0")) {
    return "/painel";
  }
  return value === "/painel" || value.startsWith("/painel/") || value.startsWith("/painel?")
    ? value
    : "/painel";
}

type CookieToSet = {
  name: string;
  value: string;
  options: Parameters<NextResponse["cookies"]["set"]>[2];
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNextPath(url.searchParams.get("next"));
  const calendarFlow = url.searchParams.get("calendar") === "1";

  if (!code) {
    return NextResponse.redirect(new URL("/entrar?erro=Não foi possível confirmar sua sessão.", url.origin));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL("/entrar?erro=Supabase não configurado.", url.origin));
  }

  const cookieStore = await cookies();
  const expectedCalendarUser = cookieStore.get("atos_calendar_oauth_user")?.value;
  if (calendarFlow && !expectedCalendarUser) {
    return NextResponse.redirect(new URL(`${next}${next.includes("?") ? "&" : "?"}erro=${encodeURIComponent("A conexão com o Google Agenda expirou. Tente novamente.")}`, url.origin));
  }

  const cookiesToSet: CookieToSet[] = [];
  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(values) {
        cookiesToSet.push(...values);
        values.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Route handlers may reject cookieStore writes in some contexts.
          }
        });
      },
    },
  });

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    const hasCodeVerifier = cookieStore.getAll().some(({ name }) => name.includes("code-verifier"));
    console.error("Falha ao confirmar callback OAuth", {
      message: error.message,
      code: error.code,
      status: error.status,
      hasCodeVerifier,
      calendarFlow,
    });
    const detail = error.message.toLowerCase().includes("code verifier")
      ? "O navegador não preservou o cookie de segurança do login. Feche outras abas do Kairos Escala e tente novamente."
      : `O Google retornou: ${error.message}`;
    return NextResponse.redirect(new URL(`/entrar?erro=${encodeURIComponent(detail)}`, url.origin));
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (calendarFlow && user?.id !== expectedCalendarUser) {
    await supabase.auth.signOut();
    const response = NextResponse.redirect(new URL("/entrar?erro=Foi selecionada outra conta Google. Entre novamente com a conta correta.", url.origin));
    response.cookies.delete("atos_calendar_oauth_user");
    return response;
  }

  const { data: platformRole } = await supabase.from("platform_roles").select("role").maybeSingle();
  const response = NextResponse.redirect(new URL(platformRole ? "/central" : next, url.origin));
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  response.cookies.delete("atos_calendar_oauth_user");
  return response;
}
