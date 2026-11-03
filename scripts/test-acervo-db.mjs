// Disposable LOCAL PostgreSQL only. Does not read environment credentials.
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
const directory = mkdtempSync(join(tmpdir(), 'med2026-acervo-pg-'))
const port = '55491'
let started = false
function command(name, args, input) { return execFileSync(name, args, { input, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }) }
function sql(input) { return command('psql', ['-h', directory, '-p', port, '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-X'], input) }
try {
  command('initdb', ['-D', join(directory, 'data'), '-A', 'trust', '--no-locale'])
  command('pg_ctl', ['-D', join(directory, 'data'), '-l', join(directory, 'postgres.log'), '-o', `-p ${port} -k ${directory} -h ''`, '-w', 'start'])
  started = true
  sql(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    insert into auth.users values ('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
    create table disciplinas(id bigint primary key, ciclo text); insert into disciplinas values (1,'basico'),(2,'clinico');
    create table temas(id bigint primary key, disciplina_id bigint references disciplinas(id), observacoes text, mat_atualizado text, paginas int);
    insert into temas values(1,1,'PRESERVAR','concluido',7),(2,2,'PRESERVAR CLINICO','em_andamento',8);
    grant usage on schema public, auth to service_role; grant select on disciplinas,temas to service_role;`)
  sql(readFileSync(new URL('../supabase/migrations/20261102180000_acervo_metadata.sql', import.meta.url), 'utf8'))
  sql(`insert into acervo_operadores values('00000000-0000-0000-0000-000000000001',now());`)
  const snapshot = { version: 1, source: 'mra_academy', environment: 'staging', instance: 'fixture', observed_at: '2026-11-02T12:00:00Z', scope: 'shared_catalog', items: [{ entity: 'questions', external_id: 'q1', category: 'questoes', kind: 'content', cycle: 'basico', label: 'q1', taxonomy_label: null, native_status: 'approved', facts: { generated: 1, reviewed: null, approved: 1, published: 1 }, updated_at: '2026-11-01T12:00:00Z' }] }
  const payload = { snapshot, baseline: [{ entity: 'questions', external_id: 'q1', synced_at: null }] }
  const literal = v => `'${JSON.stringify(v).replaceAll("'", "''")}'::jsonb`
  const bindings = [{ entity: 'questions', external_id: 'q1', tema_id: 1 }]
  const preview = '10000000-0000-0000-0000-000000000001'
  const actor = '00000000-0000-0000-0000-000000000001'
  sql(`insert into acervo_importacoes(id,actor_id,payload) values('${preview}','${actor}',${literal(payload)});`)
  sql(`set role service_role; select aplicar_acervo_previa('${preview}','${actor}',${literal(bindings)}); select aplicar_acervo_previa('${preview}','${actor}',${literal(bindings)});`)
  sql(`do $$ begin
    if (select count(*) from acervo_itens) <> 1 then raise exception 'duplicate'; end if;
    if (select observacoes <> 'PRESERVAR' or mat_atualizado <> 'concluido' or paginas <> 7 from temas where id=1) then raise exception 'planning modified'; end if;
    if (select tema_id from acervo_itens) <> 1 then raise exception 'mapping lost'; end if;
    if has_table_privilege('anon','acervo_itens','select') or has_table_privilege('authenticated','acervo_itens','insert') or has_function_privilege('authenticated','aplicar_acervo_previa(uuid,uuid,jsonb)','execute') then raise exception 'ACL leak'; end if;
  end $$;`)
  const baseline = JSON.parse(command('psql', ['-h', directory, '-p', port, '-d', 'postgres', '-XAt', '-c', "select json_agg(json_build_object('entity',entity,'external_id',external_id,'synced_at',synced_at)) from acervo_itens"]).trim())
  payload.baseline = baseline
  const p2 = '10000000-0000-0000-0000-000000000002'
  sql(`insert into acervo_importacoes(id,actor_id,payload) values('${p2}','${actor}',${literal(payload)});`)
  function mustFail(query, marker) {
    try { sql(query); throw new Error('Expected SQL rejection') }
    catch (error) { if (!String(error.stderr).includes(marker)) throw error }
  }
  mustFail(`set role service_role; select aplicar_acervo_previa('${p2}','${actor}',${literal([{ ...bindings[0], tema_id: 2 }])});`, 'acervo_cycle_mismatch')
  mustFail(`set role service_role; select aplicar_acervo_previa('${p2}','00000000-0000-0000-0000-000000000002',${literal(bindings)});`, 'acervo_forbidden')
  sql(`set role service_role; select aplicar_acervo_previa('${p2}','${actor}',${literal(bindings)});`)
  // Reusing a baseline observed before p2 must fail, not overwrite concurrent edits.
  const p3 = '10000000-0000-0000-0000-000000000003'
  sql(`insert into acervo_importacoes(id,actor_id,payload) values('${p3}','${actor}',${literal(payload)});`)
  mustFail(`set role service_role; select aplicar_acervo_previa('${p3}','${actor}',${literal(bindings)});`, 'acervo_preview_conflict')
  sql(`do $$ begin if (select count(*) from acervo_itens) <> 1 then raise exception 'duplicate reimport'; end if; end $$;`)
  console.log('PostgreSQL local: migration, aplicação atômica, replay idempotente, reimportação sem duplicação, conflito concorrente, ciclo, ACL e preservação do planejamento passaram.')
} finally {
  if (started) command('pg_ctl', ['-D', join(directory, 'data'), '-m', 'fast', '-w', 'stop'])
  console.log(`Fixture local encerrada; artefatos privados preservados em ${directory}`)
}
