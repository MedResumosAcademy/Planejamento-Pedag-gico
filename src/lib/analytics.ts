// Pure, framework-free analytics for the management dashboard (/gerencial).
// No Supabase / React imports — fully unit-testable against any dataset.
//
// IMPORTANT (real data): there is no per-stage history in the DB, so velocity &
// projection are ESTIMATES derived from `temas.updated_at`. They are labeled as
// such in the UI. A future `tema_eventos` log would make them exact.

// Pipeline REAL do banco: 4 etapas de material + 8 de vídeo + 3 complementares = 15.
export const STAGES = [
  'mat_atualizado', 'mat_revisado', 'mat_diagramado', 'mat_conferencia',
  'vid_envio_tema', 'vid_slide_pronto', 'vid_diagramacao', 'vid_aprovacao_slide',
  'vid_agendamento', 'vid_gravacao_feita', 'vid_aprovacao_aula', 'vid_publicada',
  'comp_simulado', 'comp_questoes', 'comp_flashcards',
] as const

export const STAGE_LABELS = [
  'Atualizado', 'Revisado', 'Diagramado', 'Conferência',
  'Enviar tema', 'Slide pronto', 'Diagramação', 'Aprovação slide',
  'Agendar aula', 'Gravação', 'Aprovação aula', 'No sistema',
  'Simulado', 'Questões', 'Flashcards',
]

export const STAGE_GROUP = [
  'Material', 'Material', 'Material', 'Material',
  'Vídeo', 'Vídeo', 'Vídeo', 'Vídeo',
  'Vídeo', 'Vídeo', 'Vídeo', 'Vídeo',
  'Complementar', 'Complementar', 'Complementar',
]

export const N_STAGES = STAGES.length

// ---- Structural input types (compatible with the app's @/types) ----
export interface TemaLike {
  id: number
  disciplina_id: number
  ordem?: number
  tema_especifico?: string
  paginas?: number | null
  status_geral?: string
  updated_at?: string
  [k: string]: any // stage status fields accessed dynamically
}
export interface DiscLike { id: number; nome: string; cor: string; microassunto?: string | null; total_paginas?: number }
export interface GravLike {
  id: number; professor_id?: string; disciplina_id: number; tema_id?: number
  data_hora: string; duracao_minutos?: number; status: string
  gravada?: boolean; cancelada?: boolean; motivo_cancelamento?: string | null
}
export interface ColabLike {
  id: string; nome: string; nivel: string
  professor_disciplinas?: { disciplina_id: number }[]
}

export interface Filter { discId?: number | null; profId?: string | null }

// ---- Helpers ----
export const doneCount = (t: TemaLike) => STAGES.reduce((a, s) => a + (t[s] === 'concluido' ? 1 : 0), 0)
export const wipCount = (t: TemaLike) => STAGES.reduce((a, s) => a + (t[s] === 'em_andamento' ? 1 : 0), 0)

const DAY = 86400000
const toDate = (d: string | Date) => (d instanceof Date ? d : new Date(d))
function profDiscIds(colabs: ColabLike[], profId: string): number[] {
  const c = colabs.find(x => x.id === profId)
  return c?.professor_disciplinas?.map(d => d.disciplina_id) ?? []
}

export function filterTemas(temas: TemaLike[], colabs: ColabLike[], f: Filter): TemaLike[] {
  let ids: Set<number> | null = null
  if (f.profId) ids = new Set(profDiscIds(colabs, f.profId))
  return temas.filter(t =>
    (f.discId == null || t.disciplina_id === f.discId) &&
    (ids == null || ids.has(t.disciplina_id))
  )
}
export function filterGravs(gravs: GravLike[], colabs: ColabLike[], f: Filter): GravLike[] {
  let ids: Set<number> | null = null
  if (f.profId) ids = new Set(profDiscIds(colabs, f.profId))
  return gravs.filter(g =>
    (f.discId == null || g.disciplina_id === f.discId) &&
    (f.profId == null ? true : (g.professor_id === f.profId || (ids != null && ids.has(g.disciplina_id))))
  )
}

