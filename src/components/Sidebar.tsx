'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { UserSession } from '@/types'

export default function Sidebar({ session }: { session: UserSession | null }) {
  const router = useRouter()
  const pathname = usePathname()
  const [open, setOpen] = useState(true)

  async function handleLogout() {
    await createClient().auth.signOut()
    router.push('/login')
  }

  const navItems = [
    { href: '/', label: 'Dashboard', icon: '📊' },
    { href: '/disciplinas', label: 'Disciplinas', icon: '📚' },
    { href: '/kanban', label: 'Kanban', icon: '🗂️' },
    { href: '/agenda', label: 'Agenda', icon: '📅' },
    ...(session?.nivel === 'coordenador' ? [{ href: '/admin/colaboradores', label: 'Collaborators', icon: '👥' }] : []),
  ]

  const W = open ? 220 : 64

  return (
    <div style={{ width: W, background: 'rgba(255,255,255,0.02)', borderRight: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, bottom: 0, left: 0, transition: 'width 0.2s ease', overflow: 'hidden', zIndex: 10 }}>
      <div style={{ padding: '20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 72 }}>
        {open ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white', flexShrink: 0 }}>M</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', whiteSpace: 'nowrap' }}>Med2026</div>
                <div style={{ fontSize: 10, color: '#64748b', whiteSpace: 'nowrap' }}>Ciclo Básico</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 6, padding: '4px 8px', color: '#64748b', cursor: 'pointer', fontSize: 14 }}>←</button>
          </>
        ) : (
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: 'white' }}>M</div>
            <button onClick={() => setOpen(true)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: 14 }}>→</button>
          </div>
        )}
      </div>
      <nav style={{ padding: '12px 8px', flex: 1 }}>
        {navItems.map(item => {
          const active = pathname === item.href
          return (
            <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
              <div title={!open ? item.label : ''} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, color: active ? '#a78bfa' : '#64748b', background: active ? 'rgba(167,139,250,0.1)' : 'transparent', fontSize: 13, fontWeight: 500, marginBottom: 2, cursor: 'pointer', justifyContent: open ? 'flex-start' : 'center' }}>
                <span style={{ flexShrink: 0 }}>{item.icon}</span>
                {open && item.label}
              </div>
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '16px 8px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={handleLogout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 8, color: '#64748b', background: 'transparent', border: 'none', fontSize: 13, cursor: 'pointer', justifyContent: open ? 'flex-start' : 'center' }}>
          <span>🚪</span>{open && 'Sign Out'}
        </button>
      </div>
      {open && session?.nome && (
        <div style={{ padding: '0 20px 16px', fontSize: 11, color: '#475569' }}>
          <div style={{ marginBottom: 4, color: '#64748b', fontWeight: 500, fontSize: 12 }}>{session.nome}</div>
          258 temas · 18 disciplinas · ~2.136 páginas
        </div>
      )}
    </div>
  )
}
