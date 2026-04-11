import { createClient } from '@/lib/supabase/client'
import type { Disciplina, Tema } from '@/types'

export async function getAllDisciplinas(): Promise<Disciplina[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('disciplinas').select('*').order('nome')
  if (error) throw error
  return data || []
}

export async function getDisciplinasByIds(ids: number[]): Promise<Disciplina[]> {
  if (!ids.length) return []
  const supabase = createClient()
  const { data, error } = await supabase.from('disciplinas').select('*').in('id', ids).order('nome')
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

export async function getAllTemas(): Promise<Tema[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('temas').select('*').order('disciplina_id').order('ordem')
  if (error) throw error
  return data || []
}
