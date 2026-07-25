import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  // Em desenvolvimento, usa a origem atual (localhost). Em produção, usa a URL canônica.
  const siteUrl = process.env.NODE_ENV === "development"
    ? request.nextUrl.origin
    : (process.env.NEXT_PUBLIC_SITE_URL || request.nextUrl.origin);
  const callbackUrl = new URL("/auth/callback", siteUrl);

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.redirect(new URL("/entrar?erro=Supabase não configurado.", request.url));
  }

  const cookiesToSet: Array<{
    name: string;
    value: string;
    options: Parameters<NextResponse["cookies"]["set"]>[2];
  }> = [];

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        cookiesToSet.push(...values);
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl.toString(),
      queryParams: {
        prompt: "select_account",
      },
    },
  });

  if (error || !data.url) {
    console.error("🔴 OAuth Error:", {
      errorMessage: error?.message,
      errorCode: error?.status,
      hasUrl: !!data?.url,
      callbackUrl: callbackUrl.toString(),
    });
    return NextResponse.redirect(new URL(`/entrar?erro=${encodeURIComponent(error?.message || "Não foi possível iniciar o login com Google.")}`, request.url));
  }

  const response = NextResponse.redirect(data.url);
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