// Velocity ESTIMATE: stages on temas touched within `weeks` window, per week.
export function velocityEstimate(temas: TemaLike[], today: string | Date, weeks = 4): number {
  const cutoff = toDate(today).getTime() - weeks * 7 * DAY
  let recent = 0
  for (const t of temas) {
    if (t.updated_at && toDate(t.updated_at).getTime() >= cutoff) recent += doneCount(t)
  }
  return recent / weeks
}

export interface Projection { date: string | null; onTrack: boolean | null; velocity: number; remaining: number; weeksLeft: number | null }
export function projection(temas: TemaLike[], today: string | Date, target: string | Date, weeks = 4): Projection {
  const total = temas.length * N_STAGES
  const done = temas.reduce((a, t) => a + doneCount(t), 0)
  const remaining = total - done
  const v = velocityEstimate(temas, today, weeks)
  if (temas.length === 0 || v <= 0 || remaining <= 0) {
    return { date: remaining <= 0 && temas.length > 0 ? toDate(today).toISOString() : null, onTrack: remaining <= 0 ? true : null, velocity: v, remaining, weeksLeft: remaining <= 0 ? 0 : null }
  }
  const weeksLeft = remaining / v
  const date = new Date(toDate(today).getTime() + weeksLeft * 7 * DAY)
  return { date: date.toISOString(), onTrack: date <= toDate(target), velocity: v, remaining, weeksLeft }
}

export interface Kpis {
  totalTemas: number; totalStages: number; doneStages: number; progressoPct: number
  temasConcluidos: number; velocity: number; projection: Projection
  gravFeitas: number; gravAgendadas: number; pendencias: number
}
export function kpis(temas: TemaLike[], gravs: GravLike[], today: string | Date, target: string | Date): Kpis {
  const totalStages = temas.length * N_STAGES
  const doneStages = temas.reduce((a, t) => a + doneCount(t), 0)
  const temasConcluidos = temas.filter(t => t.status_geral === 'concluido' || doneCount(t) === N_STAGES).length
  const proj = projection(temas, today, target)
  return {
    totalTemas: temas.length, totalStages, doneStages,
    progressoPct: totalStages ? Math.round(doneStages * 100 / totalStages) : 0,
    temasConcluidos, velocity: proj.velocity, projection: proj,
    gravFeitas: gravs.filter(g => g.status === 'concluida').length,
    gravAgendadas: gravs.filter(g => g.status === 'aprovada').length,
    pendencias: gravs.filter(g => g.status === 'proposta' || g.status === 'cancelada').length,
  }
}

export interface FunnelRow { stage: string; label: string; group: string; concl: number; wip: number; fila: number }
export function funnel(temas: TemaLike[]): { rows: FunnelRow[]; bottleneck: number } {
  const rows = STAGES.map((s, i) => {
    let concl = 0, wip = 0, fila = 0
    for (const t of temas) {
      const v = t[s]
      if (v === 'concluido') concl++
      else if (v === 'em_andamento') wip++
      else if ((i === 0 || t[STAGES[i - 1]] === 'concluido')) fila++
    }
    return { stage: s, label: STAGE_LABELS[i], group: STAGE_GROUP[i], concl, wip, fila }
  })
  let bottleneck = 0, mx = -1
  rows.forEach((r, i) => { if (r.wip > mx) { mx = r.wip; bottleneck = i } })
  return { rows, bottleneck }
}

