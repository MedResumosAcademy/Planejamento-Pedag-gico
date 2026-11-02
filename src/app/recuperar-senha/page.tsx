'use client'

import Link from 'next/link'
import { FormEvent, useEffect, useState } from 'react'
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

export default function RecuperarSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [linkError, setLinkError] = useState(false)

  useEffect(() => {
    setLinkError(new URLSearchParams(window.location.search).get('erro') === 'link-invalido')
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const redirectTo = `${window.location.origin}/redefinir-senha`
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo })

    setLoading(false)
    if (resetError) {
      setError('Não foi possível enviar o link agora. Aguarde um momento e tente novamente.')
      return
    }

    setSent(true)
  }

  return (
    <main style={{ minHeight: '100vh', background: '#f4f6fb', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <section style={{ background: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.08)', borderRadius: 20, padding: '40px clamp(24px, 8vw, 48px)', width: 'min(400px, 100%)' }} aria-labelledby="page-title">
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div aria-hidden="true" style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 700, color: 'white', margin: '0 auto 16px' }}>M</div>
          <h1 id="page-title" style={{ fontSize: 22, fontWeight: 700, color: '#0f172a', margin: 0 }}>Recuperar senha</h1>
          <p style={{ fontSize: 14, lineHeight: 1.5, color: '#475569', margin: '8px 0 0' }}>Informe seu e-mail para receber um link seguro de definição de senha.</p>
        </div>

        {linkError && !sent && (
          <div role="alert" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, padding: 14, color: '#991b1b', fontSize: 14, lineHeight: 1.5, marginBottom: 18 }}>
            O link é inválido ou expirou. Solicite um novo link abaixo.
          </div>
        )}

        {sent ? (
          <div role="status" aria-live="polite" style={{ background: 'rgba(22,163,74,0.1)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 10, padding: 14, color: '#166534', fontSize: 14, lineHeight: 1.5 }}>
            Se existir uma conta para esse e-mail, o link foi enviado. Verifique também a caixa de spam.
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="email" style={{ fontSize: 12, color: '#475569', fontWeight: 600, display: 'block', marginBottom: 6 }}>E-MAIL</label>
            <input id="email" name="email" type="email" autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} required style={inputStyle} aria-describedby={error ? 'reset-error' : undefined} aria-invalid={Boolean(error)} />
            {error && <p id="reset-error" role="alert" style={{ color: '#b91c1c', fontSize: 13, lineHeight: 1.5, margin: '10px 0 0' }}>{error}</p>}
            <button type="submit" disabled={loading} style={{ width: '100%', minHeight: 44, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '12px 16px', color: 'white', fontSize: 14, fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, marginTop: 20 }}>
              {loading ? 'Enviando…' : 'Enviar link seguro'}
            </button>
          </form>
        )}

        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <Link href="/login" style={{ color: '#4f46e5', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>Voltar para o login</Link>
        </div>
      </section>
    </main>
  )
}
