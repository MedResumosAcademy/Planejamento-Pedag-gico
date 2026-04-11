'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Disciplina { id: number; nome: string }
interface Colaborador {
  id: string; nome: string; email: string; telefone: string | null
  nivel: 'coordenador' | 'professor'; criado_em: string
  professor_disciplinas?: { disciplina_id: number }[]
  professor_horarios?: { dia_semana: number; hora_inicio: string; hora_fim: string }[]
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function ColaboradoresPage() {
  const router = useRouter()
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteName, setInviteName] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
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
      supabase.from('colaboradores')
        .select('*, professor_disciplinas(disciplina_id), professor_horarios(dia_semana, hora_inicio, hora_fim)')
        .order('criado_em'),
      supabase.from('disciplinas').select('id, nome').order('nome')
    ])
    setColaboradores(cols || [])
    setDisciplinas(discs || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function toggleDisciplina(id: number) {
    setForm(f => ({ ...f, disciplinas: f.disciplinas.includes(id) ? f.disciplinas.filter(d => d !== id) : [...f.disciplinas, id] }))
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
    setSaving(true); setError('')
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

  async function handleInviteCoordinator() {
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/admin/invite-coordinator', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail, nome: inviteName })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error sending invite')
      setShowInviteForm(false)
      setInviteEmail(''); setInviteName('')
      alert('Invite sent!')
      await load()
    } catch (e: any) { setError(e.message) }
    setSaving(false)
  }

  const professors = colaboradores.filter(c => c.nivel === 'professor')
  const coordinators = colaboradores.filter(c => c.nivel === 'coordenador')

  return (
    <div style={{ minHeight:'100vh', background:'#0a0d14', padding:'32px 40px' }}>
      <div style={{ maxWidth:960, margin:'0 auto' }}>

        {/* Back button */}
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
          ← Back
        </button>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:700, color:'#f1f5f9', margin:0 }}>Collaborators</h1>
            <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>{colaboradores.length} registered · {professors.length} professors · {coordinators.length} coordinators</p>
          </div>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={() => setShowInviteForm(true)} style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.3)', borderRadius:10, padding:'10px 18px', color:'#a78bfa', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              ✉️ Invite Coordinator
            </button>
            <button onClick={() => setShowForm(true)} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:10, padding:'10px 18px', color:'white', fontSize:13, fontWeight:600, cursor:'pointer' }}>
              + New Collaborator
            </button>
          </div>
        </div>

        {/* Professor registration link */}
        <div style={{ background:'rgba(8,145,178,0.08)', border:'1px solid rgba(8,145,178,0.2)', borderRadius:14, padding:'16px 20px', marginBottom:28, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:'#22d3ee', marginBottom:4 }}>📎 Professor Registration Link</div>
            <div style={{ fontSize:12, color:'#64748b' }}>Share this link with professors so they can register themselves</div>
          </div>
          <button onClick={() => { navigator.clipboard.writeText(window.location.origin + '/cadastro/professor'); alert('Link copied!') }}
            style={{ background:'rgba(8,145,178,0.15)', border:'1px solid rgba(8,145,178,0.3)', borderRadius:8, padding:'8px 16px', color:'#22d3ee', fontSize:12, fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
            Copy Link 📋
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign:'center', color:'#475569', padding:60 }}>Loading...</div>
        ) : (
          <>
            {/* Coordinators */}
            {coordinators.length > 0 && (
              <div style={{ marginBottom:28 }}>
                <h2 style={{ fontSize:13, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Coordinators</h2>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {coordinators.map(c => (
                    <div key={c.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'white', flexShrink:0 }}>
                        {c.nome.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>{c.nome}</div>
                        <div style={{ fontSize:12, color:'#64748b' }}>{c.email}{c.telefone ? ` · ${c.telefone}` : ''}</div>
                      </div>
                      <div style={{ background:'rgba(99,102,241,0.15)', borderRadius:6, padding:'4px 10px', fontSize:11, fontWeight:600, color:'#a78bfa' }}>Coordinator</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Professors */}
            <div>
              <h2 style={{ fontSize:13, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:12 }}>Professors ({professors.length})</h2>
              {professors.length === 0 ? (
                <div style={{ background:'rgba(255,255,255,0.02)', border:'1px dashed rgba(255,255,255,0.06)', borderRadius:12, padding:40, textAlign:'center', color:'#475569' }}>
                  No professors registered yet.<br/>
                  <span style={{ fontSize:12, marginTop:8, display:'block' }}>Share the registration link above or add one manually.</span>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {professors.map(c => {
                    const isExpanded = expanded === c.id
                    const discIds = c.professor_disciplinas?.map(d => d.disciplina_id) || []
                    const discNames = discIds.map(id => disciplinas.find(d => d.id === id)?.nome).filter(Boolean)
                    return (
                      <div key={c.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, overflow:'hidden' }}>
                        <div style={{ padding:'14px 18px', display:'flex', alignItems:'center', gap:14 }}>
                          <div style={{ width:38, height:38, borderRadius:10, background:'linear-gradient(135deg,#0891b2,#0d9488)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:15, fontWeight:700, color:'white', flexShrink:0 }}>
                            {c.nome.charAt(0).toUpperCase()}
                          </div>
                          <div style={{ flex:1, cursor:'pointer' }} onClick={() => router.push(`/admin/colaboradores/${c.id}`)}>
                            <div style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>{c.nome}</div>
                            <div style={{ fontSize:12, color:'#64748b' }}>{c.email}{c.telefone ? ` · ${c.telefone}` : ''}</div>
                          </div>
                          <div style={{ fontSize:11, color:'#64748b', marginRight:8 }}>{discNames.length} discipline{discNames.length !== 1 ? 's' : ''}</div>
                          <button onClick={() => router.push(`/admin/colaboradores/${c.id}`)}
                            style={{ background:'rgba(8,145,178,0.1)', border:'1px solid rgba(8,145,178,0.2)', borderRadius:8, padding:'6px 12px', color:'#22d3ee', fontSize:11, fontWeight:600, cursor:'pointer', marginRight:8 }}>
                            View Profile →
                          </button>
                          <button onClick={() => setExpanded(isExpanded ? null : c.id)}
                            style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:8, padding:'6px 10px', color:'#64748b', fontSize:11, cursor:'pointer' }}>
                            {isExpanded ? '▲' : '▼'}
                          </button>
                        </div>
                        {isExpanded && (
                          <div style={{ padding:'0 18px 16px', borderTop:'1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ marginTop:12, display:'flex', gap:24 }}>
                              <div>
                                <div style={{ fontSize:11, color:'#64748b', fontWeight:600, marginBottom:8, textTransform:'uppercase' }}>Disciplines</div>
                                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                  {discNames.length > 0 ? discNames.map(n => (
                                    <span key={n as string} style={{ background:'rgba(8,145,178,0.1)', border:'1px solid rgba(8,145,178,0.2)', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#22d3ee' }}>{n}</span>
                                  )) : <span style={{ fontSize:12, color:'#475569' }}>No disciplines</span>}
                                </div>
                              </div>
                              {c.professor_horarios && c.professor_horarios.length > 0 && (
                                <div>
                                  <div style={{ fontSize:11, color:'#64748b', fontWeight:600, marginBottom:8, textTransform:'uppercase' }}>Availability</div>
                                  <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                                    {c.professor_horarios.map((h, i) => (
                                      <span key={i} style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:6, padding:'4px 10px', fontSize:11, color:'#94a3b8' }}>
                                        {DAYS[h.dia_semana]} {h.hora_inicio.slice(0,5)}–{h.hora_fim.slice(0,5)}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {/* Invite Coordinator Modal */}
        {showInviteForm && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50 }}>
            <div style={{ background:'#0f1420', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:32, width:420 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', marginBottom:24 }}>Invite Coordinator</h2>
              <div style={{ marginBottom:16 }}>
                <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>FULL NAME</label>
                <input value={inviteName} onChange={e => setInviteName(e.target.value)} placeholder="Full name"
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
              </div>
              <div style={{ marginBottom:24 }}>
                <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>E-MAIL</label>
                <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="coordinator@email.com"
                  style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
              </div>
              {error && <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:8, padding:'10px 14px', fontSize:13, color:'#f87171', marginBottom:16 }}>{error}</div>}
              <div style={{ display:'flex', gap:10 }}>
                <button onClick={() => { setShowInviteForm(false); setError('') }} style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'10px', color:'#94a3b8', fontSize:13, cursor:'pointer' }}>Cancel</button>
                <button onClick={handleInviteCoordinator} disabled={saving} style={{ flex:2, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:10, padding:'10px', color:'white', fontSize:13, fontWeight:600, cursor:saving ? 'not-allowed' : 'pointer', opacity:saving ? 0.7 : 1 }}>
                  {saving ? 'Sending...' : 'Send Invite ✉️'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* New Collaborator Modal */}
        {showForm && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:20 }}>
            <div style={{ background:'#0f1420', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:32, width:'100%', maxWidth:560, maxHeight:'90vh', overflowY:'auto' }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', marginBottom:24 }}>New Collaborator</h2>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>
                {[{label:'FULL NAME',key:'nome',type:'text',ph:'Full name'},{label:'E-MAIL',key:'email',type:'email',ph:'email@example.com'},{label:'PHONE',key:'telefone',type:'tel',ph:'(00) 00000-0000'},{label:'PASSWORD',key:'password',type:'password',ph:'••••••••'}].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>{f.label}</label>
                    <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.ph}
                      style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'9px 12px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' as const }} />
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
