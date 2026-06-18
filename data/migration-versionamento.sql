-- ============================================================
-- Med2026 · Controle de versões (data de gravação + histórico de revisões)
-- Rode isto no SQL Editor do Supabase. É idempotente e NÃO destrutivo.
-- ============================================================

-- 1) Data em que a aula foi gravada (no próprio tema)
alter table public.temas
  add column if not exists gravado_em date;

-- 2) Histórico de revisões do material (controle de versões)
create table if not exists public.tema_revisoes (
  id          bigint generated always as identity primary key,
  tema_id     bigint not null references public.temas(id) on delete cascade,
  revisado_em date   not null default current_date,
  o_que_mudou text   not null,
  autor       text,
  criado_em   timestamptz not null default now()
);

create index if not exists tema_revisoes_tema_id_idx
  on public.tema_revisoes (tema_id, revisado_em desc);

-- 3) RLS: liberar leitura/escrita para usuários autenticados
--    (ajuste se sua política for mais restritiva)
alter table public.tema_revisoes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'tema_revisoes'
      and policyname = 'tema_revisoes_rw_authenticated'
  ) then
    create policy tema_revisoes_rw_authenticated
      on public.tema_revisoes
      for all
      to authenticated
      using (true)
      with check (true);
  end if;
end $$;
