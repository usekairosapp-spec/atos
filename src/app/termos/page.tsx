import type { Metadata } from "next";
import Link from "next/link";
import { AtosBrand } from "@/shared/components/atos-brand";

export const metadata: Metadata = {
  title: "Termos de Uso",
  description: "Termos de Uso do ATOS.",
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--foreground)] sm:px-8">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-10">
        <Link href="/" aria-label="Voltar para o início"><AtosBrand /></Link>
        <p className="mt-10 text-sm font-semibold uppercase tracking-[.15em] text-[var(--brand)]">Documentos legais</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Termos de Uso</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Última atualização: 25 de julho de 2026.</p>

        <div className="mt-9 space-y-8 leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">1. Aceitação</h2>
            <p className="mt-2">Ao criar uma conta ou usar o ATOS, você concorda com estes Termos e com a nossa Política de Privacidade. Se não concordar, não utilize a plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">2. Finalidade do serviço</h2>
            <p className="mt-2">O ATOS oferece recursos de organização de igrejas, equipes, setores, escalas, confirmações, trocas, comunicados e integração opcional com o Google Agenda. Recursos podem evoluir para melhorar o serviço.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">3. Conta e responsabilidades</h2>
            <p className="mt-2">Você deve fornecer informações verdadeiras, proteger o acesso à sua conta e comunicar qualquer uso não autorizado. Cada igreja administra seus integrantes, líderes, setores e escalas. O usuário deve respeitar as permissões atribuídas e não tentar acessar dados de outra pessoa ou igreja.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">4. Google Agenda</h2>
            <p className="mt-2">A conexão com o Google Agenda depende do consentimento do usuário e da disponibilidade dos serviços do Google. Você pode revogar a permissão a qualquer momento. Eventos criados pelo ATOS devem ser conferidos pelo usuário, especialmente data, horário e lembretes.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">5. Uso permitido</h2>
            <p className="mt-2">É proibido usar o ATOS para atividades ilícitas, abusivas, fraudulentas, para violar direitos de terceiros, disseminar conteúdo malicioso, contornar controles de segurança ou prejudicar a disponibilidade da plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">6. Disponibilidade</h2>
            <p className="mt-2">Buscamos manter o serviço seguro e disponível, mas podem ocorrer interrupções por manutenção, falhas de fornecedores ou eventos fora de nosso controle. Não garantimos funcionamento ininterrupto nem substituímos a comunicação e conferência interna da igreja.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">7. Suspensão e encerramento</h2>
            <p className="mt-2">O acesso pode ser suspenso em caso de violação destes Termos, risco de segurança ou exigência legal. Usuários podem solicitar exclusão de dados; administradores autorizados também podem remover vínculos com uma igreja conforme as regras da plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">8. Privacidade</h2>
            <p className="mt-2">O tratamento de dados pessoais é explicado na <Link className="font-semibold text-[var(--brand)] underline" href="/privacidade">Política de Privacidade</Link>, que integra estes Termos.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">9. Contato</h2>
            <p className="mt-2">Para suporte ou dúvidas sobre estes Termos, entre em contato pelo e-mail <a className="font-semibold text-[var(--brand)] underline" href="mailto:usekairosapp@gmail.com">usekairosapp@gmail.com</a>.</p>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap gap-4 border-t border-[var(--border)] pt-6 text-sm font-semibold">
          <Link className="text-[var(--brand)]" href="/">Início</Link>
          <Link className="text-[var(--brand)]" href="/privacidade">Política de Privacidade</Link>
          <Link className="text-[var(--brand)]" href="/entrar">Entrar no ATOS</Link>
        </footer>
      </article>
    </main>
  );
}
