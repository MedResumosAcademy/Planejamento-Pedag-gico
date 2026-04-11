'use client'
import { useRouter } from 'next/navigation'
interface BackButtonProps { label?: string; href?: string }
export default function BackButton({ label = '← Back', href }: BackButtonProps) {
  const router = useRouter()
  return (
    <button onClick={() => href ? router.push(href) : router.back()}
      style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 13, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6, padding: 0 }}>
      {label}
    </button>
  )
}
