import { NextResponse } from 'next/server'
import { getDB } from '@/lib/db'

export async function GET() {
  const db = getDB()
  const result = db.disciplinas.map(d => {
    const temas = db.temas.filter(t => t.disciplina_id === d.id)
    const concluidos = temas.filter(t => t.status_geral === 'concluido').length
    const em_andamento = temas.filter(t => t.status_geral === 'em_andamento').length
    const pendentes = temas.filter(t => t.status_geral === 'pendente').length
    const paginas_totais = temas.reduce((a, t) => a + (t.paginas ?? 0), 0)
    const total_etapas = temas.length * 10
    const etapas_concluidas = temas.reduce((a, t) => a + [
      t.mat_atualizado, t.mat_revisado, t.mat_diagramado, t.mat_conferencia,
      t.vid_slide, t.vid_gravacao, t.vid_edicao,
      t.comp_simulado, t.comp_questoes, t.comp_flashcards
    ].filter(s => s === 'concluido').length, 0)
    const progresso_geral = total_etapas > 0
      ? Math.round(etapas_concluidas * 100 / total_etapas)
      : 0
    return {
      ...d,
      total_temas: temas.length,
      concluidos,
      em_andamento,
      pendentes,
      paginas_totais,
      progresso_geral,
    }
  })
  return NextResponse.json(result)
}
