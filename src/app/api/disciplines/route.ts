import { NextResponse } from 'next/server'
import { getDisciplinas, getTemas } from '@/lib/db'

const ALL_SUB_STATUS = [
  'mat_atualizado', 'mat_revisado', 'mat_diagramado', 'mat_conferencia',
  'vid_envio_tema', 'vid_slide_pronto', 'vid_diagramacao', 'vid_aprovacao_slide',
  'vid_agendamento', 'vid_gravacao_feita', 'vid_aprovacao_aula', 'vid_publicada',
  'comp_simulado', 'comp_questoes', 'comp_flashcards',
]

export async function GET() {
  const [disciplinas, temas] = await Promise.all([getDisciplinas(), getTemas()])

  const result = disciplinas.map(d => {
    const dt = temas.filter(t => t.disciplina_id === d.id)
    const concluidos = dt.filter(t => t.status_geral === 'concluido').length
    const em_andamento = dt.filter(t => t.status_geral === 'em_andamento').length
    const pendentes = dt.filter(t => t.status_geral === 'pendente').length
    const paginas_totais = dt.reduce((a, t) => a + (t.paginas ?? 0), 0)
    const total_etapas = dt.length * ALL_SUB_STATUS.length
    const etapas_concluidas = dt.reduce((a, t) =>
      a + ALL_SUB_STATUS.filter(k => (t as any)[k] === 'concluido').length, 0
    )
    const progresso_geral = total_etapas > 0
      ? Math.round(etapas_concluidas * 100 / total_etapas)
      : 0
    return { ...d, total_temas: dt.length, concluidos, em_andamento, pendentes, paginas_totais, progresso_geral }
  })

  return NextResponse.json(result)
}
