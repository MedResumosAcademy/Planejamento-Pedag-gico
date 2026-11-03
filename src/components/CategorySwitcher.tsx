'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { CONTENT_CATEGORIES, CONTENT_CATEGORY_KEYS, parseContentCategory, type ContentCategory } from '@/lib/content-categories'

export function useContentCategory() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const category = parseContentCategory(params.get('categoria')) ?? 'resumos'
  function setCategory(value: ContentCategory) {
    const next = new URLSearchParams(params.toString())
    next.set('categoria', value)
    router.push(`${pathname}?${next}`, { scroll: false })
  }
  return { category, setCategory }
}

export default function CategorySwitcher({ category, onChange }: { category: ContentCategory; onChange: (value: ContentCategory) => void }) {
  return <div role="group" aria-label="Categoria de conteúdo" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
    {CONTENT_CATEGORY_KEYS.map(key => {
      const config = CONTENT_CATEGORIES[key]
      return <button key={key} type="button" aria-pressed={category === key} onClick={() => onChange(key)}
        style={{ minHeight: 44, padding: '8px 16px', borderRadius: 8, fontSize: 13, fontFamily: 'inherit', fontWeight: 600, cursor: 'pointer', background: category === key ? `${config.color}15` : '#fff', border: `1px solid ${category === key ? config.color : '#cbd5e1'}`, color: category === key ? config.color : '#475569' }}>{config.label}</button>
    })}
  </div>
}
