'use client'

import { useEffect, useMemo, useState } from 'react'
import { getAllDisciplinas, getAllTemas } from '@/lib/repositories/disciplinas'
import { getAllColaboradores } from '@/lib/repositories/colaboradores'
import { getGravacoesRange } from '@/lib/repositories/gravacoes'
import * as A from '@/lib/analytics'
import { CICLOS } from '@/lib/cycles'
import type { Ciclo, Disciplina, Tema, Gravacao, Colaborador } from '@/types'

const DAY = 86400000
const fmt = (iso: string | null, o: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short' }) =>
  iso ? new Date(iso).toLocaleDateString('pt-BR', o) : '—'
const initials = (n: string) => n.replace(/^(Dra?\.|Prof\.)\s*/, '').split(' ').filter(Boolean).slice(0, 2).map(s => s[0]).join('').toUpperCase()
function avColor(id: string) {
  const c = ['#6366f1', '#0891b2', '#16a34a', '#ca8a04', '#db2777', '#9333ea', '#dc2626', '#0369a1']
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) % c.length; return c[h]
}
const Info = ({ t }: { t: string }) => <span className="i" title={t}>i</span>

export default function GerencialDashboard({ ciclo }: { ciclo?: Ciclo }) {
  const cycleConfig = CICLOS[ciclo ?? 'basico']
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [temas, setTemas] = useState<Tema[]>([])
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([])
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [discId, setDiscId] = useState<number | null>(null)
  const [profId, setProfId] = useState<string | null>(null)
  const [drill, setDrill] = useState<{ type: string; id?: any; title: string } | null>(null)
  const today = useMemo(() => new Date(), [])
  const target = useMemo(() => new Date(cycleConfig.target + 'T00:00:00'), [cycleConfig.target])

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const start = new Date(today.getTime() - 12 * 7 * DAY).toISOString().slice(0, 10)
        const end = new Date(today.getTime() + 5 * 7 * DAY).toISOString().slice(0, 10)
        const [d, t, c, g] = await Promise.all([
          getAllDisciplinas(ciclo), getAllTemas(ciclo), getAllColaboradores(), getGravacoesRange(start, end, ciclo),
        ])
        setDisciplinas(d); setTemas(t); setColaboradores(c); setGravacoes(g)
      } catch (e) { console.error('Falha ao carregar o painel:', e) }
      setLoading(false)
    })()
  }, [today, ciclo])

  useEffect(() => {
    setDiscId(null)
    setProfId(null)
    setDrill(null)
  }, [ciclo])

  const F: A.Filter = { discId, profId }
  const professores = colaboradores.filter(c => c.nivel === 'professor')
  const tF = useMemo(() => A.filterTemas(temas as any, colaboradores as any, F), [temas, colaboradores, discId, profId])
  const gF = useMemo(() => A.filterGravs(gravacoes as any, colaboradores as any, F), [gravacoes, colaboradores, discId, profId])
  const k = useMemo(() => A.kpis(tF, gF, today, target), [tF, gF, today, target])
  const fn = useMemo(() => A.funnel(tF), [tF])
  const risk = useMemo(() => A.riskByDiscipline(disciplinas as any, temas as any, today, target, F), [disciplinas, temas, today, target, discId])
  const ppl = useMemo(() => A.people(colaboradores as any, temas as any, gravacoes as any, disciplinas as any, today, F), [colaboradores, temas, gravacoes, disciplinas, discId, profId, today])
  const pend = useMemo(() => A.pendencias(gF, tF), [gF, tF])
  const discById = useMemo(() => new Map(disciplinas.map(d => [d.id, d])), [disciplinas])
  const profById = useMemo(() => new Map(colaboradores.map(c => [c.id, c])), [colaboradores])

  const proj = k.projection
  const onTrack = proj.onTrack
  const projStr = proj.date ? fmt(proj.date, { day: '2-digit', month: 'short', year: '2-digit' }) : '—'
  const emRisco = risk.filter(r => r.onTrack === false).length
  const mxL = Math.max(...ppl.map(p => p.recentDone), 1)
  const bottle = fn.rows[fn.bottleneck]
  const gargalos = fn.rows.map((r, i) => ({ ...r, i })).sort((a, b) => (b.wip + b.fila) - (a.wip + a.fila)).slice(0, 6)
  const nF = tF.length || 1

  const kpis = [
    { type: 'progresso', l: 'Progresso', v: k.progressoPct + '%', s: `${k.doneStages}/${k.totalStages} etapas`, c: '#7c3aed', tip: 'Etapas concluídas ÷ total. Cada tema tem 14 etapas.' },
    { type: 'previsao', l: 'Previsão', v: projStr, s: proj.date ? (onTrack ? 'dentro da meta' : 'após a meta') : 'sem ritmo', c: proj.date ? (onTrack ? '#16a34a' : '#dc2626') : '#94a3b8', tip: 'Término projetado no ritmo atual vs. a meta.' },
    { type: 'velocidade', l: 'Velocidade', v: k.velocity.toFixed(0), s: 'etapas/sem (est.)', c: '#2563eb', tip: 'Etapas por semana — estimativa das últimas 4 semanas.' },
    { type: 'gravacoes', l: 'Gravações', v: k.gravFeitas, s: `${k.gravAgendadas} agendadas`, c: '#0891b2', tip: 'Gravações concluídas no período; e quantas já estão agendadas.' },
    { type: 'pendencias', l: 'Pendências', v: k.pendencias, s: 'aprovar + remarcar', c: k.pendencias > 0 ? '#d97706' : '#94a3b8', tip: 'Propostas aguardando aprovação + canceladas a remarcar.' },
  ]

  const STG = A.STAGES, LBL = A.STAGE_LABELS, GRP = A.STAGE_GROUP
  const grpColor = (g: string) => g === 'Material' ? '#2563eb' : g === 'Vídeo' ? '#7c3aed' : '#db2777'
  function drillSubtitle() {
    if (!drill) return ''
    switch (drill.type) {
      case 'progresso': return `${k.doneStages} de ${k.totalStages} etapas concluídas`
      case 'previsao': return `projeção no ritmo atual vs. meta ${fmt(cycleConfig.target + 'T00:00:00', { day: '2-digit', month: 'short', year: 'numeric' })}`
      case 'velocidade': return `~${k.velocity.toFixed(0)} etapas/semana · estimativa (sem histórico por etapa)`
      case 'gravacoes': return `${k.gravFeitas} concluídas · ${k.gravAgendadas} agendadas`
      case 'pendencias': return 'gravações que dependem de decisão'
      case 'disc': return 'progresso por tema desta disciplina'
      case 'stage': return 'temas em andamento ou na fila desta etapa'
      case 'prof': return 'disciplinas sob responsabilidade'
      default: return ''
    }
  }
  function drillBody() {
    if (!drill) return null
    if (drill.type === 'progresso') return (<>
      <div className="dsec">Por etapa</div>
      {STG.map((s, i) => { const c = tF.filter(t => (t as any)[s] === 'concluido').length; return (
        <div key={s} className="drow"><span className="dl">{LBL[i]}</span><span className="dbar"><i style={{ width: (c / nF * 100) + '%', background: grpColor(GRP[i]) }} /></span><span className="dv">{c}/{nF}</span></div>) })}
      <div className="dsec">Por disciplina</div>
      {risk.map(r => (<div key={r.id} className="drow"><span className="dl" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><i style={{ width: 8, height: 8, borderRadius: 2, background: r.cor, display: 'inline-block' }} />{r.nome}</span><span className="dbar"><i style={{ width: r.pct + '%', background: r.cor }} /></span><span className="dv">{r.pct}%</span></div>))}
    </>)
    if (drill.type === 'previsao') return risk.map(r => (
      <div key={r.id} className="drow2"><span className="dl" style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1, minWidth: 0 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: r.cor, flexShrink: 0 }} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.nome}</span></span><span className="mt">{r.pct}%</span><span className="mt">{r.velocity.toFixed(1)}/sem</span><span style={{ fontWeight: 700, color: r.onTrack === false ? '#dc2626' : '#16a34a', fontSize: 12, width: 70, textAlign: 'right' }}>{r.date ? fmt(r.date, { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span></div>))
    if (drill.type === 'velocidade') {
      const cutoff = today.getTime() - 28 * DAY
      const recent = tF.filter(t => t.updated_at && new Date(t.updated_at).getTime() >= cutoff).sort((a, b) => new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime())
      return (<><div className="dnote">Estimativa: temas atualizados nas últimas 4 semanas. O banco não guarda histórico por etapa, então é aproximado.</div>
        {recent.length ? recent.map(t => (<div key={t.id} className="dli"><span className="tx">{t.tema_especifico}</span><span className="mt">{discById.get(t.disciplina_id)?.nome?.split(' ')[0]} · {A.doneCount(t as any)}/{A.N_STAGES} · {fmt(t.updated_at!)}</span></div>)) : <div className="empty">Nenhuma atualização recente.</div>}</>)
    }
    if (drill.type === 'gravacoes') {
      const done = gF.filter(g => g.status === 'concluida').sort((a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime())
      return done.length ? done.map(g => (<div key={g.id} className="dli"><span className="dot" style={{ background: '#16a34a' }} /><span className="tx">{(g as any).temas?.tema_especifico || discById.get(g.disciplina_id)?.nome}</span><span className="mt">{discById.get(g.disciplina_id)?.nome?.split(' ')[0]} · {fmt(g.data_hora)}</span></div>)) : <div className="empty">Nenhuma gravação concluída no período.</div>
    }
    if (drill.type === 'pendencias') return (<>
      <div className="dsec">Aguardando aprovação ({pend.propostas.length})</div>
      {pend.propostas.length ? pend.propostas.map(r => (<div key={r.id} className="dli"><span className="ic" style={{ background: '#fef3c7' }}>🕒</span><span className="tx">{discById.get(r.disciplina_id)?.nome}</span><span className="mt">{fmt(r.data_hora)}</span></div>)) : <div className="empty">Nenhuma.</div>}
      <div className="dsec">Canceladas a remarcar ({pend.canceladas.length})</div>
      {pend.canceladas.length ? pend.canceladas.map(r => (<div key={r.id} className="dli"><span className="ic" style={{ background: '#fee2e2' }}>⚠️</span><span className="tx">{discById.get(r.disciplina_id)?.nome}</span><span className="mt">{r.motivo_cancelamento || fmt(r.data_hora)}</span></div>)) : <div className="empty">Nenhuma.</div>}
    </>)
    if (drill.type === 'disc') {
      const ts = tF.filter(t => t.disciplina_id === drill.id)
      return ts.length ? ts.map(t => {
        const mat = [0, 1, 2, 3].filter(i => (t as any)[STG[i]] === 'concluido').length
        const vid = [4, 5, 6, 7, 8, 9, 10, 11].filter(i => (t as any)[STG[i]] === 'concluido').length
        const comp = [12, 13].filter(i => (t as any)[STG[i]] === 'concluido').length
        return (<div key={t.id} className="dli"><span className="tx">{t.tema_especifico}</span><span className="mt">Mat {mat}/4 · Víd {vid}/8 · Comp {comp}/2</span></div>)
      }) : <div className="empty">Sem temas.</div>
    }
    if (drill.type === 'stage') {
      const idx = STG.indexOf(drill.id)
      const items = tF.filter(t => { const v = (t as any)[drill.id]; const prev = idx === 0 || (t as any)[STG[idx - 1]] === 'concluido'; return v === 'em_andamento' || (prev && v === 'pendente') })
      return items.length ? items.map(t => { const v = (t as any)[drill.id]; return (<div key={t.id} className="dli"><span className="dot" style={{ background: v === 'em_andamento' ? '#d97706' : '#94a3b8' }} /><span className="tx">{t.tema_especifico}</span><span className="mt">{discById.get(t.disciplina_id)?.nome?.split(' ')[0]} · {v === 'em_andamento' ? 'em andamento' : 'na fila'}</span></div>) }) : <div className="empty">Nada nesta etapa.</div>
    }
    if (drill.type === 'prof') {
      const c = colaboradores.find(x => x.id === drill.id)
      const dids = (c?.professor_disciplinas?.map(d => d.disciplina_id) ?? []).filter(id => discById.has(id))
      return dids.length ? dids.map(id => { const dd = discById.get(id); const r = risk.find(x => x.id === id); return (<div key={id} className="drow"><span className="dl" style={{ display: 'flex', gap: 6, alignItems: 'center' }}><i style={{ width: 8, height: 8, borderRadius: 2, background: dd?.cor, display: 'inline-block' }} />{dd?.nome}</span><span className="dbar"><i style={{ width: (r?.pct || 0) + '%', background: dd?.cor }} /></span><span className="dv">{r?.pct || 0}%</span></div>) }) : <div className="empty">Sem disciplinas atribuídas.</div>
    }
    return null
  }

  return (
    <div className="cockpit">
      <style>{CSS}</style>

      <div className="hd">
        <h1>Painel do Gestor <span className="muted2">· {cycleConfig.label} · {discId ? discById.get(discId)?.nome : 'visão geral'}{profId ? ' · ' + profById.get(profId)?.nome : ''}</span></h1>
        <div className="flt">
          <select value={discId ?? 'all'} onChange={e => setDiscId(e.target.value === 'all' ? null : +e.target.value)}>
            <option value="all">Todas as disciplinas</option>
            {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
          </select>
          <select value={profId ?? 'all'} onChange={e => setProfId(e.target.value === 'all' ? null : e.target.value)}>
            <option value="all">Toda a equipe</option>
            {professores.map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </select>
          <span className={'statuspill ' + (proj.date ? (onTrack ? 'ok' : 'risk') : 'warn')}>{proj.date ? (onTrack ? '✓ No prazo' : '⚠ Em risco') : 'Sem ritmo'}</span>
        </div>
      </div>

      {loading ? <div className="loading">Carregando…</div> : <>
      <div className="kpis">
        {kpis.map(kp => (
          <div className="kpi clickable" key={kp.l} onClick={() => setDrill({ type: kp.type, title: kp.l })}>
            <div className="l">{kp.l} <Info t={kp.tip} /></div>
            <div className="v" style={{ color: kp.c }}>{kp.v}</div>
            <div className="s">{kp.s}</div>
          </div>
        ))}
      </div>

      <div className="grid">
        {/* Risco de prazo */}
        <div className="panel">
          <div className="ph"><b>🚩 Risco de prazo</b><span className={'cnt ' + (emRisco ? 'bad' : '')}>{emRisco} em risco</span></div>
          <div className="pb">
            {risk.map(r => (
              <div key={r.id} className={'rk click' + (r.onTrack === false ? ' bad' : '')} onClick={() => setDrill({ type: 'disc', id: r.id, title: r.nome })}>
                <span className="dot" style={{ background: r.cor }} />
                <span className="nm">{r.nome}</span>
                <span className="pc">{r.pct}%</span>
                <span className="dt" style={{ color: r.onTrack === false ? '#dc2626' : '#64748b' }}>{r.date ? fmt(r.date, { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}</span>
              </div>
            ))}
            {risk.length === 0 && <div className="empty">Sem dados.</div>}
          </div>
        </div>

        {/* Precisa de ação */}
        <div className="panel">
          <div className="ph"><b>📌 Precisa de ação</b></div>
          <div className="pb">
            <div className="sec">Aprovar gravação ({pend.propostas.length})</div>
            {pend.propostas.length ? pend.propostas.slice(0, 5).map(r => (
              <div key={r.id} className="pi"><span className="ic" style={{ background: '#fef3c7' }}>🕒</span><span className="tx">{discById.get(r.disciplina_id)?.nome}</span><span className="mt">{fmt(r.data_hora)}</span></div>
            )) : <div className="empty">Nenhuma.</div>}
            <div className="sec">Remarcar — canceladas ({pend.canceladas.length})</div>
            {pend.canceladas.length ? pend.canceladas.slice(0, 4).map(r => (
              <div key={r.id} className="pi"><span className="ic" style={{ background: '#fee2e2' }}>⚠️</span><span className="tx">{discById.get(r.disciplina_id)?.nome}</span><span className="mt">{fmt(r.data_hora)}</span></div>
            )) : <div className="empty">Nenhuma.</div>}
            <div className="sec">Prontas para gravar ({pend.prontasParaGravar.length})</div>
            {pend.prontasParaGravar.length ? pend.prontasParaGravar.slice(0, 5).map(t => (
              <div key={t.id} className="pi"><span className="ic" style={{ background: '#e0f2fe' }}>🎬</span><span className="tx">{t.tema_especifico}</span><span className="mt">{discById.get(t.disciplina_id)?.nome?.split(' ')[0]}</span></div>
            )) : <div className="empty">Nada na fila.</div>}
          </div>
        </div>

        {/* Gargalo + Produtividade */}
        <div className="col3">
          <div className="panel">
            <div className="ph"><b>🧱 Gargalo</b><span className="cnt">{bottle?.label}</span></div>
            <div className="pb">
              {gargalos.map(g => (
                <div key={g.stage} className={'gb click' + (g.i === fn.bottleneck ? ' hot' : '')} onClick={() => setDrill({ type: 'stage', id: g.stage, title: g.label })}>
                  <span className="lb">{g.label}</span>
                  <span className="tr"><i style={{ width: (g.concl / nF * 100) + '%' }} /></span>
                  <span className="vv">{g.wip ? <span style={{ color: '#d97706' }}>{g.wip}↻</span> : ''}{g.fila ? <span style={{ color: '#64748b' }}> {g.fila}⏳</span> : ''}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="panel">
            <div className="ph"><b>🏃 Produtividade</b><span className="cnt">4 sem</span></div>
            <div className="pb">
              {ppl.slice(0, 6).map(p => (
                <div key={p.id} className="pr click" onClick={() => setDrill({ type: 'prof', id: p.id, title: p.nome })}>
                  <span className="av" style={{ background: avColor(p.id) }}>{initials(p.nome)}</span>
                  <span className="nm">{p.nome.replace(/^(Dra?\.)\s*/, '')}</span>
                  <span className="pbar"><i style={{ width: Math.max(6, p.recentDone / mxL * 100) + '%' }} /></span>
                  <span className="rd">{p.recentDone}</span>
                </div>
              ))}
              {ppl.length === 0 && <div className="empty">Sem dados.</div>}
            </div>
          </div>
        </div>
      </div>
      </>}
      {drill && (
        <div className="dmodal" onClick={() => setDrill(null)}>
          <div className="dcard" onClick={e => e.stopPropagation()}>
            <div className="dch">
              <div><div className="dt">{drill.title}</div><div className="dsub">{drillSubtitle()}</div></div>
              <button onClick={() => setDrill(null)}>✕</button>
            </div>
            <div className="dbody">{drillBody()}</div>
          </div>
        </div>
      )}
    </div>
  )
}

const CSS = `
.cockpit{height:calc(100dvh - 64px);display:flex;flex-direction:column;gap:11px;padding:4px 24px 14px;overflow:hidden;color:#0f172a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.cockpit .hd{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;flex-shrink:0}
.cockpit h1{font-size:18px;font-weight:800;margin:0;letter-spacing:-.3px}
.cockpit .muted2{color:#94a3b8;font-weight:500;font-size:13px}
.cockpit .flt{display:flex;gap:8px;align-items:center}
.cockpit select{background:#fff;border:1px solid #e3e6ef;border-radius:9px;padding:6px 10px;font-size:12.5px;color:#0f172a;outline:none;cursor:pointer}
.cockpit select:hover{border-color:#c7b9f0}
.cockpit .statuspill{font-size:12px;font-weight:700;padding:6px 13px;border-radius:999px;white-space:nowrap}
.cockpit .statuspill.ok{background:#dcfce7;color:#15803d}
.cockpit .statuspill.risk{background:#fee2e2;color:#b91c1c}
.cockpit .statuspill.warn{background:#fef3c7;color:#b45309}
.cockpit .i{display:inline-flex;align-items:center;justify-content:center;width:13px;height:13px;border-radius:50%;border:1px solid #cbd5e1;color:#94a3b8;font-size:9px;font-weight:700;font-style:normal;cursor:help;vertical-align:middle}
.cockpit .kpis{display:grid;grid-template-columns:repeat(5,1fr);gap:10px;flex-shrink:0}
.cockpit .kpi{background:#fff;border:1px solid #e7e9f2;border-radius:12px;padding:9px 14px;box-shadow:0 1px 2px rgba(2,6,23,.04)}
.cockpit .kpi .l{font-size:10px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.4px;display:flex;align-items:center;gap:4px}
.cockpit .kpi .v{font-size:23px;font-weight:800;line-height:1.15;margin-top:2px}
.cockpit .kpi .s{font-size:10.5px;color:#94a3b8;margin-top:1px}
.cockpit .grid{flex:1;min-height:0;display:grid;grid-template-columns:1.15fr 1fr 1fr;gap:12px}
.cockpit .col3{display:flex;flex-direction:column;gap:12px;min-height:0}
.cockpit .panel{background:#fff;border:1px solid #e7e9f2;border-radius:14px;padding:11px 14px;display:flex;flex-direction:column;min-height:0;box-shadow:0 1px 2px rgba(2,6,23,.04);flex:1}
.cockpit .ph{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-shrink:0}
.cockpit .ph b{font-size:13px;font-weight:700}
.cockpit .cnt{font-size:11px;color:#64748b;font-weight:600}
.cockpit .cnt.bad{color:#dc2626}
.cockpit .pb{flex:1;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:5px}
.cockpit .pb::-webkit-scrollbar{width:6px}
.cockpit .pb::-webkit-scrollbar-thumb{background:#e2e8f0;border-radius:3px}
.cockpit .rk{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:9px}
.cockpit .rk.bad{background:#fef2f2}
.cockpit .rk .dot{width:9px;height:9px;border-radius:3px;flex-shrink:0}
.cockpit .rk .nm{flex:1;font-size:12.5px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cockpit .rk .pc{font-size:11px;color:#64748b;font-variant-numeric:tabular-nums}
.cockpit .rk .dt{font-size:11px;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.cockpit .sec{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#94a3b8;font-weight:700;margin:7px 0 3px}
.cockpit .sec:first-child{margin-top:0}
.cockpit .pi{display:flex;gap:8px;align-items:center;padding:5px 8px;border-radius:8px;background:#f7f8fc}
.cockpit .pi .ic{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
.cockpit .pi .tx{flex:1;font-size:12px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cockpit .pi .mt{font-size:10.5px;color:#94a3b8;white-space:nowrap}
.cockpit .gb{display:grid;grid-template-columns:92px 1fr 46px;gap:8px;align-items:center;padding:2px 0}
.cockpit .gb.hot .lb{color:#b91c1c;font-weight:700}
.cockpit .gb .lb{font-size:11.5px;color:#475569;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cockpit .gb .tr{height:13px;background:#eef1f6;border-radius:6px;position:relative;overflow:hidden}
.cockpit .gb .tr i{position:absolute;left:0;top:0;height:100%;border-radius:6px;background:#c4b5fd}
.cockpit .gb.hot .tr i{background:#fca5a5}
.cockpit .gb .vv{font-size:10.5px;font-weight:700;text-align:right;white-space:nowrap}
.cockpit .pr{display:flex;align-items:center;gap:8px}
.cockpit .pr .av{width:24px;height:24px;border-radius:7px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;flex-shrink:0}
.cockpit .pr .nm{flex:1;font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cockpit .pr .pbar{width:70px;height:6px;background:#eef1f6;border-radius:4px;overflow:hidden;flex-shrink:0}
.cockpit .pr .pbar i{display:block;height:100%;background:#16a34a;border-radius:4px}
.cockpit .pr .rd{font-size:11.5px;font-weight:700;color:#0f172a;width:22px;text-align:right;font-variant-numeric:tabular-nums}
.cockpit .empty{color:#94a3b8;font-size:11.5px;padding:6px 2px}
.cockpit .loading{flex:1;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:13px}
.cockpit .clickable{cursor:pointer;transition:border-color .15s,box-shadow .15s}
.cockpit .clickable:hover{border-color:#c7b9f0;box-shadow:0 3px 10px rgba(124,58,237,.12)}
.cockpit .rk.click,.cockpit .gb.click,.cockpit .pr.click{cursor:pointer;border-radius:9px}
.cockpit .rk.click:hover,.cockpit .pr.click:hover{background:#f1f0fb}
.cockpit .gb.click:hover .lb{color:#7c3aed;text-decoration:underline}
.dmodal{position:fixed;inset:0;background:rgba(15,23,42,.45);display:flex;align-items:center;justify-content:center;z-index:200;padding:24px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif}
.dcard{background:#fff;border-radius:16px;width:100%;max-width:600px;max-height:82vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(2,6,23,.32);overflow:hidden}
.dch{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;padding:18px 20px;border-bottom:1px solid #eef1f6;flex-shrink:0}
.dch .dt{font-size:16px;font-weight:800;color:#0f172a}
.dch .dsub{font-size:12px;color:#64748b;margin-top:2px}
.dch button{background:#f1f5f9;border:none;border-radius:8px;width:30px;height:30px;cursor:pointer;color:#64748b;font-size:14px;flex-shrink:0}
.dch button:hover{background:#e2e8f0}
.dbody{padding:14px 20px 20px;overflow:auto}
.dbody .dsec{font-size:10.5px;text-transform:uppercase;letter-spacing:.4px;color:#94a3b8;font-weight:700;margin:14px 0 6px}
.dbody .dsec:first-child{margin-top:0}
.dnote{font-size:11.5px;color:#64748b;background:#f8fafc;border:1px solid #eef1f6;border-radius:8px;padding:8px 10px;margin-bottom:12px}
.drow{display:grid;grid-template-columns:1fr 120px 50px;gap:10px;align-items:center;padding:4px 0;font-size:12.5px}
.drow .dl{color:#334155;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.drow .dbar{height:8px;background:#eef1f6;border-radius:5px;overflow:hidden}
.drow .dbar i{display:block;height:100%;border-radius:5px}
.drow .dv{font-size:11.5px;font-weight:700;text-align:right;color:#0f172a;font-variant-numeric:tabular-nums}
.drow2{display:flex;gap:12px;align-items:center;padding:6px 0;border-bottom:1px solid #f1f5f9;font-size:12px}
.drow2 .mt{color:#64748b;font-variant-numeric:tabular-nums;white-space:nowrap}
.dli{display:flex;gap:9px;align-items:center;padding:6px 9px;border-radius:8px;background:#f8fafc;margin-bottom:4px}
.dli .ic{width:22px;height:22px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0}
.dli .dot{width:8px;height:8px;border-radius:2px;flex-shrink:0}
.dli .tx{flex:1;font-size:12.5px;color:#0f172a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dli .mt{font-size:11px;color:#94a3b8;white-space:nowrap}
@media(max-width:1100px){.cockpit{height:auto;overflow:visible}.cockpit .grid{grid-template-columns:1fr}.cockpit .kpis{grid-template-columns:repeat(2,1fr)}}
`
