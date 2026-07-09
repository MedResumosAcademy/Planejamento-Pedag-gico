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
    // Status derivado das etapas (não do campo status_geral, que fica desatualizado):
    // 0 etapas = pendente · todas as 15 = concluído · qualquer coisa no meio = em andamento.
    let concluidos = 0, em_andamento = 0, pendentes = 0
    for (const t of dt) {
      const done = ALL_SUB_STATUS.filter(k => (t as any)[k] === 'concluido').length
      if (t.status_geral === 'concluido' || done === ALL_SUB_STATUS.length) concluidos++
      else if (done > 0 || t.status_geral === 'em_andamento') em_andamento++
      else pendentes++
    }
    const paginas_totais = dt.reduce((a, t) => a + (t.paginas ?? 0), 0)
    const total_etapas = dt.length * ALL_SUB_STATUS.length
    const etapas_concluidas = dt.reduce((a, t) =>
      a + ALL_SUB_STATUS.filter(k => (t as any)[k] === 'concluido').length, 0
    )
    const progresso_geral = total_etapas > 0
      ? Math.round(etapas_concluidas * 100 / total_etapas)
      : 0
    return { ...d, total_temas: dt.length, concluidos, em_andamento, pendentes, paginas_totais, etapas_concluidas, total_etapas, progresso_geral }
  })

  return NextResponse.json(result)
}
