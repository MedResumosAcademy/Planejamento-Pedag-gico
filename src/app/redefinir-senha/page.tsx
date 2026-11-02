'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const inputStyle = {
  width: '100%',
  background: 'rgba(0,0,0,0.05)',
  border: '1px solid rgba(0,0,0,0.1)',
  borderRadius: 10,
  padding: '10px 14px',
  color: '#1e293b',
  fontSize: 16,
  boxSizing: 'border-box' as const,
}

export default function RedefinirSenhaPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [updated, setUpdated] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setReady(Boolean(data.session))
      setChecking(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return
      if (session) {
        setReady(true)
        setChecking(false)
      }
    })

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.')
      return
    }

    setLoading(true)
    const { error: updateError } = await createClient().auth.updateUser({ password })
    setLoading(false)

    if (updateError) {
      if (updateError.code === 'same_password' || updateError.code === 'weak_password') {
        setError('Escolha uma senha nova e mais forte para continuar.')
      } else {
        setError('Não foi possível definir a senha. Solicite um novo link e tente novamente.')
      }
      return
    }

    setUpdated(true)
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <section style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '40px clamp(24px, 8vw, 48px)', width: 'min(400px, 100%)' }} aria-labelledby="page-title">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', margin: '0 auto 16px' }}>M</div>
          <h1 id="page-title" style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Definir nova senha</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: '#475569', margin: '8px 0 0' }}>Crie uma senha com pelo menos 8 caracteres para acessar o Med2026.</p>
        </div>

        {checking && <p role="status" aria-live="polite" style={{ color: '#475569', fontSize: 14, textAlign: 'center' }}>Validando seu link…</p>}

        {!checking && !ready && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 14, color: '#991b1b', fontSize: 14, lineHeight: 1.5 }}>
            Este link é inválido ou expirou. <Link href="/recuperar-senha" style={{ color: '#4f46e5', fontWeight: 700 }}>Solicite um novo link</Link>.
          </div>
        )}

        {ready && !updated && (
          <form onSubmit={handleSubmit}>
            <label htmlFor="password" style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>NOVA SENHA</label>
            <input id="password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} required minLength={8} style={inputStyle} aria-describedby={error ? 'password-help password-error' : 'password-help'} aria-invalid={Boolean(error)} />
            <p id="password-help" style={{ color: '#475569', fontSize: 12, margin: '6px 0 16px' }}>Use 8 ou mais caracteres.</p>

            <label htmlFor="confirmation" style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>CONFIRMAR SENHA</label>
            <input id="confirmation" name="confirmation" type={showPassword ? 'text' : 'password'} autoComplete="new-password" value={confirmation} onChange={event => setConfirmation(event.target.value)} required minLength={8} style={inputStyle} aria-describedby={error ? 'password-error' : undefined} aria-invalid={Boolean(error)} />

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, color: '#475569', fontSize: 13, cursor: 'pointer', marginTop: 10 }}>
              <input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
              Mostrar senhas
            </label>

            {error && <p id="password-error" role="alert" style={{ color: '#b91c1c', fontSize: 13, lineHeight: 1.5, margin: '8px 0 0' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ width: '100%', minHeight: 44, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '12px 16px', color: 'white', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 18 }}>
              {loading ? 'Salvando…' : 'Definir senha'}
            </button>
          </form>
        )}

        {updated && (
          <div role="status" aria-live="polite" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 10, padding: 14, color: '#166534', fontSize: 14, lineHeight: 1.5 }}>
            Senha definida com sucesso.
            <button type="button" onClick={() => { router.push('/'); router.refresh() }} style={{ width: '100%', minHeight: 44, background: '#4f46e5', border: 'none', borderRadius: 10, padding: '12px 16px', color: 'white', fontSize: 14, fontWeight: 600, cursor: 'pointer', marginTop: 14 }}>Entrar no sistema</button>
          </div>
        )}
      </section>
    </main>
  )
}
