'use client'
export const dynamic = 'force-dynamic'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

// O painel gerencial foi unificado na Home. Esta rota redireciona para a aba Gerencial.
export default function GerencialRedirect() {
  const router = useRouter()
  useEffect(() => { router.replace('/?view=gerencial') }, [router])
  return <div style={{ background: '#f4f6fb', minHeight: '100vh' }} />
}
