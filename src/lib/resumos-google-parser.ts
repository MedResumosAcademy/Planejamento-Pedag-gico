/** Pure, fail-closed parser for the four read-only Google Sheets value ranges. */
export type CicloResumo = 'basico' | 'clinico'
export type SheetValues = Array<Array<string | number | boolean | null>>

export interface ResumoDisciplina {
  nome: string
  temas: number
  prontos: number
  faltando: number
}

export interface ResumoCiclo {
  temas: number
  prontos: number
  faltando: number
  disciplines: ResumoDisciplina[]
}

export interface ResumoInventory {
  source_read_at: Record<CicloResumo, string>
  excluded_rows: number
  cycles: Record<CicloResumo, ResumoCiclo>
}

export const RESUMOS_SHEET_ID = '1Dh-XqkR5SmoVd5LQvJacffQnKkpBn-4JpQumH_N_2LM'
export const RESUMOS_SHEET_URL = `https://docs.google.com/spreadsheets/d/${RESUMOS_SHEET_ID}/edit`
export const RESUMOS_SHEET_TABS = ['Resumo', 'Temas', 'Por disciplina', 'Para o time atualizar'] as const

const CYCLES = new Map<string, CicloResumo>([['Ciclo Básico', 'basico'], ['Ciclo Clínico', 'clinico']])
const READY = new Set(['Pronto — Dayana', 'Pronto — Dayana (sem Word na pasta do time)', 'Pronto — esteira'])
const PENDING = new Set(['Word mudou depois do PDF', 'Atualizado, falta diagramar', 'Aguardando conteúdo completo', 'Word só com o cabeçalho', 'Não atualizado'])
const ELIGIBLE = new Set(['sim', 'não é tema', 'outro word do mesmo tema'])
const DRIVE_LINK = /^https:\/\/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]{10,})\/view(?:\?.*)?$/
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/
const TEMAS_HEADERS = ['Ciclo', 'Disciplina', 'Nº', 'Word (pasta do time)', 'Conta como tema', 'Situação', 'O que fazer', 'Word editado em', 'PDF da Dayana', 'PDF oficial', 'Link do PDF', 'Link do Word']
const FIELDS = ['temas', 'prontos', 'faltando'] as const

