'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Disciplina { id: number; nome: string }
interface Colaborador {
  id: string; nome: string; email: string; telefone: string | null
  nivel: 'coordenador' | 'professor'; criado_em: string
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ColaboradoresPage() {
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    nome: '', email: '', telefone: '', password: '',
    nivel: 'professor' as 'coordenador' | 'professor',
    disciplinas: [] as number[],
    horarios: [] as { dia_semana: number; hora_inicio: string; hora_fim: string }[]
  })

  const supabase = createClient()

  async function load() {
    setLoading(true)
    const [{ data: cols }, { data: discs }] = await Promise.all([
      supabase.from('colaboradores').select('*').order('criado_em'),
      supabase.from('disciplinas').select('id, nome').order('nome')
    ])
    setColaboradores(cols || [])
    setDisciplinas(discs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, password: form.password, nome: form.nome, telefone: form.telefone, nivel: form.nivel })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error creating user')
      const userId = data.id
      if (form.nivel === 'professor' && form.disciplinas.length > 0) {
        await supabase.from('professor_disciplinas').insert(form.disciplinas.map(d => ({ professor_id: userId, disciplina_id: d })))
      }
      if (form.nivel === 'professor' && form.horarios.length > 0) {
        await supabase.from('professor_horarios').insert(form.horarios.map(h => ({ professor_id: userId, ...h })))
      }
      setShowForm(false)
      setForm({ nome: '', email: '', telefone: '', password: '', nivel: 'professor', disciplinas: [], horarios: [] })
      await load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0d14', padding:'32px 40px' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:32 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:700, color:'#f1f5f9', margin:0 }}>Collaborators</h1>
            <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Manage professors and coordinators</p>
          </div>
          <button onClick={() => setShowForm(true)} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:10, padding:'10px 20px', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>
            + New Collaborator
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', color:'#475569', padding:60 }}>Loading...</div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {colaboradores.map(c => (
              <div key={c.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'16px 20px', display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ width:40, height:40, borderRadius:10, background: c.nivel === 'coordenador' ? 'linear-gradient(135deg,#6366f1,#8b5cf6)' : 'linear-gradient(135deg,#0891b2,#0d9488)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'white', flexShrink:0 }}>
                  {c.nome.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>{c.nome}</div>
                  <div style={{ fontSize:12, color:'#64748b' }}>{c.email}{c.telefone ? ` · ${c.telefone}` : ''}</div>
                </div>
                <div style={{ background: c.nivel === 'coordenador' ? 'rgba(99,102,241,0.15)' : 'rgba(8,145,178,0.15)', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600, color: c.nivel === 'coordenador' ? '#a78bfa' : '#22d3ee' }}>
                  {c.nivel === 'coordenador' ? 'Coordinator' : 'Professor'}
                </div>
              </div>
            ))}
            {colaboradores.length === 0 && <div style={{ textAlign:'center', color:'#475569', padding:60 }}>No collaborators yet.</div>}
          </div>
        )}

        {showForm && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:20 }}>
            <div style={{ background:'#0f1420', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:32, width:'100%', maxWidth:580, maxHeight:'90vh', overflowY:'auto' }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', marginBottom:24 }}>New Collaborator</h2>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                {[{label:'FULL NAME',key:'nome',type:'text',ph:'Full name'},{label:'E-MAIL',key:'email',type:'email',ph:'email@example.com'},{label:'PHONE',key:'telefone',type:'tel',ph:'(00) 00000-0000'},{label:'PASSWORD',key:'password',type:'password',ph:'••••••••'}].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>{f.label}</label>
                    <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                      style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                  </div>
                ))}
              </div>
              <div style={{ marginBottom:20 }}>
                <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:8 }}>ROLE</label>
                <div style={{ display:'flex', gap:8 }}>
                  {(['professor','coordenador'] as const).map(n => (
                    <button key={n} onClick={() => setForm(f => ({ ...f, nivel: n }))}
                      style={{ flex:1, padding:'9px', borderRadius:8, border:'1px solid', borderColor: form.nivel===n ? '#6366f1' : 'rgba(255,255,255,0.1)', background: form.nivel===n ? 'rgba(99,102,241,0.15)' : 'transparent', color: form.nivel===n ? '#a78bfa' : '#64748b', fontSize:13, fontWeight:600, cursor:'pointer' }}>
                      {n === 'professor' ? 'Professor' : 'Coordinator'}
                    </button>
                  ))}
                </div>
              </div>
              {form.nivel === 'professor' && (
                <>
                  <div style={{ marginBottom:20 }}>
                    <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:8 }}>DISCIPLINES</label>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                      {disciplinas.map(d => (
                        <button key={d.id} onClick={() => toggleDisciplina(d.id)}
                          style={{ padding:'5px 10px', borderRadius:6, border:'1px solid', borderColor: form.disciplinas.includes(d.id) ? '#6366f1' : 'rgba(255,255,255,0.08)', background: form.disciplinas.includes(d.id) ? 'rgba(99,102,241,0.15)' : 'transparent', color: form.disciplinas.includes(d.id) ? '#a78bfa' : '#64748b', fontSize:11, cursor:'pointer' }}>
                          {d.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500 }}>AVAILABILITY</label>
                      <button onClick={addHorario} style={{ fontSize:11, color:'#a78bfa', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>+ Add slot</button>
                    </div>
                    {form.horarios.map((h, i) => (
                      <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
                        <select value={h.dia_semana} onChange={e => updateHorario(i, 'dia_semana', Number(e.target.value))}
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px', color:'#e2e8f0', fontSize:12, outline:'none' }}>
                          {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                        </select>
                        <input type="time" value={h.hora_inicio} onChange={e => updateHorario(i, 'hora_inicio', e.target.value)}
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px', color:'#e2e8f0', fontSize:12, outline:'none' }} />
                        <span style={{ color:'#475569', fontSize:12 }}>to</span>
                        <input type="time" value={h.hora_fim} onChange={e => updateHorario(i, 'hora_fim', e.target.value)}
                          style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px', color:'#e2e8f0', fontSize:12, outline:'none' }} />
                        <button onClick={() => removeHorario(i)} style={{ background:'rgba(239,68,68,0.1)', border:'none', borderRadius:6, padding:'6px 10px', color:'#f87171', cursor:'pointer', fontSize:12 }}>✕</button>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#f87171', marginBottom:16 }}>{error}</div>}
              <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
                <button onClick={() => { setShowForm(false); setError('') }} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'10px 20px', color:'#94a3b8', fontSize:13, cursor:'pointer' }}>Cancel</button>
                <button onClick={handleSubmit} disabled={saving} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:10, padding:'10px 20px', color:'white', fontSize:13, fontWeight:600, cursor:saving ? 'not-allowed' : 'pointer', opacity:saving ? 0.7 : 1 }}>
                  {saving ? 'Saving...' : 'Create Collaborator'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
