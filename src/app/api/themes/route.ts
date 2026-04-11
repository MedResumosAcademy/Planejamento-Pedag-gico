import { NextRequest, NextResponse } from 'next/server'
import { getDisciplinas, getTemas, updateTema, type Status } from '@/lib/db'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const discId = searchParams.get('disciplina_id')
  const search = searchParams.get('search')
  const status = searchParams.get('status')

  const [disciplinas, temas] = await Promise.all([
    getDisciplinas(),
    getTemas({
      disciplina_id: discId ? Number(discId) : undefined,
      status: status ?? undefined,
      search: search ?? undefined,
    }),
  ])

  const result = temas.map(t => ({
    ...t,
    disciplina_nome: disciplinas.find(d => d.id === t.disciplina_id)?.nome ?? '',
    disciplina_cor: disciplinas.find(d => d.id === t.disciplina_id)?.cor ?? '#888',
  }))

  return NextResponse.json(result)
}

export async function PATCH(req: NextRequest) {
  const body = await req.json()
  const { id, campo, valor, responsavel, observacoes } = body

  const temas = await getTemas()
  const tema = temas.find(t => t.id === id)
  if (!tema) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const CAMPOS = [
    'mat_atualizado', 'mat_revisado', 'mat_diagramado', 'mat_conferencia',
    'vid_slide', 'vid_gravacao', 'vid_edicao',
    'comp_simulado', 'comp_questoes', 'comp_flashcards',
  ]

  const updates: Record<string, unknown> = {}

  if (campo && CAMPOS.includes(campo)) updates[campo] = valor
  if (responsavel !== undefined) updates.responsavel = responsavel
  if (observacoes !== undefined) updates.observacoes = observacoes

  // Automações
  const t = { ...tema, ...updates }
  if (campo === 'mat_diagramado' && valor === 'concluido' && t.mat_conferencia === 'pendente')
    updates.mat_conferencia = 'em_andamento'
  if (campo === 'mat_conferencia' && valor === 'concluido' && t.vid_slide === 'pendente')
    updates.vid_slide = 'em_andamento'
  if (campo === 'vid_gravacao' && valor === 'concluido' && t.vid_edicao === 'pendente')
    updates.vid_edicao = 'em_andamento'

  // Recalcula status_geral
  const merged = { ...t, ...updates }
  const etapas: Status[] = [
    merged.mat_atualizado, merged.mat_revisado, merged.mat_diagramado, merged.mat_conferencia,
    merged.vid_slide, merged.vid_gravacao, merged.vid_edicao,
    merged.comp_simulado, merged.comp_questoes, merged.comp_flashcards,
  ]
  const allDone = etapas.every(s => s === 'concluido')
  const anyStarted = etapas.some(s => s !== 'pendente')
  updates.status_geral = allDone ? 'concluido' : anyStarted ? 'em_andamento' : 'pendente'

  const updated = await updateTema(id, updates as any)

  const disciplinas = await getDisciplinas()
  const disc = disciplinas.find(d => d.id === updated.disciplina_id)
  return NextResponse.json({ ...updated, disciplina_nome: disc?.nome, disciplina_cor: disc?.cor })
}
