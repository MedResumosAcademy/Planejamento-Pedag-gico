import { createClient } from '@/lib/supabase/client'
import type { Colaborador, UserSession } from '@/types'

export async function getCurrentUser(): Promise<UserSession | null> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: colab } = await supabase.from('colaboradores').select('nivel, nome').eq('id', user.id).single()
  if (!colab) return null
  let disciplina_ids: number[] = []
  if (colab.nivel === 'professor') {
    const { data: pd } = await supabase.from('professor_disciplinas').select('disciplina_id').eq('professor_id', user.id)
    disciplina_ids = pd?.map(d => d.disciplina_id) || []
  }
  return { id: user.id, email: user.email || '', nivel: colab.nivel, nome: colab.nome, disciplina_ids }
}

export async function getAllColaboradores(): Promise<Colaborador[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('colaboradores').select('*, professor_disciplinas(disciplina_id), professor_horarios(dia_semana, hora_inicio, hora_fim)').order('criado_em')
  if (error) throw error
  return data || []
}

export async function getColaboradorById(id: string): Promise<Colaborador | null> {
  const supabase = createClient()
  const { data } = await supabase.from('colaboradores').select('*, professor_disciplinas(disciplina_id), professor_horarios(dia_semana, hora_inicio, hora_fim)').eq('id', id).single()
  return data
}
