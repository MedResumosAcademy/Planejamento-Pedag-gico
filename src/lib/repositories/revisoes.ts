import { createClient } from '@/lib/supabase/client'
import type { Revisao } from '@/types'

// Histórico de revisões do material de um tema (controle de versões).
export async function getRevisoesByTema(temaId: number): Promise<Revisao[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tema_revisoes')
    .select('*')
    .eq('tema_id', temaId)
    .order('revisado_em', { ascending: false })
    .order('criado_em', { ascending: false })
  if (error) throw error
  return data || []
}

export async function addRevisao(payload: {
  tema_id: number
  revisado_em: string
  o_que_mudou: string
  autor?: string | null
}): Promise<Revisao> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('tema_revisoes')
    .insert({
      tema_id: payload.tema_id,
      revisado_em: payload.revisado_em,
      o_que_mudou: payload.o_que_mudou,
      autor: payload.autor ?? null,
    })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteRevisao(id: number): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from('tema_revisoes').delete().eq('id', id)
  if (error) throw error
}

// Conta revisões por tema em lote (para indicadores no dashboard).
export async function getRevisaoCounts(): Promise<Record<number, number>> {
  const supabase = createClient()
  const { data, error } = await supabase.from('tema_revisoes').select('tema_id')
  if (error) throw error
  const out: Record<number, number> = {}
  for (const r of data || []) out[r.tema_id] = (out[r.tema_id] || 0) + 1
  return out
}
