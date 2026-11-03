// LOCAL UI fixture, not an MRA adapter. Never deploy or use real credentials.
import http from 'node:http'
import { randomUUID } from 'node:crypto'
const user = { id: '00000000-0000-0000-0000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'fixture@example.invalid', app_metadata: {}, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
const token = () => `${Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: user.id, role: 'authenticated', exp: Math.floor(Date.now()/1000)+3600 })).toString('base64url')}.fixture`
const disciplines = [{ id: 1, nome: 'ANATOMIA — FIXTURE', cor: '#7c3aed', ciclo: 'basico', microassunto: null, total_paginas: 7 }, { id: 2, nome: 'CARDIOLOGIA — FIXTURE', cor: '#2563eb', ciclo: 'clinico', microassunto: null, total_paginas: 8 }]
const stages = ['mat_atualizado','mat_revisado','mat_diagramado','mat_conferencia','vid_envio_tema','vid_slide_pronto','vid_diagramacao','vid_aprovacao_slide','vid_agendamento','vid_gravacao_feita','vid_aprovacao_aula','vid_publicada','comp_questoes','comp_flashcards']
const themes = disciplines.map((d, i) => ({ id: i+1, disciplina_id: d.id, tema_especifico: i ? 'Insuficiência cardíaca — FIXTURE' : 'Membros superiores — FIXTURE', ordem: 1, paginas: 7, responsavel: null, observacoes: 'DADO SINTÉTICO', status_geral: 'concluido', updated_at: new Date().toISOString(), disciplinas: d, ...Object.fromEntries(stages.map(stage => [stage, 'pendente'])), mat_atualizado: 'concluido', comp_questoes: 'concluido' }))
let items = [{ id: randomUUID(), source: 'mra_academy', environment: 'staging', instance: 'fixture-local', entity: 'questions', external_id: 'q1', category: 'questoes', kind: 'content', cycle: 'clinico', label: 'Questão q1 — FIXTURE', taxonomy_label: 'Cardiologia', native_status: 'approved', facts: { generated: 1, reviewed: null, approved: 1, published: 1 }, updated_at: '2026-11-01T12:00:00Z', observed_at: '2026-11-02T12:00:00Z', synced_at: '2026-11-02T12:00:00Z', tema_id: 2 }, { id: randomUUID(), source: 'mra_academy', environment: 'staging', instance: 'fixture-local', entity: 'generation_batches', external_id: 'b1', category: 'questoes', kind: 'batch', cycle: 'clinico', label: 'Lote b1 — FIXTURE', taxonomy_label: 'Cardiologia', native_status: 'pending_review', facts: { generated: 40, reviewed: 12, approved: null, published: null }, updated_at: '2026-11-01T12:00:00Z', observed_at: '2026-11-02T12:00:00Z', synced_at: '2026-11-02T12:00:00Z', tema_id: 2 }]
const previews = []
function filtered(data, url) {
  return data.filter(row => [...url.searchParams.entries()].every(([key,value]) => {
    if (key === 'disciplinas.ciclo') return row.disciplinas?.ciclo === value.slice(3)
    if (value.startsWith('eq.')) return String(row[key]) === value.slice(3)
    if (value === 'not.is.null') return row[key] != null
    return true
  }))
}
http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin','http://127.0.0.1:3086')
  res.setHeader('Access-Control-Allow-Headers',req.headers['access-control-request-headers'] || 'authorization,apikey,content-type,x-client-info,prefer,range,x-supabase-api-version,accept-profile,content-profile')
  res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS')
  res.setHeader('Content-Type','application/json')
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return}
  const url = new URL(req.url, 'http://127.0.0.1:55492')
  let body = ''; for await (const chunk of req) body += chunk
  const data = body ? JSON.parse(body) : null
  let result
  if(url.pathname==='/auth/v1/token') result={user,access_token:token(),refresh_token:'fixture-refresh',expires_in:3600,expires_at:Math.floor(Date.now()/1000)+3600,token_type:'bearer'}
  else if(url.pathname==='/auth/v1/user') result=user
  else if(url.pathname==='/rest/v1/colaboradores') { const row={id:user.id,nivel:'coordenador',nome:'Gestor — FIXTURE'}; result=req.headers.accept?.includes('vnd.pgrst.object+json')?row:[row] }
  else if(url.pathname==='/rest/v1/acervo_operadores') result={user_id:user.id}
  else if(url.pathname==='/rest/v1/disciplinas') result=filtered(disciplines,url)
  else if(url.pathname==='/rest/v1/temas') result=filtered(themes,url)
  else if(url.pathname==='/rest/v1/acervo_itens') result=filtered(items,url)
  else if(url.pathname==='/rest/v1/acervo_importacoes' && req.method==='POST') { const entry={...data,id:randomUUID(),expires_at:new Date(Date.now()+3600000).toISOString(),created_at:new Date().toISOString(),applied_at:null}; previews.push(entry);result=entry }
  else if(url.pathname==='/rest/v1/acervo_importacoes') result=filtered(previews,url)
  else if(url.pathname==='/rest/v1/rpc/aplicar_acervo_previa') {
    const run=previews.find(p=>p.id===data.p_preview)
    if(!run){res.writeHead(409);res.end('{}');return}
    for(const item of run.payload.snapshot.items){const snap=run.payload.snapshot;const old=items.find(i=>i.entity===item.entity&&i.external_id===item.external_id);const next={...item,id:old?.id||randomUUID(),source:snap.source,environment:snap.environment,instance:snap.instance,observed_at:snap.observed_at,synced_at:new Date().toISOString(),tema_id:data.p_bindings.find(b=>b.entity===item.entity&&b.external_id===item.external_id)?.tema_id??null};if(old)Object.assign(old,next);else items.push(next)}
    run.applied_at=new Date().toISOString();run.applied_count=run.payload.snapshot.items.length;result={applied:run.applied_count}
  }
  else if(['/rest/v1/gravacoes','/rest/v1/tema_revisoes','/rest/v1/professor_disciplinas'].includes(url.pathname)) result=[]
  else {res.writeHead(404);res.end(JSON.stringify({error:'fixture route not implemented'}));return}
  res.end(JSON.stringify(result))
}).listen(55492,'127.0.0.1',()=>console.log('Synthetic Supabase fixture only: http://127.0.0.1:55492'))
