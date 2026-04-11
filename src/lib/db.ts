import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export type Status = 'pendente' | 'em_andamento' | 'concluido'

export interface Tema {
  id: number
  disciplina_id: number
  ordem: number
  tema_especifico: string
  paginas: number | null
  questoes_previstas: number | null
  responsavel: string | null
  observacoes: string | null
  status_geral: Status
  mat_atualizado: Status
  mat_revisado: Status
  mat_diagramado: Status
  mat_conferencia: Status
  vid_slide: Status
  vid_gravacao: Status
  vid_edicao: Status
  comp_simulado: Status
  comp_questoes: Status
  comp_flashcards: Status
  updated_at: string
}

export interface Disciplina {
  id: number
  nome: string
  microassunto: string | null
  total_paginas: number
  cor: string
}

export async function getDisciplinas(): Promise<Disciplina[]> {
  const { data, error } = await supabase.from('disciplinas').select('*').order('id')
  if (error) throw error
  return data as Disciplina[]
}

export async function getTemas(filters?: {
  disciplina_id?: number
  status?: string
  search?: string
}): Promise<Tema[]> {
  let query = supabase.from('temas').select('*').order('disciplina_id').order('ordem')
  if (filters?.disciplina_id) query = query.eq('disciplina_id', filters.disciplina_id)
  if (filters?.status) query = query.eq('status_geral', filters.status)
  if (filters?.search) query = query.ilike('tema_especifico', `%${filters.search}%`)
  const { data, error } = await query
  if (error) throw error
  return data as Tema[]
}

export async function updateTema(
  id: number,
  fields: Partial<Tema>
): Promise<Tema> {
  const { data, error } = await supabase
    .from('temas')
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data as Tema
}
