// One editorial delivery per topic and category. Counts are not inventory totals.
export const CONTENT_CATEGORY_KEYS = ['resumos', 'videoaulas', 'questoes', 'flashcards'] as const
export type ContentCategory = typeof CONTENT_CATEGORY_KEYS[number]
export type CategoryStatus = 'pendente' | 'em_andamento' | 'concluido'

export const CONTENT_CATEGORIES = {
  resumos: { label: 'Resumos', unit: 'entregas de resumo planejadas por tema', color: '#15803d', stages: [
    { key: 'mat_atualizado', label: 'Atualizado' }, { key: 'mat_revisado', label: 'Revisado' },
    { key: 'mat_diagramado', label: 'Diagramado' }, { key: 'mat_conferencia', label: 'Conferência' },
  ] },
  videoaulas: { label: 'Videoaulas', unit: 'entregas de videoaula planejadas por tema', color: '#2563eb', stages: [
    { key: 'vid_envio_tema', label: 'Enviar tema' }, { key: 'vid_slide_pronto', label: 'Slide pronto' },
    { key: 'vid_diagramacao', label: 'Diagramação' }, { key: 'vid_aprovacao_slide', label: 'Aprovação slide' },
    { key: 'vid_agendamento', label: 'Agendamento' }, { key: 'vid_gravacao_feita', label: 'Gravação' },
    { key: 'vid_aprovacao_aula', label: 'Aprovação aula' }, { key: 'vid_publicada', label: 'Publicada' },
  ] },
  questoes: { label: 'Questões', unit: 'temas com questões', color: '#92400e', stages: [
    { key: 'comp_questoes', label: 'Questões' },
  ] },
  flashcards: { label: 'Flashcards', unit: 'temas com flashcards', color: '#7c3aed', stages: [
    { key: 'comp_flashcards', label: 'Flashcards' },
  ] },
} as const

export type ContentStage = typeof CONTENT_CATEGORIES[ContentCategory]['stages'][number]['key']
export type CategoryTopic = Partial<Record<ContentStage, string | null>>

export function parseContentCategory(value: string | null | undefined): ContentCategory | null {
  return CONTENT_CATEGORY_KEYS.includes(value as ContentCategory) ? value as ContentCategory : null
}
export function categoryStages(category: ContentCategory): ContentStage[] {
  return CONTENT_CATEGORIES[category].stages.map(stage => stage.key)
}
export function categoryProgress(topic: CategoryTopic, category: ContentCategory) {
  const stages = categoryStages(category)
  const done = stages.filter(stage => topic[stage] === 'concluido').length
  const started = stages.some(stage => topic[stage] === 'concluido' || topic[stage] === 'em_andamento')
  const status: CategoryStatus = done === stages.length ? 'concluido' : started ? 'em_andamento' : 'pendente'
  return { done, total: stages.length, percent: Math.round(done * 100 / stages.length), status }
}
export function categoryStatus(topic: CategoryTopic, category: ContentCategory): CategoryStatus {
  return categoryProgress(topic, category).status
}
export function categorySummary(topics: CategoryTopic[], category: ContentCategory) {
  const progress = topics.map(topic => categoryProgress(topic, category))
  const etapas_concluidas = progress.reduce((sum, p) => sum + p.done, 0)
  const total_etapas = topics.length * categoryStages(category).length
  return {
    total_temas: topics.length,
    concluidos: progress.filter(p => p.status === 'concluido').length,
    em_andamento: progress.filter(p => p.status === 'em_andamento').length,
    pendentes: progress.filter(p => p.status === 'pendente').length,
    etapas_concluidas, total_etapas,
    progresso_geral: total_etapas ? Math.round(etapas_concluidas * 100 / total_etapas) : 0,
  }
}
export type CategorySummary = ReturnType<typeof categorySummary>
