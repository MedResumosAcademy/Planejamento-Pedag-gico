'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { CICLOS, DEFAULT_CICLO, isCiclo, type Ciclo } from '@/lib/cycles'

const STORAGE_KEY = 'med2026:ciclo-gestor'

interface CycleContextValue {
  ciclo: Ciclo
  setCiclo: (ciclo: Ciclo) => void
}

const CycleContext = createContext<CycleContextValue | null>(null)

export function CycleProvider({ children }: { children: React.ReactNode }) {
  const [ciclo, setCicloState] = useState<Ciclo>(DEFAULT_CICLO)

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isCiclo(saved)) setCicloState(saved)
  }, [])

  const value = useMemo<CycleContextValue>(() => ({
    ciclo,
    setCiclo(next) {
      setCicloState(next)
      window.localStorage.setItem(STORAGE_KEY, next)
    },
  }), [ciclo])

  return <CycleContext.Provider value={value}>{children}</CycleContext.Provider>
}

export function useCycle() {
  const value = useContext(CycleContext)
  if (!value) throw new Error('useCycle must be used within CycleProvider')
  return value
}

export function CycleSwitcher({ compact = false }: { compact?: boolean }) {
  const { ciclo, setCiclo } = useCycle()

  return (
    <div
      aria-label="Selecionar ciclo"
      style={{
        display: 'inline-flex', gap: 3, padding: 3, borderRadius: 10,
        background: 'rgba(15,23,42,0.05)', border: '1px solid rgba(15,23,42,0.08)',
      }}
    >
      {(Object.keys(CICLOS) as Ciclo[]).map(value => {
        const active = ciclo === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            onClick={() => setCiclo(value)}
            title={CICLOS[value].label}
            style={{
              border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
              padding: compact ? '6px 9px' : '7px 14px', fontSize: compact ? 11 : 12.5,
              fontWeight: 700, transition: 'all .15s',
              background: active ? '#fff' : 'transparent',
              color: active ? '#7c3aed' : '#64748b',
              boxShadow: active ? '0 1px 3px rgba(15,23,42,.12)' : 'none',
            }}
          >
            {compact ? CICLOS[value].shortLabel : CICLOS[value].label}
          </button>
        )
      })}
    </div>
  )
}
