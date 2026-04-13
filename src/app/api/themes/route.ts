import { NextResponse } from 'next/server'
import { getDisciplinas, getTemas, updateTema } from '@/lib/db'

const VALID_CAMPOS = new Set([
  'mat_atualizado','mat_revisado','mat_diagramado','mat_conferencia',
  'vid_envio_tema','vid_slide_pronto','vid_diagramacao','vid_aprovacao_slide',
  'vid_agendamento','vid_gravacao_feita','vid_aprovacao_aula','vid_publicada',
  'comp_simulado','comp_questoes','comp_flashcards',
  'status_geral','paginas','questoes_previstas','responsavel','observacoes',
])

const VALID_STATUS = new Set(['pendente','em_andamento','concluido'])

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const disciplina_id = searchParams.get('disciplina_id')
  const temas = await getTemas(disciplina_id ? { disciplina_id: Number(disciplina_id) } : undefined)
  return NextResponse.json(temas)
}

export async function PATCH(req: Request) {
  const { id, campo, valor } = await req.json()

  if (!id || !campo || valor === undefined) {
    return NextResponse.json({ error: 'Missing required fields: id, campo, valor' }, { status: 400 })
  }

  if (!VALID_CAMPOS.has(campo)) {
    return NextResponse.json({ error: `Invalid field: ${campo}` }, { status: 400 })
  }

  if (VALID_STATUS.size > 0 && typeof valor === 'string' && campo !== 'responsavel' && campo !== 'observacoes') {
    if (!VALID_STATUS.has(valor) && typeof valor !== 'number') {
      return NextResponse.json({ error: `Invalid status value: ${valor}` }, { status: 400 })
    }
  }

  // Auto-advance status_geral based on video workflow
  const VID_FIELDS = ['vid_envio_tema','vid_slide_pronto','vid_diagramacao','vid_aprovacao_slide','vid_agendamento','vid_gravacao_feita','vid_aprovacao_aula','vid_publicada']
  const MAT_FIELDS = ['mat_atualizado','mat_revisado','mat_diagramado','mat_conferencia']

  let extraUpdates: Record<string,string> = {}

  // Auto-advance next step in video sequence when one is concluded
  if (VID_FIELDS.includes(campo) && valor === 'concluido') {
    const idx = VID_FIELDS.indexOf(campo)
    if (idx < VID_FIELDS.length - 1) {
      extraUpdates[VID_FIELDS[idx + 1]] = 'em_andamento'
    }
  }

  const tema = await updateTema(id, { [campo]: valor, ...extraUpdates })
  return NextResponse.json(tema)
}