export interface PersonRow {
  id: string; nome: string; nDisc: number; nTemas: number; pct: number
  recentDone: number; wip: number; grav: number; discNomes: string[]
}
export function people(colabs: ColabLike[], temas: TemaLike[], gravs: GravLike[], discs: DiscLike[], today: string | Date, f: Filter): PersonRow[] {
  const discName = new Map(discs.map(d => [d.id, d.nome]))
  const cutoff = toDate(today).getTime() - 4 * 7 * DAY
  const profs = colabs.filter(c => c.nivel === 'professor' && (!f.profId || c.id === f.profId))
  const rows: PersonRow[] = profs.map(p => {
    let dids = (p.professor_disciplinas?.map(d => d.disciplina_id) ?? [])
    if (f.discId != null) dids = dids.filter(id => id === f.discId)
    const ts = temas.filter(t => dids.includes(t.disciplina_id))
    const total = ts.length * N_STAGES
    const done = ts.reduce((a, t) => a + doneCount(t), 0)
    const recentDone = ts.reduce((a, t) => a + (t.updated_at && toDate(t.updated_at).getTime() >= cutoff ? doneCount(t) : 0), 0)
    const wip = ts.reduce((a, t) => a + wipCount(t), 0)
    const grav = gravs.filter(g => g.professor_id === p.id && g.status === 'concluida').length
    return {
      id: p.id, nome: p.nome, nDisc: dids.length, nTemas: ts.length,
      pct: total ? Math.round(done * 100 / total) : 0, recentDone, wip, grav,
      discNomes: dids.map(id => (discName.get(id) || '').split(' ')[0]).filter(Boolean),
    }
  }).filter(r => r.nTemas > 0)
  rows.sort((a, b) => b.recentDone - a.recentDone || b.pct - a.pct)
  return rows
}

export interface RiskRow { id: number; nome: string; cor: string; nTemas: number; pct: number; velocity: number; date: string | null; onTrack: boolean | null }
export function riskByDiscipline(discs: DiscLike[], temas: TemaLike[], today: string | Date, target: string | Date, f: Filter): RiskRow[] {
  const rows = discs.filter(d => f.discId == null || d.id === f.discId).map(d => {
    const ts = temas.filter(t => t.disciplina_id === d.id)
    if (!ts.length) return null
    const total = ts.length * N_STAGES
    const done = ts.reduce((a, t) => a + doneCount(t), 0)
    const proj = projection(ts, today, target)
    return { id: d.id, nome: d.nome, cor: d.cor, nTemas: ts.length, pct: Math.round(done * 100 / total), velocity: proj.velocity, date: proj.date, onTrack: proj.onTrack }
  }).filter(Boolean) as RiskRow[]
  rows.sort((a, b) => {
    const ao = a.onTrack === false ? 0 : a.onTrack === null ? 1 : 2
    const bo = b.onTrack === false ? 0 : b.onTrack === null ? 1 : 2
    if (ao !== bo) return ao - bo
    const ad = a.date ? toDate(a.date).getTime() : 0
    const bd = b.date ? toDate(b.date).getTime() : 0
    return bd - ad
  })
  return rows
}

// Weekly buckets (Mondays) ending at the Monday of `today`.
export function weekStarts(today: string | Date, nWeeks = 12): string[] {
  const d = toDate(today)
  const monday = new Date(d.getTime() - ((d.getDay() + 6) % 7) * DAY)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: nWeeks }, (_, i) => new Date(monday.getTime() - (nWeeks - 1 - i) * 7 * DAY).toISOString().slice(0, 10))
}
export function recordingThroughput(gravs: GravLike[], weeks: string[]): number[] {
  const first = new Date(weeks[0] + 'T00:00:00').getTime()
  const out = Array(weeks.length).fill(0)
  for (const g of gravs) {
    if (g.status !== 'concluida') continue
    const wi = Math.floor((new Date(g.data_hora).getTime() - first) / (7 * DAY))
    if (wi >= 0 && wi < weeks.length) out[wi]++
  }
  return out
}

export interface Pendencias { propostas: GravLike[]; canceladas: GravLike[]; prontasParaGravar: TemaLike[] }
export function pendencias(gravs: GravLike[], temas: TemaLike[]): Pendencias {
  const open = new Set(gravs.filter(g => g.status === 'aprovada' || g.status === 'proposta').map(g => g.tema_id))
  return {
    propostas: gravs.filter(g => g.status === 'proposta'),
    canceladas: gravs.filter(g => g.status === 'cancelada'),
    prontasParaGravar: temas.filter(t => t.vid_aprovacao_slide === 'concluido' && t.vid_gravacao_feita === 'pendente' && !open.has(t.id)),
  }
}
