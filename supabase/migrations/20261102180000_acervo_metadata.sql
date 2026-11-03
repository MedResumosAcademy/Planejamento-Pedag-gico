-- Additive Med2026 migration. Never run against an MRA Academy database.
-- No existing planning row, stage, page count, revision or collaborator is changed.
begin;

create table public.acervo_operadores (
  user_id uuid primary key references auth.users(id),
  created_at timestamptz not null default now()
);
create table public.acervo_itens (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('mra_academy','question_factory','flashcard_factory')),
  environment text not null check (environment in ('staging','production')),
  instance text not null,
  entity text not null,
  external_id text not null,
  category text not null check (category in ('resumos','videoaulas','questoes','flashcards')),
  kind text not null check (kind in ('content','batch')),
  cycle text check (cycle in ('basico','clinico')),
  label text not null,
  taxonomy_label text,
  native_status text,
  facts jsonb not null,
  updated_at timestamptz not null,
  observed_at timestamptz not null,
  synced_at timestamptz not null default now(),
  tema_id bigint references public.temas(id),
  unique (source, environment, instance, entity, external_id)
);
create index acervo_itens_tema_idx on public.acervo_itens(tema_id);
create index acervo_itens_cycle_category_idx on public.acervo_itens(cycle, category);
create table public.acervo_importacoes (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references auth.users(id),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 hour',
  applied_at timestamptz,
  applied_count integer
);
create index acervo_importacoes_actor_idx on public.acervo_importacoes(actor_id, created_at desc);

alter table public.acervo_operadores enable row level security;
alter table public.acervo_itens enable row level security;
alter table public.acervo_importacoes enable row level security;
-- Only authenticated and explicitly allowlisted API handlers can use service_role.
revoke all on public.acervo_operadores, public.acervo_itens, public.acervo_importacoes from public, anon, authenticated;
grant all on public.acervo_operadores, public.acervo_itens, public.acervo_importacoes to service_role;

create function public.aplicar_acervo_previa(p_preview uuid, p_actor uuid, p_bindings jsonb)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  run public.acervo_importacoes%rowtype;
  snap jsonb;
  item jsonb;
  binding jsonb;
  old public.acervo_itens%rowtype;
  baseline jsonb;
  target bigint;
  target_cycle text;
  applied integer := 0;
begin
  if not exists (select 1 from public.acervo_operadores where user_id = p_actor) then raise exception 'acervo_forbidden'; end if;
  select * into run from public.acervo_importacoes where id = p_preview and actor_id = p_actor for update;
  if not found then raise exception 'acervo_preview_not_found'; end if;
  if run.applied_at is not null then return jsonb_build_object('applied', run.applied_count, 'already_applied', true); end if;
  if run.expires_at < now() then raise exception 'acervo_preview_expired'; end if;
  snap := run.payload->'snapshot';
  -- Serializes competing previews for this exact source namespace.
  perform pg_advisory_xact_lock(hashtextextended((snap->>'source') || ':' || (snap->>'environment') || ':' || (snap->>'instance'), 0));
  if jsonb_typeof(p_bindings) <> 'array' or jsonb_array_length(p_bindings) <> jsonb_array_length(snap->'items') then raise exception 'acervo_bindings_invalid'; end if;
  for item in select value from jsonb_array_elements(snap->'items') loop
    if (select count(*) from jsonb_array_elements(p_bindings) b where b->>'entity' = item->>'entity' and b->>'external_id' = item->>'external_id') <> 1 then raise exception 'acervo_bindings_invalid'; end if;
    select value into binding from jsonb_array_elements(p_bindings) where value->>'entity' = item->>'entity' and value->>'external_id' = item->>'external_id';
    target := (binding->>'tema_id')::bigint;
    if target is not null then
      select d.ciclo into target_cycle from public.temas t join public.disciplinas d on d.id = t.disciplina_id where t.id = target;
      if not found or item->>'cycle' is null or target_cycle <> item->>'cycle' then raise exception 'acervo_cycle_mismatch'; end if;
    end if;
    select * into old from public.acervo_itens where source = snap->>'source' and environment = snap->>'environment' and instance = snap->>'instance' and entity = item->>'entity' and external_id = item->>'external_id' for update;
    select value into baseline from jsonb_array_elements(run.payload->'baseline') where value->>'entity' = item->>'entity' and value->>'external_id' = item->>'external_id';
    if old.id is not null then
      if baseline->>'synced_at' is null or old.synced_at <> (baseline->>'synced_at')::timestamptz then raise exception 'acervo_preview_conflict'; end if;
      if (snap->>'observed_at')::timestamptz < old.observed_at or (item->>'updated_at')::timestamptz < old.updated_at then raise exception 'acervo_stale_snapshot'; end if;
      if old.category <> item->>'category' or old.kind <> item->>'kind' then raise exception 'acervo_identity_conflict'; end if;
    elsif baseline->>'synced_at' is not null then
      raise exception 'acervo_preview_conflict';
    end if;
    insert into public.acervo_itens(source, environment, instance, entity, external_id, category, kind, cycle, label, taxonomy_label, native_status, facts, updated_at, observed_at, tema_id)
    values (snap->>'source', snap->>'environment', snap->>'instance', item->>'entity', item->>'external_id', item->>'category', item->>'kind', item->>'cycle', item->>'label', item->>'taxonomy_label', item->>'native_status', item->'facts', (item->>'updated_at')::timestamptz, (snap->>'observed_at')::timestamptz, target)
    on conflict (source, environment, instance, entity, external_id) do update set
      cycle = excluded.cycle, label = excluded.label, taxonomy_label = excluded.taxonomy_label,
      native_status = excluded.native_status, facts = excluded.facts, updated_at = excluded.updated_at,
      observed_at = excluded.observed_at, synced_at = clock_timestamp(), tema_id = excluded.tema_id;
    applied := applied + 1;
  end loop;
  update public.acervo_importacoes set applied_at = now(), applied_count = applied where id = run.id;
  return jsonb_build_object('applied', applied, 'already_applied', false);
end;
$$;
revoke all on function public.aplicar_acervo_previa(uuid, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.aplicar_acervo_previa(uuid, uuid, jsonb) to service_role;
commit;
