'use client'
import { useState, useEffect } from 'react'
import { getCurrentUser } from '@/lib/repositories/colaboradores'
import type { UserSession } from '@/types'

export function useSession() {
  const [session, setSession] = useState<UserSession | null>(null)
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    getCurrentUser().then(user => { setSession(user); setLoading(false) })
  }, [])
  return {
    session,
    loading,
    isCoordinator: session?.nivel === 'coordenador',
    isProfessor: session?.nivel === 'professor',
    isAluno: session?.nivel === 'aluno',
  }
}
