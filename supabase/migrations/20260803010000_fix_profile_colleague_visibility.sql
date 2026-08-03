-- Bug sistemico: a policy de profiles que libera ver o nome de "colegas da
-- mesma igreja" faz uma sub-consulta direta em church_memberships pra
-- verificar o vinculo da OUTRA pessoa — mas church_memberships so permite
-- que cada usuario veja o proprio vinculo (exceto admin da igreja). Entao,
-- pra qualquer lider de setor que nao seja tambem admin da igreja, essa
-- verificacao nunca conseguia enxergar o vinculo do colega e falhava
-- silenciosamente: o nome vinha nulo pra todo mundo, exceto o proprio
-- lider, em qualquer tela que monta a lista de membros direto pela tabela
-- (nova escala, escala em lote, montar equipe). Corrige envolvendo essa
-- verificacao numa funcao SECURITY DEFINER, que enxerga church_memberships
-- sem essa trava.
create or replace function public.are_church_colleagues(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.church_memberships theirs
    where theirs.user_id = target_profile_id
      and (
        public.is_church_admin(theirs.church_id)
        or exists (
          select 1
          from public.church_memberships mine
          where mine.church_id = theirs.church_id
            and mine.user_id = (select auth.uid())
            and mine.status = 'active'
            and theirs.status = 'active'
        )
      )
  );
$$;

revoke all on function public.are_church_colleagues(uuid) from public;
grant execute on function public.are_church_colleagues(uuid) to authenticated;

drop policy if exists "profiles read self church colleagues or platform admin" on public.profiles;
create policy "profiles read self church colleagues or platform admin" on public.profiles
  for select
  using (
    id = (select auth.uid())
    or is_platform_admin()
    or public.are_church_colleagues(id)
  );
