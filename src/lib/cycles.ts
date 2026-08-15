export type Ciclo = 'basico' | 'clinico'

export const DEFAULT_CICLO: Ciclo = 'basico'

export const CICLOS: Record<Ciclo, {
  label: string
  shortLabel: string
  description: string
  target: string
  expectedDisciplines: number
  expectedTopics: number
  expectedPages: number
}> = {
  basico: {
    label: 'Ciclo Básico',
    shortLabel: 'Básico',
    description: 'Ciclo Básico de Medicina 2026',
    target: '2026-10-31',
    expectedDisciplines: 18,
    expectedTopics: 258,
    expectedPages: 2136,
  },
  clinico: {
    label: 'Ciclo Clínico',
    shortLabel: 'Clínico',
    description: 'Ciclo Clínico de Medicina 2026',
    target: '2026-10-31',
    expectedDisciplines: 29,
    expectedTopics: 410,
    expectedPages: 3859,
  },
}

export function isCiclo(value: unknown): value is Ciclo {
  return value === 'basico' || value === 'clinico'
}

export function parseCiclo(value: unknown): Ciclo | undefined {
  return isCiclo(value) ? value : undefined
}
