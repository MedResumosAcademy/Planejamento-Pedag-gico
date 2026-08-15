import { createClient } from '@/lib/supabase/client'
import type { Ciclo, Disciplina, Tema } from '@/types'

export async function getAllDisciplinas(ciclo?: Ciclo): Promise<Disciplina[]> {
  const supabase = createClient()
  let query = supabase.from('disciplinas').select('*').order('nome')
  if (ciclo) query = query.eq('ciclo', ciclo)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getDisciplinasByIds(ids: number[], ciclo?: Ciclo): Promise<Disciplina[]> {
  if (!ids.length) return []
  const supabase = createClient()
  let query = supabase.from('disciplinas').select('*').in('id', ids).order('nome')
  if (ciclo) query = query.eq('ciclo', ciclo)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getTemasByDisciplinas(disciplinaIds: number[]): Promise<Tema[]> {
  if (!disciplinaIds.length) return []
  const supabase = createClient()
  const { data, error } = await supabase.from('temas').select('*, disciplinas(nome, cor)').in('disciplina_id', disciplinaIds).order('disciplina_id').order('ordem')
  if (error) throw error
  return data || []
}

export async function getAllTemas(ciclo?: Ciclo): Promise<Tema[]> {
  const supabase = createClient()
  let query = supabase
    .from('temas')
    .select('*, disciplinas!inner(ciclo)')
    .order('disciplina_id')
    .order('ordem')
  if (ciclo) query = query.eq('disciplinas.ciclo', ciclo)
  const { data, error } = await query
  if (error) throw error
  return (data || []) as unknown as Tema[]
}
