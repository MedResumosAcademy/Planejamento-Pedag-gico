import snapshot from '@/data/resumos-planilha.snapshot.json'
import type { Ciclo } from '@/lib/cycles'

export interface ResumoDisciplina {
  nome: string
  temas: number
  prontos: number
  faltando: number
}

export interface ResumoCiclo {
  temas: number
  prontos: number
  faltando: number
  disciplines: ResumoDisciplina[]
}

export const RESUMOS_PLANILHA = snapshot

export function resumoPlanilha(ciclo: Ciclo): ResumoCiclo {
  return snapshot.cycles[ciclo]
}

export function resumoPlanilhaPct(ciclo: Ciclo): number {
  const { temas, prontos, faltando } = resumoPlanilha(ciclo)
  if (!temas) return 0
  const rounded = Math.round(prontos * 100 / temas)
  return faltando > 0 ? Math.min(rounded, 99) : 100
}

export function resumoPlanilhaColeta(ciclo: Ciclo): string {
  const value = snapshot.source_read_at[ciclo]
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(value)
  if (!match) return value
  const [, year, month, day, time] = match
  return `${day}/${month}/${year} às ${time}`
}
