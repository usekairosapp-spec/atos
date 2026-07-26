import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AguardandoConvitePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 px-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-lg shadow-lg p-8 text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m5.506 0C15.009 17.799 16 14.517 16 11m-6 0c0-1.657-.895-3.176-2.236-3.95M5.003 9.25H1.25m3.753-3.75c1.341-.775 2.236-2.293 2.236-3.95 0-2.761-2.238-5-5-5S.25-8.75.25-6c0 1.657.895 3.176 2.236 3.95m15.504 6.692c.526 1.52.526 3.219 0 4.738M4.5 20.748S3 16.357 3 12" />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">Bem-vindo ao ATOS!</h1>
          </div>

          <div className="mb-8">
            <p className="text-lg text-gray-700 mb-3">
              Sua conta foi criada com sucesso.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-blue-800">
                Para acessar o painel, você precisa ser convidado para uma igreja.
              </p>
            </div>
            <p className="text-gray-600 mb-4">
              Peça ao administrador de uma igreja para enviar um convite para você.
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-xs text-gray-500 mb-4">
              Email: <span className="font-mono text-gray-700">{user.email}</span>
            </p>
            <Link
              href="/auth/sair"
              className="inline-block w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-4 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
            >
              Trocar Conta
            </Link>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <p className="text-xs text-gray-500">
              Ou aguarde um convite da sua igreja.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
