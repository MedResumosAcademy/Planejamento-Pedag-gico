'use client'

import { useEffect, useState } from 'react'
import type { Ciclo } from '@/lib/cycles'
import type { ResumoCiclo } from '@/lib/resumos-google-parser'

export interface ResumoPlanilhaResponse {
  version: 1
  ciclo: Ciclo
  data: ResumoCiclo
  source_state: 'online' | 'snapshot'
  source_url: string
  source_read_at: string
  source_fingerprint: string
  fetched_at?: string
  warning?: string
}

type LoadState = { ciclo?: Ciclo; status: 'idle' | 'loading' | 'ready' | 'error'; payload?: ResumoPlanilhaResponse }

export function useResumoPlanilha(ciclo: Ciclo | undefined, enabled: boolean) {
  const [state, setState] = useState<LoadState>({ status: 'idle' })
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => {
    if (!enabled || !ciclo) { setState({ status: 'idle' }); return }
    const controller = new AbortController()
    setState(previous => ({ ciclo, status: 'loading', payload: previous.ciclo === ciclo ? previous.payload : undefined }))
    fetch(`/api/resumos-planilha?ciclo=${ciclo}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (!response.ok) throw new Error('source_unavailable')
        return response.json() as Promise<ResumoPlanilhaResponse>
      })
      .then(payload => {
        if (controller.signal.aborted) return
        if (payload.ciclo !== ciclo || !payload.data ||
          payload.data.temas !== payload.data.prontos + payload.data.faltando) throw new Error('source_invalid')
        setState({ ciclo, status: 'ready', payload })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState(previous => ({
          ciclo, status: 'error', payload: previous.ciclo === ciclo ? previous.payload : undefined,
        }))
      })
    return () => controller.abort()
  }, [ciclo, enabled, refreshKey])
  const refresh = () => setRefreshKey(key => key + 1)
  if (!enabled || !ciclo) return { status: 'idle' as const, payload: undefined, refresh }
  if (state.ciclo !== ciclo) return { status: 'loading' as const, payload: undefined, refresh }
  return { ...state, refresh }
}

export function resumoPlanilhaPct(data: ResumoCiclo): number {
  if (!data.temas) return 0
  const rounded = Math.round(data.prontos * 100 / data.temas)
  return data.faltando > 0 ? Math.min(rounded, 99) : 100
}

export function resumoPlanilhaColeta(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}:\d{2})$/.exec(value)
  if (!match) return value
  const [, year, month, day, time] = match
  return `${day}/${month}/${year} às ${time}`
}
