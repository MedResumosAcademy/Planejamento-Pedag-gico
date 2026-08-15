import { createAdminClient } from '@/lib/supabase/admin'
import * as A from '@/lib/analytics'
import { CICLOS, type Ciclo } from '@/lib/cycles'

const DAY = 86400000

export type Period = 'weekly' | 'monthly'

const C = {
  bg: '#f4f6fb', card: '#ffffff', bd: '#e7e9f2', text: '#0f172a',
  muted: '#64748b', faint: '#94a3b8', accent: '#7c3aed',
  ok: '#16a34a', risk: '#dc2626', warn: '#d97706', info: '#2563eb',
}
const fmt = (iso: string | null, o: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', o) : '—'
const esc = (s: any) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export interface ReportModel {
  period: Period
  ciclo: Ciclo
  title: string
  rangeLabel: string
  subject: string
  // snapshot
  progressoPct: number; doneStages: number; totalStages: number
  velocity: number; projDate: string | null; onTrack: boolean | null
  pendencias: number; emRisco: { nome: string; pct: number; date: string | null }[]
  // atividade no período
  gravacoes: { tema: string; disc: string; data: string }[]
  revisoes: { tema: string; disc: string; oque: string; autor: string | null; data: string }[]
  aulasGravadas: number
  temasAvancaram: number
  recipients: string[]
}

export async function buildReport(period: Period, ciclo: Ciclo = 'basico'): Promise<{ model: ReportModel; html: string }> {
  const supabase = createAdminClient()
  const cycleConfig = CICLOS[ciclo]
  const now = new Date()
  const days = period === 'weekly' ? 7 : 30
  const since = new Date(now.getTime() - days * DAY)
  const sinceISO = since.toISOString()
  const sinceDate = sinceISO.slice(0, 10)

  const [discRes, temasRes, colabRes] = await Promise.all([
    supabase.from('disciplinas').select('*'),
    supabase.from('temas').select('*'),
    supabase.from('colaboradores').select('id, nome, email, nivel'),
  ])
  const disciplinas = (discRes.data || []).filter((d: any) => d.ciclo === ciclo)
  const disciplinaIds = new Set(disciplinas.map((d: any) => d.id))
  const temas = (temasRes.data || []).filter((t: any) => disciplinaIds.has(t.disciplina_id))
  const colaboradores = colabRes.data || []
  const discById = new Map(disciplinas.map((d: any) => [d.id, d]))

  // Gravações (janela ampla para o snapshot; filtramos o período depois)
  const gravWide = ((await supabase
    .from('gravacoes')
    .select('*, disciplinas(nome), temas(tema_especifico)')
    .gte('data_hora', new Date(now.getTime() - 12 * 7 * DAY).toISOString().slice(0, 10))
  ).data || []).filter((g: any) => disciplinaIds.has(g.disciplina_id))

  // Revisões do período (tabela pode não existir ainda — tolera erro)
  let revisoesRaw: any[] = []
  try {
    const r = await supabase
      .from('tema_revisoes')
      .select('*, temas(tema_especifico, disciplina_id)')
      .gte('criado_em', sinceISO)
      .order('criado_em', { ascending: false })
    revisoesRaw = (r.data || []).filter((revisao: any) => disciplinaIds.has(revisao.temas?.disciplina_id))
  } catch { revisoesRaw = [] }

  // ---- Snapshot (analytics) ----
  const k = A.kpis(temas as any, gravWide as any, now, cycleConfig.target)
  const risk = A.riskByDiscipline(disciplinas as any, temas as any, now, cycleConfig.target, {})
  const emRisco = risk.filter(r => r.onTrack === false).map(r => ({ nome: r.nome, pct: r.pct, date: r.date }))

  // ---- Atividade no período ----
  const gravacoes = gravWide
    .filter((g: any) => g.status === 'concluida' && new Date(g.data_hora) >= since)
    .sort((a: any, b: any) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
    .map((g: any) => ({ tema: g.temas?.tema_especifico || '—', disc: g.disciplinas?.nome || '—', data: g.data_hora }))

  const revisoes = revisoesRaw.map((r: any) => ({
    tema: r.temas?.tema_especifico || '—',
    disc: discById.get(r.temas?.disciplina_id)?.nome || '—',
    oque: r.o_que_mudou, autor: r.autor, data: r.revisado_em || r.criado_em,
  }))

  const aulasGravadas = temas.filter((t: any) => t.gravado_em && t.gravado_em >= sinceDate).length
  const temasAvancaram = temas.filter((t: any) => t.updated_at && new Date(t.updated_at) >= since).length

  // ---- Destinatários ----
  const envList = (process.env.REPORT_RECIPIENTS || '').split(',').map(s => s.trim()).filter(Boolean)
  const coordEmails = colaboradores.filter((c: any) => c.nivel === 'coordenador' && c.email).map((c: any) => c.email)
  const recipients = Array.from(new Set([...envList, ...coordEmails]))

  const title = period === 'weekly' ? 'Relatório Semanal' : 'Relatório Mensal'
  const rangeLabel = `${fmt(sinceISO)} – ${fmt(now.toISOString())}`
  const subject = `${title} · ${cycleConfig.label} · Med2026 · ${rangeLabel} · ${k.progressoPct}% concluído`

  const model: ReportModel = {
    period, ciclo, title, rangeLabel, subject,
    progressoPct: k.progressoPct, doneStages: k.doneStages, totalStages: k.totalStages,
    velocity: k.velocity, projDate: k.projection.date, onTrack: k.projection.onTrack,
    pendencias: k.pendencias, emRisco,
    gravacoes, revisoes, aulasGravadas, temasAvancaram, recipients,
  }
  return { model, html: renderEmail(model) }
}

function statBox(label: string, value: string, color: string) {
  return `<td style="padding:6px"><div style="background:${C.bg};border:1px solid ${C.bd};border-radius:12px;padding:12px 14px">
    <div style="font-size:11px;color:${C.muted};font-weight:600;text-transform:uppercase;letter-spacing:.4px">${esc(label)}</div>
    <div style="font-size:22px;font-weight:800;color:${color};margin-top:4px">${esc(value)}</div></div></td>`
}
function listBlock(title: string, rows: string[]) {
  return `<div style="margin-top:22px">
    <div style="font-size:13px;font-weight:700;color:${C.text};margin-bottom:8px">${esc(title)}</div>
    ${rows.length ? rows.join('') : `<div style="font-size:13px;color:${C.faint};padding:6px 0">Nada registrado neste período.</div>`}
  </div>`
}

export function renderEmail(m: ReportModel): string {
  const cycleConfig = CICLOS[m.ciclo]
  const statusTxt = m.projDate ? (m.onTrack ? '✓ No prazo' : '⚠ Em risco') : 'Sem ritmo'
  const statusColor = m.projDate ? (m.onTrack ? C.ok : C.risk) : C.faint
  const projStr = m.projDate ? fmt(m.projDate, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const gravRows = m.gravacoes.slice(0, 30).map(g =>
    `<div style="display:block;background:${C.bg};border-radius:8px;padding:8px 10px;margin-bottom:5px">
      <span style="font-size:13px;color:${C.text};font-weight:600">${esc(g.tema)}</span>
      <span style="font-size:12px;color:${C.faint}"> · ${esc(g.disc)} · ${fmt(g.data)}</span></div>`)

  const revRows = m.revisoes.slice(0, 40).map(r =>
    `<div style="background:${C.bg};border-radius:8px;padding:8px 10px;margin-bottom:5px">
      <div><span style="font-size:13px;color:${C.text};font-weight:600">${esc(r.tema)}</span>
      <span style="font-size:12px;color:${C.faint}"> · ${esc(r.disc)} · ${fmt(r.data)}${r.autor ? ' · ' + esc(r.autor) : ''}</span></div>
      <div style="font-size:12.5px;color:${C.muted};margin-top:2px">${esc(r.oque)}</div></div>`)

  const riskRows = m.emRisco.slice(0, 20).map(r =>
    `<div style="background:#fef2f2;border-radius:8px;padding:7px 10px;margin-bottom:5px">
      <span style="font-size:13px;color:${C.text};font-weight:600">${esc(r.nome)}</span>
      <span style="font-size:12px;color:${C.risk};font-weight:600"> · ${r.pct}% · previsão ${r.date ? fmt(r.date, { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span></div>`)

  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:${C.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${C.text}">
<div style="max-width:640px;margin:0 auto;padding:24px 16px">
  <div style="background:${C.card};border:1px solid ${C.bd};border-radius:16px;padding:24px 26px">
    <div style="display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-size:12px;color:${C.accent};font-weight:700;letter-spacing:.5px;text-transform:uppercase">Med2026 · ${esc(cycleConfig.label)}</div>
        <div style="font-size:22px;font-weight:800;margin-top:2px">${esc(m.title)}</div>
        <div style="font-size:13px;color:${C.muted};margin-top:2px">${esc(m.rangeLabel)}</div>
      </div>
      <div style="background:${statusColor}1a;color:${statusColor};font-weight:700;font-size:13px;padding:8px 14px;border-radius:999px;white-space:nowrap">${statusTxt}</div>
    </div>

    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin-top:18px;border-collapse:separate;border-spacing:0">
      <tr>
        ${statBox('Progresso', m.progressoPct + '%', C.accent)}
        ${statBox('Etapas', `${m.doneStages}/${m.totalStages}`, C.text)}
        ${statBox('Velocidade', m.velocity.toFixed(0) + '/sem', C.info)}
      </tr>
      <tr>
        ${statBox('Previsão', projStr, statusColor)}
        ${statBox('Em risco', String(m.emRisco.length), m.emRisco.length ? C.risk : C.ok)}
        ${statBox('Pendências', String(m.pendencias), m.pendencias ? C.warn : C.faint)}
      </tr>
    </table>

    <div style="margin-top:8px;font-size:12.5px;color:${C.muted};line-height:1.6">
      No período: <b style="color:${C.text}">${m.gravacoes.length}</b> gravações concluídas ·
      <b style="color:${C.text}">${m.revisoes.length}</b> revisões registradas ·
      <b style="color:${C.text}">${m.aulasGravadas}</b> aulas marcadas como gravadas ·
      <b style="color:${C.text}">${m.temasAvancaram}</b> temas atualizados.
    </div>

    ${listBlock(`🎥 Gravações concluídas (${m.gravacoes.length})`, gravRows)}
    ${listBlock(`📝 Revisões de material (${m.revisoes.length})`, revRows)}
    ${m.emRisco.length ? listBlock(`🚩 Disciplinas em risco (${m.emRisco.length})`, riskRows) : ''}

    <div style="margin-top:24px;padding-top:14px;border-top:1px solid ${C.bd};font-size:11.5px;color:${C.faint};line-height:1.5">
      Relatório automático do painel Med2026. Velocidade e previsão são estimativas (o banco não guarda histórico por etapa); gravações e revisões refletem registros reais do período.
    </div>
  </div>
</div></body></html>`
}

export async function sendReport(period: Period, ciclo: Ciclo = 'basico'): Promise<{ ok: boolean; sent?: number; recipients?: string[]; error?: string; skipped?: string }> {
  const { model, html } = await buildReport(period, ciclo)
  if (!model.recipients.length) return { ok: false, skipped: 'Nenhum destinatário (defina REPORT_RECIPIENTS ou cadastre coordenadores com email).' }
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { ok: false, error: 'Falta RESEND_API_KEY no ambiente.' }
  const from = process.env.REPORT_FROM || 'Med2026 <onboarding@resend.dev>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: model.recipients, subject: model.subject, html }),
  })
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` }
  return { ok: true, sent: model.recipients.length, recipients: model.recipients }
}
