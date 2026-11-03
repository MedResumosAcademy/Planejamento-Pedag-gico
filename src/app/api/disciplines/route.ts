import { NextResponse } from 'next/server'
import { getDisciplinas, getTemas } from '@/lib/db'
import { parseCiclo } from '@/lib/cycles'
import { CONTENT_CATEGORY_KEYS, categorySummary, parseContentCategory } from '@/lib/content-categories'

export async function GET(request: Request) {
  const rawCiclo = new URL(request.url).searchParams.get('ciclo')
  const ciclo = parseCiclo(rawCiclo)
  const rawCategory = new URL(request.url).searchParams.get('categoria')
  const category = parseContentCategory(rawCategory) ?? 'resumos'
  if (rawCategory && !parseContentCategory(rawCategory)) {
    return NextResponse.json({ error: 'Categoria de conteúdo inválida' }, { status: 400 })
  }
  if (rawCiclo && !ciclo) {
    return NextResponse.json({ error: 'ciclo deve ser "basico" ou "clinico"' }, { status: 400 })
  }
  const [disciplinas, temas] = await Promise.all([
    getDisciplinas({ ciclo }),
    getTemas({ ciclo }),
  ])

  const result = disciplinas.map(d => {
    const dt = temas.filter(t => t.disciplina_id === d.id)
    const categorias = Object.fromEntries(CONTENT_CATEGORY_KEYS.map(key => [key, categorySummary(dt, key)]))
    return { ...d, categoria: category, categorias, ...categorySummary(dt, category) }
  })

  return NextResponse.json(result)
}