function requireValue(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

function value(row: SheetValues[number] | undefined, index: number): string | number | boolean | null {
  return row?.[index] ?? null
}

function text(row: SheetValues[number] | undefined, index: number): string {
  const cell = value(row, index)
  return typeof cell === 'string' ? cell : ''
}

function count(row: SheetValues[number] | undefined, index: number, label: string): number {
  const cell = value(row, index)
  const numeric = typeof cell === 'number' ? cell : typeof cell === 'string' && /^\d+$/.test(cell) ? Number(cell) : NaN
  requireValue(Number.isSafeInteger(numeric) && numeric >= 0, `${label}: contagem inválida`)
  return numeric
}

function discipline(raw: unknown, label: string): string {
  requireValue(typeof raw === 'string' && raw.trim(), `${label}: disciplina inválida`)
  const normalized = raw.normalize('NFC').trim()
  requireValue(raw === normalized, `${label}: disciplina com espaços ou Unicode não canônico`)
  return normalized
}

function readAt(raw: unknown, label: string): string {
  requireValue(typeof raw === 'string', `${label}: data ausente`)
  const match = DATE_TIME.exec(raw)
  requireValue(match, `${label}: data inválida`)
  const [, year, month, day, hour, minute] = match
  const date = new Date(Date.UTC(+year, +month - 1, +day, +hour, +minute))
  requireValue(date.getUTCFullYear() === +year && date.getUTCMonth() + 1 === +month &&
    date.getUTCDate() === +day && date.getUTCHours() === +hour && date.getUTCMinutes() === +minute,
  `${label}: data inválida`)
  return raw
}

function driveId(raw: unknown, label: string): string | null {
  if (raw == null || raw === '') return null
  requireValue(typeof raw === 'string', `${label}: link inválido`)
  const match = DRIVE_LINK.exec(raw)
  requireValue(match, `${label}: link inválido`)
  return match[1]
}

function nonempty(row: SheetValues[number] | undefined): boolean {
  return Boolean(row?.some(cell => cell !== null && cell !== ''))
}

function headers(row: SheetValues[number] | undefined, expected: string[], label: string): void {
  requireValue(expected.every((header, index) => text(row, index) === header), `${label}: cabeçalho mudou`)
}

function key(...parts: string[]): string { return parts.join('\u0000') }

export function parseResumosGoogleValues(ranges: {
  resumo: SheetValues
  temas: SheetValues
  porDisciplina: SheetValues
  paraAtualizar: SheetValues
}): ResumoInventory {
  const { resumo, temas, porDisciplina, paraAtualizar } = ranges
  headers(resumo[0], ['', 'Ciclo Básico', 'Ciclo Clínico', 'Total'], 'Resumo')
  for (const [index, label] of Array.from(['Temas', 'Prontos', 'Faltando'].entries())) {
    requireValue(text(resumo[index + 1], 0) === label, `Resumo!A${index + 2}: linha mudou`)
  }
  requireValue(text(resumo[15], 0) === 'Lido do Drive em', 'Resumo!A16: rótulo mudou')
  const source_read_at = {
    basico: readAt(value(resumo[15], 1), 'Resumo!B16'),
    clinico: readAt(value(resumo[15], 2), 'Resumo!C16'),
  }

  headers(temas[0], TEMAS_HEADERS, 'Temas')
  const cycles: ResumoInventory['cycles'] = {
    basico: { temas: 0, prontos: 0, faltando: 0, disciplines: [] },
    clinico: { temas: 0, prontos: 0, faltando: 0, disciplines: [] },
  }
  const disciplines = new Map<string, ResumoDisciplina>()
  const pending = new Map<string, number>()
  const allDriveIds = new Set<string>()
  let excluded_rows = 0

  for (const [index, row] of Array.from(temas.entries())) {
    if (index === 0 || !nonempty(row)) continue
    const label = `Temas!${index + 1}`
    const cycle = CYCLES.get(text(row, 0))
    requireValue(cycle, `${label}: ciclo inválido`)
    const name = discipline(value(row, 1), label)
    const eligible = text(row, 4).trim().toLocaleLowerCase('pt-BR')
    requireValue(ELIGIBLE.has(eligible), `${label}: regra de contagem desconhecida`)
    if (eligible !== 'sim') { excluded_rows++; continue }
    const status = text(row, 5)
    requireValue(READY.has(status) || PENDING.has(status), `${label}: situação desconhecida`)
    const pdfId = driveId(value(row, 10), `${label}: PDF`)
    const wordId = driveId(value(row, 11), `${label}: Word`)
    requireValue(wordId || pdfId, `${label}: ID do Drive ausente`)
    requireValue(!READY.has(status) || pdfId, `${label}: PDF pronto sem link`)
    for (const id of [pdfId, wordId]) {
      if (!id) continue
      requireValue(!allDriveIds.has(id), `${label}: arquivo do Drive duplicado`)
      allDriveIds.add(id)
    }
    const category = READY.has(status) ? 'prontos' : 'faltando'
    cycles[cycle].temas++
    cycles[cycle][category]++
    const disciplineKey = key(cycle, name)
    const current = disciplines.get(disciplineKey) ?? { nome: name, temas: 0, prontos: 0, faltando: 0 }
    current.temas++
    current[category]++
    disciplines.set(disciplineKey, current)
    if (category === 'faltando') {
      const pendingKey = key(cycle, name, status)
      pending.set(pendingKey, (pending.get(pendingKey) ?? 0) + 1)
    }
  }

  headers(porDisciplina[0], ['Ciclo', 'Disciplina', 'Temas', 'Prontos', 'Faltando'], 'Por disciplina')
  const seen = new Set<string>()
  for (const [index, row] of Array.from(porDisciplina.entries())) {
    if (index === 0 || !nonempty(row)) continue
    const label = `Por disciplina!${index + 1}`
    const cycle = CYCLES.get(text(row, 0))
    requireValue(cycle, `${label}: ciclo inválido`)
    const name = discipline(value(row, 1), label)
    const disciplineKey = key(cycle, name)
    requireValue(!seen.has(disciplineKey), `${label}: disciplina duplicada`)
    const expected = disciplines.get(disciplineKey)
    requireValue(expected, `${label}: disciplina ausente em Temas`)
    requireValue(count(row, 2, label) === expected.temas && count(row, 3, label) === expected.prontos &&
      count(row, 4, label) === expected.faltando, `${label}: contagem não confere`)
    seen.add(disciplineKey)
  }
  requireValue(seen.size === disciplines.size, 'Por disciplina: faltam disciplinas')

  for (const [cycle, column] of [['basico', 1], ['clinico', 2]] as const) {
    const data = cycles[cycle]
    for (const [index, field] of Array.from(FIELDS.entries())) {
      requireValue(count(resumo[index + 1], column, `Resumo!${index + 2}`) === data[field],
        `Resumo: ${cycle} não confere com Temas`)
    }
  }
  for (const [index, field] of Array.from(FIELDS.entries())) {
    requireValue(count(resumo[index + 1], 3, `Resumo!D${index + 2}`) ===
      cycles.basico[field] + cycles.clinico[field], 'Resumo: total dos ciclos não confere')
  }

  headers(paraAtualizar[0], ['Ciclo', 'Disciplina', 'Nº', 'Resumo', 'Situação'], 'Para o time atualizar')
  const listedPending = new Map<string, number>()
  for (const [index, row] of Array.from(paraAtualizar.entries())) {
    if (index === 0 || !nonempty(row)) continue
    const label = `Para o time atualizar!${index + 1}`
    const cycle = CYCLES.get(text(row, 0))
    requireValue(cycle, `${label}: ciclo inválido`)
    const name = discipline(value(row, 1), label)
    const status = text(row, 4)
    requireValue(PENDING.has(status), `${label}: situação desconhecida`)
    const pendingKey = key(cycle, name, status)
    listedPending.set(pendingKey, (listedPending.get(pendingKey) ?? 0) + 1)
  }
  requireValue(listedPending.size === pending.size && Array.from(pending.entries()).every(([pendingKey, total]) => listedPending.get(pendingKey) === total),
    'Para o time atualizar: lista não confere com pendências')

  for (const cycle of ['basico', 'clinico'] as const) {
    cycles[cycle].disciplines = Array.from(disciplines.entries())
      .filter(([disciplineKey]) => disciplineKey.startsWith(`${cycle}\u0000`))
      .map(([, data]) => data)
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  }
  return { source_read_at, excluded_rows, cycles }
}
