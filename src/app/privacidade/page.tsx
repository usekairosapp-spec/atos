import type { Metadata } from "next";
import Link from "next/link";
import { AtosBrand } from "@/shared/components/atos-brand";

export const metadata: Metadata = {
  title: "Política de Privacidade",
  description: "Política de Privacidade do ATOS.",
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--foreground)] sm:px-8">
      <article className="mx-auto max-w-3xl rounded-[2rem] border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-10">
        <Link href="/" aria-label="Voltar para o início"><AtosBrand /></Link>
        <p className="mt-10 text-sm font-semibold uppercase tracking-[.15em] text-[var(--brand)]">Documentos legais</p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Política de Privacidade</h1>
        <p className="mt-3 text-sm text-[var(--muted)]">Última atualização: 25 de julho de 2026.</p>

        <div className="mt-9 space-y-8 leading-7 text-[var(--muted)]">
          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">1. Sobre o ATOS</h2>
            <p className="mt-2">O ATOS — Agenda de Times, Organização e Serviço — ajuda igrejas a organizar equipes, escalas, confirmações, trocas e comunicados. Esta política explica como os dados pessoais são tratados durante o uso da plataforma.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">2. Dados que tratamos</h2>
            <p className="mt-2">Podemos tratar nome, e-mail, telefone, foto de perfil, identificadores da conta, igreja e equipes vinculadas, funções, escalas, confirmações, solicitações de troca, comunicados e registros técnicos necessários à segurança e ao funcionamento do serviço.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">3. Login com Google</h2>
            <p className="mt-2">Quando você escolhe entrar com Google, usamos as informações básicas autorizadas por você, como nome, e-mail e identificação da conta, para autenticar e manter sua sessão no ATOS.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">4. Google Agenda</h2>
            <p className="mt-2">A integração com o Google Agenda é opcional. Quando você solicita a conexão, o ATOS pede somente a permissão necessária para criar e gerenciar eventos de escala adicionados pelo próprio aplicativo em seu calendário.</p>
            <p className="mt-2">Usamos essa permissão para criar, atualizar, recriar ou remover o evento vinculado quando necessário, incluindo data, horário, igreja, setor, função e lembretes. O ATOS não lê nem compartilha outros eventos do seu calendário para fins publicitários.</p>
            <p className="mt-2">O uso e a transferência de informações recebidas das APIs do Google obedecem à <a className="font-semibold text-[var(--brand)] underline" href="https://developers.google.com/terms/api-services-user-data-policy" rel="noreferrer" target="_blank">Política de Dados do Usuário dos Serviços de API do Google</a>, inclusive aos requisitos de Uso Limitado.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">5. Finalidades e compartilhamento</h2>
            <p className="mt-2">Os dados são usados para autenticação, funcionamento das escalas, comunicação entre integrantes da igreja, segurança, suporte e melhoria do serviço. Não vendemos dados pessoais. Eles podem ser processados por fornecedores essenciais de infraestrutura, autenticação, banco de dados e hospedagem, sujeitos às respectivas medidas de proteção.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">6. Conservação e segurança</h2>
            <p className="mt-2">Mantemos os dados pelo período necessário para prestar o serviço, cumprir obrigações e proteger direitos. Aplicamos controles de acesso por usuário e igreja, conexões seguras e regras de autorização no banco de dados. Nenhum sistema, entretanto, elimina completamente todos os riscos.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">7. Seus direitos e revogação</h2>
            <p className="mt-2">Você pode solicitar acesso, correção ou exclusão de seus dados pelo contato abaixo. Também pode revogar o acesso do ATOS ao Google em <a className="font-semibold text-[var(--brand)] underline" href="https://myaccount.google.com/connections" rel="noreferrer" target="_blank">Conexões da Conta Google</a>. A revogação interrompe novas sincronizações com o Google Agenda.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-[var(--foreground)]">8. Contato</h2>
            <p className="mt-2">Para dúvidas, solicitações de privacidade ou exclusão de dados, escreva para <a className="font-semibold text-[var(--brand)] underline" href="mailto:usekairosapp@gmail.com">usekairosapp@gmail.com</a>.</p>
          </section>
        </div>

        <footer className="mt-10 flex flex-wrap gap-4 border-t border-[var(--border)] pt-6 text-sm font-semibold">
          <Link className="text-[var(--brand)]" href="/">Início</Link>
          <Link className="text-[var(--brand)]" href="/termos">Termos de Uso</Link>
          <Link className="text-[var(--brand)]" href="/entrar">Entrar no ATOS</Link>
        </footer>
      </article>
    </main>
  );
}
