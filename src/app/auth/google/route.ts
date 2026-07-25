import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const callbackUrl = new URL("/auth/callback", request.nextUrl.origin);

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
    return NextResponse.redirect(new URL("/entrar?erro=Não foi possível iniciar o login com Google.", request.url));
  }

  const response = NextResponse.redirect(data.url);
  cookiesToSet.forEach(({ name, value, options }) => {
    response.cookies.set(name, value, options);
  });
  return response;
}
