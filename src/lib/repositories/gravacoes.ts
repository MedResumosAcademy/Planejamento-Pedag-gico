import { createClient } from '@/lib/supabase/client'
import type { Gravacao, RecordingStatus, ExternalLink } from '@/types'

export async function getGravacoesByWeek(startDate: string, endDate: string, professorId?: string): Promise<Gravacao[]> {
  const supabase = createClient()
  let query = supabase.from('gravacoes').select('*, colaboradores(nome), disciplinas(nome, cor), temas(tema_especifico)').gte('data_hora', startDate).lte('data_hora', endDate + 'T23:59:59').order('data_hora')
  if (professorId) query = query.eq('professor_id', professorId)
  const { data, error } = await query
  if (error) throw error
  return data || []
}

export async function getGravacoesByProfessor(professorId: string): Promise<Gravacao[]> {
  const supabase = createClient()
  const { data, error } = await supabase.from('gravacoes').select('*, disciplinas(nome, cor), temas(tema_especifico)').eq('professor_id', professorId).order('data_hora', { ascending: false }).limit(50)
  if (error) throw error
  return data || []
}

export async function createGravacao(payload: { professor_id: string; disciplina_id: number; tema_id: number; data_hora: string; duracao_minutos: number; observacoes?: string }): Promise<Gravacao> {
  const supabase = createClient()
  const { data, error } = await supabase.from('gravacoes').insert({ ...payload, status: 'proposta', gravada: false, cancelada: false, links: [] }).select().single()
  if (error) throw error
  return data
}

export async function updateGravacao(id: number, updates: { status?: RecordingStatus; gravada?: boolean; cancelada?: boolean; motivo_cancelamento?: string | null; observacoes?: string | null; links?: ExternalLink[]; concluida_em?: string | null }): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('gravacoes').update(updates).eq('id', id)
  if (error) throw error
}
