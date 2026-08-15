import { createClient } from '@supabase/supabase-js'
import type { Ciclo, Disciplina, Tema } from '@/types'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export interface TemaComDisciplina extends Tema {
  disciplina_nome?: string
  disciplina_cor?: string
}

export async function getDisciplinas(filters?: { ciclo?: Ciclo }): Promise<Disciplina[]> {
  let query = supabase.from('disciplinas').select('*').order('id')
  if (filters?.ciclo) query = query.eq('ciclo', filters.ciclo)
  const { data, error } = await query
  if (error) throw error
  return data as Disciplina[]
}

export async function getTemas(filters?: {
  disciplina_id?: number
  status?: string
  search?: string
  ciclo?: Ciclo
}): Promise<TemaComDisciplina[]> {
  let query = supabase
    .from('temas')
    .select('*, disciplinas!inner(nome, cor, ciclo)')
    .order('disciplina_id')
    .order('ordem')
  if (filters?.disciplina_id) query = query.eq('disciplina_id', filters.disciplina_id)
  if (filters?.status) query = query.eq('status_geral', filters.status)
  if (filters?.search) query = query.ilike('tema_especifico', `%${filters.search}%`)
  if (filters?.ciclo) query = query.eq('disciplinas.ciclo', filters.ciclo)
  const { data, error } = await query
  if (error) throw error
  return (data || []).map((row: any) => ({
    ...row,
    disciplina_nome: row.disciplinas?.nome,
    disciplina_cor: row.disciplinas?.cor,
  })) as TemaComDisciplina[]
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
