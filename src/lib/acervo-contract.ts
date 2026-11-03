// Metadata only: never accept question text, answers, personal decks or raw metadata.
export const ACERVO_CATEGORIES = ['resumos', 'videoaulas', 'questoes', 'flashcards'] as const
export const ACERVO_STAGES = ['generated', 'reviewed', 'approved', 'published'] as const
export type AcervoCategory = typeof ACERVO_CATEGORIES[number]
export type AcervoStage = typeof ACERVO_STAGES[number]
export type AcervoFacts = Record<AcervoStage, number | null>
export interface AcervoItem {
  entity: string
  external_id: string
  category: AcervoCategory
  kind: 'content' | 'batch'
  cycle: 'basico' | 'clinico' | null
  label: string
  taxonomy_label: string | null
  native_status: string | null
  facts: AcervoFacts
  updated_at: string
}
export interface AcervoSnapshot {
  version: 1
  source: 'mra_academy' | 'question_factory' | 'flashcard_factory'
  environment: 'staging' | 'production'
  instance: string
  observed_at: string
  scope: 'shared_catalog'
  items: AcervoItem[]
}
export interface AcervoStored extends AcervoItem {
  id: string
  source: AcervoSnapshot['source']
  environment: AcervoSnapshot['environment']
  instance: string
  observed_at: string
  synced_at: string
  tema_id: number | null
}

export const ACERVO_STAGE_LABELS: Record<AcervoStage, string> = {
  generated: 'Gerados', reviewed: 'Revisão informada', approved: 'Aprovados', published: 'Publicados',
}
export const MAX_SNAPSHOT_BYTES = 2_000_000

function obj(value: unknown, keys: string[], where: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${where}: objeto inválido.`)
  const result = value as Record<string, unknown>
  if (Object.keys(result).some(key => !keys.includes(key))) throw new Error(`${where}: campo não permitido. Envie apenas metadados do contrato.`)
  return result
}
function str(value: unknown, max: number, where: string): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\u0000-\u001f]/.test(value)) throw new Error(`${where}: texto inválido.`)
  return value.trim()
}
function nullableStr(value: unknown, max: number, where: string) { return value === null ? null : str(value, max, where) }
function date(value: unknown, where: string, now: number): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error(`${where}: data ISO com fuso obrigatória.`)
  if (Date.parse(value) > now + 300_000) throw new Error(`${where}: data no futuro.`)
  return new Date(value).toISOString()
}
export function itemKey(item: Pick<AcervoItem, 'entity' | 'external_id'>) { return JSON.stringify([item.entity, item.external_id]) }
export function parseSnapshot(value: unknown, now = Date.now()): AcervoSnapshot {
  const v = obj(value, ['version', 'source', 'environment', 'instance', 'observed_at', 'scope', 'items'], 'Arquivo')
  if (v.version !== 1 || v.scope !== 'shared_catalog') throw new Error('Exigido contrato v1 e escopo shared_catalog; conteúdo pessoal não é permitido.')
  if (!['mra_academy', 'question_factory', 'flashcard_factory'].includes(String(v.source))) throw new Error('Origem inválida.')
  if (!['staging', 'production'].includes(String(v.environment))) throw new Error('Ambiente inválido.')
  const instance = str(v.instance, 100, 'Instância')
  if (!/^[a-zA-Z0-9_.-]+$/.test(instance)) throw new Error('Instância deve ser um identificador estável, não uma URL ou credencial.')
  if (!Array.isArray(v.items) || v.items.length < 1 || v.items.length > 2000) throw new Error('Envie entre 1 e 2.000 registros por prévia.')
  const observed_at = date(v.observed_at, 'Coleta', now)
  const seen = new Set<string>()
  const items = v.items.map((raw, index): AcervoItem => {
    const at = `Registro ${index + 1}`
    const i = obj(raw, ['entity', 'external_id', 'category', 'kind', 'cycle', 'label', 'taxonomy_label', 'native_status', 'facts', 'updated_at'], at)
    const entity = str(i.entity, 80, at)
    if (!/^[a-z][a-z0-9_]*$/.test(entity)) throw new Error(`${at}: entidade inválida.`)
    const external_id = str(i.external_id, 160, at)
    if (!ACERVO_CATEGORIES.includes(i.category as AcervoCategory)) throw new Error(`${at}: categoria inválida.`)
    if (i.kind !== 'content' && i.kind !== 'batch') throw new Error(`${at}: tipo inválido.`)
    if (i.kind === 'batch' && !['questoes', 'flashcards'].includes(String(i.category))) throw new Error(`${at}: lote só pode ser de questões ou flashcards.`)
    if (v.source === 'question_factory' && i.category !== 'questoes') throw new Error(`${at}: categoria incompatível com fábrica de questões.`)
    if (v.source === 'flashcard_factory' && i.category !== 'flashcards') throw new Error(`${at}: categoria incompatível com fábrica de flashcards.`)
    if (i.cycle !== null && i.cycle !== 'basico' && i.cycle !== 'clinico') throw new Error(`${at}: ciclo inválido.`)
    const f = obj(i.facts, [...ACERVO_STAGES], at)
    const facts = {} as AcervoFacts
    for (const stage of ACERVO_STAGES) {
      const n = f[stage]
      if (n !== null && (typeof n !== 'number' || !Number.isSafeInteger(n) || n < 0 || n > (i.kind === 'content' ? 1 : 1_000_000))) throw new Error(`${at}: contagem inválida em ${stage}; use null quando desconhecida.`)
      facts[stage] = n as number | null
    }
    const updated_at = date(i.updated_at, at, now)
    if (updated_at > observed_at) throw new Error(`${at}: atualização posterior à coleta.`)
    const item: AcervoItem = { entity, external_id, category: i.category as AcervoCategory, kind: i.kind, cycle: i.cycle,
      label: str(i.label, 180, at), taxonomy_label: nullableStr(i.taxonomy_label, 240, at),
      native_status: nullableStr(i.native_status, 80, at), facts, updated_at }
    const key = itemKey(item)
    if (seen.has(key)) throw new Error(`${at}: ID repetido na mesma entidade.`)
    seen.add(key)
    return item
  })
  return { version: 1, source: v.source as AcervoSnapshot['source'], environment: v.environment as AcervoSnapshot['environment'], instance, observed_at, scope: 'shared_catalog', items }
}

export function summarizeAcervo(items: AcervoItem[], category: AcervoCategory) {
  const content = items.filter(item => item.category === category && item.kind === 'content')
  const batches = items.filter(item => item.category === category && item.kind === 'batch')
  return { total: content.length, batches: batches.length,
    stages: Object.fromEntries(ACERVO_STAGES.map(stage => [stage, {
      count: content.reduce((sum, item) => sum + (item.facts[stage] ?? 0), 0),
      unknown: content.filter(item => item.facts[stage] === null).length,
    }])) as Record<AcervoStage, { count: number; unknown: number }>,
  }
}
