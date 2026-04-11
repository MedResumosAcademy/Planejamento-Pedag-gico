'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Disciplina { id: number; nome: string }
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function CadastroProfessor() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', password: '', confirmPassword: '',
    disciplinas: [] as number[],
    horarios: [] as { dia_semana: number; hora_inicio: string; hora_fim: string }[]
  })

  useEffect(() => {
    createClient().from('disciplinas').select('id, nome').order('nome').then(({ data }) => setDisciplinas(data || []))
  }, [])

  function toggleDisciplina(id: number) {
    setForm(f => ({
      ...f,
      disciplinas: f.disciplinas.includes(id) ? f.disciplinas.filter(d => d !== id) : [...f.disciplinas, id]
    }))
  }

  function addHorario() {
    setForm(f => ({ ...f, horarios: [...f.horarios, { dia_semana: 1, hora_inicio: '08:00', hora_fim: '12:00' }] }))
  }

  function updateHorario(i: number, field: string, value: string | number) {
    setForm(f => { const h = [...f.horarios]; h[i] = { ...h[i], [field]: value }; return { ...f, horarios: h } })
  }

  function removeHorario(i: number) {
    setForm(f => ({ ...f, horarios: f.horarios.filter((_, idx) => idx !== i) }))
  }

  async function handleSubmit() {
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (form.disciplinas.length === 0) { setError('Select at least one discipline.'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/cadastro/professor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error creating account')
      setStep(4)
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const inputStyle = { width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'10px 14px', color:'#e2e8f0', fontSize:14, outline:'none', boxSizing:'border-box' as const }
  const labelStyle = { fontSize:12, color:'#94a3b8', fontWeight:500 as const, display:'block' as const, marginBottom:6 }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0d14', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:20, padding:'40px 48px', width:'100%', maxWidth:520 }}>

        {/* Header */}
        <div style={{ textAlign:'center', marginBottom:32 }}>
          <div style={{ width:48, height:48, borderRadius:12, background:'linear-gradient(135deg,#0891b2,#0d9488)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:24, fontWeight:700, color:'white', margin:'0 auto 16px' }}>M</div>
          <h1 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', margin:0 }}>Professor Registration</h1>
          <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Med2026 — Ciclo Básico de Medicina</p>
        </div>

        {/* Steps indicator */}
        {step < 4 && (
          <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:8, marginBottom:32 }}>
            {[1,2,3].map(s => (
              <div key={s} style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:28, height:28, borderRadius:'50%', background: step >= s ? 'linear-gradient(135deg,#0891b2,#0d9488)' : 'rgba(255,255,255,0.06)', border: step >= s ? 'none' : '1px solid rgba(255,255,255,0.1)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color: step >= s ? 'white' : '#475569' }}>{s}</div>
                {s < 3 && <div style={{ width:40, height:2, background: step > s ? '#0891b2' : 'rgba(255,255,255,0.06)', borderRadius:2 }} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 1 — Personal info */}
        {step === 1 && (
          <div>
            <h2 style={{ fontSize:15, fontWeight:600, color:'#cbd5e1', marginBottom:20 }}>Personal Information</h2>
            <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
              <div>
                <label style={labelStyle}>FULL NAME</label>
                <input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Your full name" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>E-MAIL</label>
                <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="your@email.com" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>PHONE</label>
                <input type="tel" value={form.telefone} onChange={e => setForm(f => ({ ...f, telefone: e.target.value }))} placeholder="(00) 00000-0000" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>PASSWORD</label>
                <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min. 6 characters" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>CONFIRM PASSWORD</label>
                <input type="password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} placeholder="Repeat password" style={inputStyle} />
              </div>
            </div>
            {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#f87171', marginTop:16 }}>{error}</div>}
            <button onClick={() => {
              if (!form.nome || !form.email || !form.password) { setError('Fill in all required fields.'); return }
              if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return }
              if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
              setError(''); setStep(2)
            }} style={{ width:'100%', marginTop:24, background:'linear-gradient(135deg,#0891b2,#0d9488)', border:'none', borderRadius:10, padding:'12px', color:'white', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Next →
            </button>
          </div>
        )}

        {/* Step 2 — Disciplines */}
        {step === 2 && (
          <div>
            <h2 style={{ fontSize:15, fontWeight:600, color:'#cbd5e1', marginBottom:8 }}>Your Disciplines</h2>
            <p style={{ fontSize:12, color:'#64748b', marginBottom:20 }}>Select the disciplines you will teach</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:24 }}>
              {disciplinas.map(d => (
                <button key={d.id} onClick={() => toggleDisciplina(d.id)}
                  style={{ padding:'7px 14px', borderRadius:8, border:'1px solid', borderColor: form.disciplinas.includes(d.id) ? '#0891b2' : 'rgba(255,255,255,0.08)', background: form.disciplinas.includes(d.id) ? 'rgba(8,145,178,0.15)' : 'transparent', color: form.disciplinas.includes(d.id) ? '#22d3ee' : '#64748b', fontSize:12, fontWeight:500, cursor:'pointer' }}>
                  {d.nome}
                </button>
              ))}
            </div>
            {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#f87171', marginBottom:16 }}>{error}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setError(''); setStep(1) }} style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px', color:'#94a3b8', fontSize:14, cursor:'pointer' }}>← Back</button>
              <button onClick={() => {
                if (form.disciplinas.length === 0) { setError('Select at least one discipline.'); return }
                setError(''); setStep(3)
              }} style={{ flex:2, background:'linear-gradient(135deg,#0891b2,#0d9488)', border:'none', borderRadius:10, padding:'12px', color:'white', fontSize:14, fontWeight:600, cursor:'pointer' }}>
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Availability */}
        {step === 3 && (
          <div>
            <h2 style={{ fontSize:15, fontWeight:600, color:'#cbd5e1', marginBottom:8 }}>Recording Availability</h2>
            <p style={{ fontSize:12, color:'#64748b', marginBottom:20 }}>Add your available time slots for recording classes</p>
            {form.horarios.map((h, i) => (
              <div key={i} style={{ display:'flex', gap:8, marginBottom:10, alignItems:'center' }}>
                <select value={h.dia_semana} onChange={e => updateHorario(i, 'dia_semana', Number(e.target.value))}
                  style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px', color:'#e2e8f0', fontSize:13, outline:'none' }}>
                  {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                </select>
                <input type="time" value={h.hora_inicio} onChange={e => updateHorario(i, 'hora_inicio', e.target.value)}
                  style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px', color:'#e2e8f0', fontSize:13, outline:'none' }} />
                <span style={{ color:'#475569', fontSize:12 }}>to</span>
                <input type="time" value={h.hora_fim} onChange={e => updateHorario(i, 'hora_fim', e.target.value)}
                  style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px', color:'#e2e8f0', fontSize:13, outline:'none' }} />
                <button onClick={() => removeHorario(i)} style={{ background:'rgba(239,68,68,0.1)', border:'none', borderRadius:6, padding:'8px 10px', color:'#f87171', cursor:'pointer', fontSize:12 }}>✕</button>
              </div>
            ))}
            <button onClick={addHorario} style={{ width:'100%', background:'rgba(255,255,255,0.03)', border:'1px dashed rgba(255,255,255,0.1)', borderRadius:10, padding:'10px', color:'#64748b', fontSize:13, cursor:'pointer', marginBottom:24 }}>
              + Add time slot
            </button>
            {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#f87171', marginBottom:16 }}>{error}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => { setError(''); setStep(2) }} style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'12px', color:'#94a3b8', fontSize:14, cursor:'pointer' }}>← Back</button>
              <button onClick={handleSubmit} disabled={saving} style={{ flex:2, background:'linear-gradient(135deg,#0891b2,#0d9488)', border:'none', borderRadius:10, padding:'12px', color:'white', fontSize:14, fontWeight:600, cursor:saving ? 'not-allowed' : 'pointer', opacity:saving ? 0.7 : 1 }}>
                {saving ? 'Creating account...' : 'Complete Registration ✓'}
              </button>
            </div>
          </div>
        )}

        {/* Step 4 — Success */}
        {step === 4 && (
          <div style={{ textAlign:'center' }}>
            <div style={{ fontSize:56, marginBottom:16 }}>🎉</div>
            <h2 style={{ fontSize:20, fontWeight:700, color:'#f1f5f9', marginBottom:8 }}>Registration Complete!</h2>
            <p style={{ fontSize:14, color:'#64748b', marginBottom:32 }}>Your account has been created successfully. You can now sign in to access your panel.</p>
            <button onClick={() => router.push('/login')} style={{ width:'100%', background:'linear-gradient(135deg,#0891b2,#0d9488)', border:'none', borderRadius:10, padding:'12px', color:'white', fontSize:14, fontWeight:600, cursor:'pointer' }}>
              Go to Login →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
