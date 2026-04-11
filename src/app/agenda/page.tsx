'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Gravacao {
  id: number; professor_id: string; disciplina_id: number; tema_id: number
  data_hora: string; duracao_minutos: number; status: string; observacoes: string | null
  colaboradores?: { nome: string }
  disciplinas?: { nome: string; cor: string }
  temas?: { tema_especifico: string }
}
interface Disciplina { id: number; nome: string; cor: string }
interface Tema { id: number; disciplina_id: number; tema_especifico: string }
interface Colaborador { id: string; nome: string }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_COLOR: Record<string, string> = {
  proposta: '#fbbf24', aprovada: '#60a5fa', concluida: '#4ade80', cancelada: '#f87171'
}

function getWeekDates(offset = 0) {
  const now = new Date()
  const day = now.getDay()
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1 + offset * 7)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

export default function AgendaPage() {
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([])
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [temas, setTemas] = useState<Tema[]>([])
  const [professores, setProfessores] = useState<Colaborador[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [userInfo, setUserInfo] = useState<{ id: string; nivel: string } | null>(null)
  const [form, setForm] = useState({
    disciplina_id: 0, tema_id: 0, data: '', hora: '09:00',
    duracao_minutos: 60, observacoes: ''
  })

  const supabase = createClient()
  const weekDates = getWeekDates(weekOffset)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: colab } = await supabase.from('colaboradores').select('nivel, nome').eq('id', user.id).single()
    setUserInfo({ id: user.id, nivel: colab?.nivel || '' })

    const startDate = weekDates[0].toISOString().split('T')[0]
    const endDate = weekDates[6].toISOString().split('T')[0]

    let gravsQuery = supabase
      .from('gravacoes')
      .select('*, colaboradores(nome), disciplinas(nome, cor), temas(tema_especifico)')
      .gte('data_hora', startDate)
      .lte('data_hora', endDate + 'T23:59:59')
      .order('data_hora')

    if (colab?.nivel === 'professor') {
      gravsQuery = gravsQuery.eq('professor_id', user.id)
    }

    const [{ data: gravs }, { data: discs }, { data: ts }, { data: profs }] = await Promise.all([
      gravsQuery,
      supabase.from('disciplinas').select('id, nome, cor').order('nome'),
      supabase.from('temas').select('id, disciplina_id, tema_especifico').order('ordem'),
      colab?.nivel === 'coordenador'
        ? supabase.from('colaboradores').select('id, nome').eq('nivel', 'professor').order('nome')
        : Promise.resolve({ data: [] })
    ])

    setGravacoes(gravs || [])
    setDisciplinas(discs || [])
    setTemas(ts || [])
    setProfessores(profs || [])
    setLoading(false)
  }, [weekOffset])

  useEffect(() => { load() }, [load])

  async function handleSubmit() {
    if (!form.disciplina_id || !form.tema_id || !form.data) return
    setSaving(true)
    const data_hora = `${form.data}T${form.hora}:00`
    await supabase.from('gravacoes').insert({
      professor_id: userInfo!.id,
      disciplina_id: form.disciplina_id,
      tema_id: form.tema_id,
      data_hora,
      duracao_minutos: form.duracao_minutos,
      observacoes: form.observacoes || null,
      status: 'proposta'
    })
    setShowForm(false)
    setForm({ disciplina_id: 0, tema_id: 0, data: '', hora: '09:00', duracao_minutos: 60, observacoes: '' })
    await load()
    setSaving(false)
  }

  async function updateStatus(id: number, status: string) {
    await supabase.from('gravacoes').update({ status }).eq('id', id)
    await load()
  }

  const filteredTemas = temas.filter(t => t.disciplina_id === form.disciplina_id)
  const isCoordinator = userInfo?.nivel === 'coordenador'

  return (
    <div style={{ minHeight:'100vh', background:'#0a0d14', padding:'32px 40px' }}>
      <div style={{ maxWidth:1100, margin:'0 auto' }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:28 }}>
          <div>
            <h1 style={{ fontSize:24, fontWeight:700, color:'#f1f5f9', margin:0 }}>Recording Schedule</h1>
            <p style={{ fontSize:13, color:'#64748b', marginTop:4 }}>Weekly recording calendar</p>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 14px', color:'#94a3b8', cursor:'pointer', fontSize:14 }}>←</button>
            <button onClick={() => setWeekOffset(0)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 14px', color:'#94a3b8', cursor:'pointer', fontSize:12 }}>Today</button>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 14px', color:'#94a3b8', cursor:'pointer', fontSize:14 }}>→</button>
            <button onClick={() => setShowForm(true)} style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:10, padding:'10px 18px', color:'white', fontSize:13, fontWeight:600, cursor:'pointer', marginLeft:8 }}>
              + Propose Recording
            </button>
          </div>
        </div>

        {/* Week grid */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(7, 1fr)', gap:8, marginBottom:24 }}>
          {weekDates.map((date, i) => {
            const dateStr = date.toISOString().split('T')[0]
            const dayGravs = gravacoes.filter(g => g.data_hora.startsWith(dateStr))
            const isToday = dateStr === new Date().toISOString().split('T')[0]
            return (
              <div key={i} style={{ background: isToday ? 'rgba(99,102,241,0.08)' : 'rgba(255,255,255,0.02)', border: isToday ? '1px solid rgba(99,102,241,0.3)' : '1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:12, minHeight:160 }}>
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:11, color:'#64748b', fontWeight:600 }}>{DAYS[date.getDay()]}</div>
                  <div style={{ fontSize:20, fontWeight:700, color: isToday ? '#a78bfa' : '#e2e8f0' }}>{date.getDate()}</div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {dayGravs.map(g => (
                    <div key={g.id} style={{ background:`${STATUS_COLOR[g.status]}15`, border:`1px solid ${STATUS_COLOR[g.status]}40`, borderRadius:8, padding:'6px 8px' }}>
                      <div style={{ fontSize:10, color: STATUS_COLOR[g.status], fontWeight:600, marginBottom:2 }}>
                        {g.data_hora.slice(11,16)} · {g.colaboradores?.nome?.split(' ')[0]}
                      </div>
                      <div style={{ fontSize:11, color:'#cbd5e1', fontWeight:500, lineHeight:1.3 }}>
                        {g.disciplinas?.nome}
                      </div>
                      <div style={{ fontSize:10, color:'#64748b', marginTop:2, lineHeight:1.3 }}>
                        {g.temas?.tema_especifico?.slice(0, 30)}{(g.temas?.tema_especifico?.length || 0) > 30 ? '...' : ''}
                      </div>
                      <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                        {g.status === 'proposta' && isCoordinator && (
                          <>
                            <button onClick={() => updateStatus(g.id, 'aprovada')} style={{ fontSize:9, background:'rgba(96,165,250,0.2)', border:'none', borderRadius:4, padding:'2px 6px', color:'#60a5fa', cursor:'pointer', fontWeight:600 }}>Approve</button>
                            <button onClick={() => updateStatus(g.id, 'cancelada')} style={{ fontSize:9, background:'rgba(248,113,113,0.2)', border:'none', borderRadius:4, padding:'2px 6px', color:'#f87171', cursor:'pointer', fontWeight:600 }}>Reject</button>
                          </>
                        )}
                        {g.status === 'aprovada' && (
                          <button onClick={() => updateStatus(g.id, 'concluida')} style={{ fontSize:9, background:'rgba(74,222,128,0.2)', border:'none', borderRadius:4, padding:'2px 6px', color:'#4ade80', cursor:'pointer', fontWeight:600 }}>✓ Done</button>
                        )}
                        <span style={{ fontSize:9, color: STATUS_COLOR[g.status], fontWeight:600, padding:'2px 4px' }}>{g.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Pending approvals for coordinator */}
        {isCoordinator && (
          <div style={{ marginTop:16 }}>
            <h2 style={{ fontSize:14, fontWeight:600, color:'#64748b', marginBottom:12, textTransform:'uppercase', letterSpacing:'0.5px' }}>
              Pending Approvals ({gravacoes.filter(g => g.status === 'proposta').length})
            </h2>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {gravacoes.filter(g => g.status === 'proposta').map(g => (
                <div key={g.id} style={{ background:'rgba(251,191,36,0.05)', border:'1px solid rgba(251,191,36,0.2)', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:16 }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{g.colaboradores?.nome}</div>
                    <div style={{ fontSize:12, color:'#64748b' }}>{g.disciplinas?.nome} · {g.temas?.tema_especifico}</div>
                    <div style={{ fontSize:11, color:'#fbbf24', marginTop:2 }}>{new Date(g.data_hora).toLocaleString('pt-BR')}</div>
                  </div>
                  <div style={{ display:'flex', gap:8 }}>
                    <button onClick={() => updateStatus(g.id, 'aprovada')} style={{ background:'rgba(96,165,250,0.15)', border:'1px solid rgba(96,165,250,0.3)', borderRadius:8, padding:'8px 16px', color:'#60a5fa', fontSize:12, fontWeight:600, cursor:'pointer' }}>✓ Approve</button>
                    <button onClick={() => updateStatus(g.id, 'cancelada')} style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.2)', borderRadius:8, padding:'8px 16px', color:'#f87171', fontSize:12, fontWeight:600, cursor:'pointer' }}>✕ Reject</button>
                  </div>
                </div>
              ))}
              {gravacoes.filter(g => g.status === 'proposta').length === 0 && (
                <div style={{ color:'#475569', fontSize:13 }}>No pending approvals this week.</div>
              )}
            </div>
          </div>
        )}

        {/* Propose recording modal */}
        {showForm && (
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, padding:20 }}>
            <div style={{ background:'#0f1420', border:'1px solid rgba(255,255,255,0.1)', borderRadius:20, padding:32, width:'100%', maxWidth:480 }}>
              <h2 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', marginBottom:24 }}>Propose Recording</h2>
              <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
                <div>
                  <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>DISCIPLINE</label>
                  <select value={form.disciplina_id} onChange={e => setForm(f => ({ ...f, disciplina_id: Number(e.target.value), tema_id: 0 }))}
                    style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px', color:'#e2e8f0', fontSize:13, outline:'none' }}>
                    <option value={0}>Select a discipline...</option>
                    {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>TOPIC</label>
                  <select value={form.tema_id} onChange={e => setForm(f => ({ ...f, tema_id: Number(e.target.value) }))} disabled={!form.disciplina_id}
                    style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px', color: form.disciplina_id ? '#e2e8f0' : '#475569', fontSize:13, outline:'none' }}>
                    <option value={0}>Select a topic...</option>
                    {filteredTemas.map(t => <option key={t.id} value={t.id}>{t.tema_especifico}</option>)}
                  </select>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <div>
                    <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>DATE</label>
                    <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))}
                      style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                  </div>
                  <div>
                    <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>TIME</label>
                    <input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))}
                      style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>DURATION (minutes)</label>
                  <input type="number" value={form.duracao_minutos} onChange={e => setForm(f => ({ ...f, duracao_minutos: Number(e.target.value) }))} min={15} step={15}
                    style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px', color:'#e2e8f0', fontSize:13, outline:'none', boxSizing:'border-box' }} />
                </div>
                <div>
                  <label style={{ fontSize:11, color:'#94a3b8', fontWeight:500, display:'block', marginBottom:6 }}>NOTES (optional)</label>
                  <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Any observations..."
                    style={{ width:'100%', background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px', color:'#e2e8f0', fontSize:13, outline:'none', resize:'none', boxSizing:'border-box' }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:10, marginTop:24 }}>
                <button onClick={() => setShowForm(false)} style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:10, padding:'11px', color:'#94a3b8', fontSize:13, cursor:'pointer' }}>Cancel</button>
                <button onClick={handleSubmit} disabled={saving || !form.disciplina_id || !form.tema_id || !form.data}
                  style={{ flex:2, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:10, padding:'11px', color:'white', fontSize:13, fontWeight:600, cursor:saving ? 'not-allowed' : 'pointer', opacity:(saving || !form.disciplina_id || !form.tema_id || !form.data) ? 0.5 : 1 }}>
                  {saving ? 'Saving...' : 'Propose Recording'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
