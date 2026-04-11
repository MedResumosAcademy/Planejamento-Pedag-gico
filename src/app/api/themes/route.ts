import { NextRequest, NextResponse } from 'next/server'
import { getDB, saveDB } from '@/lib/db'

export async function GET(req: NextRequest) {
  const db = getDB()
  const { searchParams } = new URL(req.url)
  const discId = searchParams.get('disciplina_id')
  const search = searchParams.get('search')
  const status = searchParams.get('status')

  let temas = db.temas.map(t => ({
    ...t,
    disciplina_nome: db.disciplinas.find(d => d.id === t.disciplina_id)?.nome ?? '',
    disciplina_cor: db.disciplinas.find(d => d.id === t.disciplina_id)?.cor ?? '#888',
  }))

  if (discId) temas = temas.filter(t => t.disciplina_id === Number(discId))
  if (status) temas = temas.filter(t => t.status_geral === status)
  if (search) temas = temas.filter(t => t.tema_especifico.toLowerCase().includes(search.toLowerCase()))

  return NextResponse.json(temas)
}

export async function PATCH(req: NextRequest) {
  const db = getDB()
  const body = await req.json()
  const { id, campo, valor, responsavel, observacoes } = body

  const idx = db.temas.findIndex(t => t.id === id)
  if (idx === -1) return NextResponse.json({ error: 'not found' }, { status: 404 })

  const t = { ...db.temas[idx] }

  const CAMPOS = [
    'mat_atualizado','mat_revisado','mat_diagramado','mat_conferencia',
    'vid_slide','vid_gravacao','vid_edicao',
    'comp_simulado','comp_questoes','comp_flashcards'
  ]

  if (campo && CAMPOS.includes(campo)) (t as any)[campo] = valor
  if (responsavel !== undefined) t.responsavel = responsavel
  if (observacoes !== undefined) t.observacoes = observacoes

  // Automações
  if (campo === 'mat_diagramado' && valor === 'concluido' && t.mat_conferencia === 'pendente')
    t.mat_conferencia = 'em_andamento'
  if (campo === 'mat_conferencia' && valor === 'concluido' && t.vid_slide === 'pendente')
    t.vid_slide = 'em_andamento'
  if (campo === 'vid_gravacao' && valor === 'concluido' && t.vid_edicao === 'pendente')
    t.vid_edicao = 'em_andamento'

  // Recalcula status geral
  const etapas = [
    t.mat_atualizado, t.mat_revisado, t.mat_diagramado, t.mat_conferencia,
    t.vid_slide, t.vid_gravacao, t.vid_edicao,
    t.comp_simulado, t.comp_questoes, t.comp_flashcards
  ]
  const allDone = etapas.every(s => s === 'concluido')
  const anyStarted = etapas.some(s => s !== 'pendente')
  t.status_geral = allDone ? 'concluido' : anyStarted ? 'em_andamento' : 'pendente'
  t.updated_at = new Date().toISOString()

  db.temas[idx] = t
  saveDB(db)

  const disc = db.disciplinas.find(d => d.id === t.disciplina_id)
  return NextResponse.json({ ...t, disciplina_nome: disc?.nome, disciplina_cor: disc?.cor })
}
