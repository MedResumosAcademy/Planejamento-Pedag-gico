'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { useSession } from '@/hooks/useSession'
import { getGravacoesByWeek, createGravacao, updateGravacao } from '@/lib/repositories/gravacoes'
import { getAllDisciplinas, getAllTemas, getDisciplinasByIds } from '@/lib/repositories/disciplinas'
import RecordingDetailModal from '@/components/RecordingDetailModal'
import BackButton from '@/components/BackButton'
import type { Gravacao, Disciplina, Tema } from '@/types'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_COLOR: Record<string, string> = { proposta: '#fbbf24', aprovada: '#60a5fa', concluida: '#4ade80', cancelada: '#f87171' }
const STATUS_LABEL: Record<string, string> = { proposta: 'Proposed', aprovada: 'Approved', concluida: 'Recorded', cancelada: 'Cancelled' }
const periods = [
  { key: 'manha', label: '🌅 Morning', range: '00:00–12:00' },
  { key: 'tarde', label: '☀️ Afternoon', range: '12:00–18:00' },
  { key: 'noite', label: '🌙 Evening', range: '18:00–24:00' },
]

function getWeekDates(offset = 0) {
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - now.getDay() + 1 + offset * 7)
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d })
}

function getPeriod(iso: string): 'manha' | 'tarde' | 'noite' {
  const h = parseInt(iso.slice(11, 13))
  return h < 12 ? 'manha' : h < 18 ? 'tarde' : 'noite'
}

export default function AgendaPage() {
  const { session, loading: sessionLoading, isCoordinator, isProfessor } = useSession()
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([])
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [temas, setTemas] = useState<Tema[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [selectedGravacao, setSelectedGravacao] = useState<Gravacao | null>(null)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ disciplina_id: 0, tema_id: 0, data: '', hora: '09:00', duracao_minutos: 60, observacoes: '' })
  const weekDates = getWeekDates(weekOffset)

  const load = useCallback(async () => {
    if (!session) return
    setLoading(true)
    try {
      const start = weekDates[0].toISOString().split('T')[0]
      const end = weekDates[6].toISOString().split('T')[0]
      const [gravs, discs, ts] = await Promise.all([
        getGravacoesByWeek(start, end),
        isProfessor && session.disciplina_ids?.length ? getDisciplinasByIds(session.disciplina_ids) : getAllDisciplinas(),
        getAllTemas(),
      ])
      setGravacoes(gravs)
      setDisciplinas(discs)
      setTemas(ts)
    } catch (e) { console.error('Failed to load agenda:', e) }
    setLoading(false)
  }, [weekOffset, session])

  useEffect(() => { load() }, [load])

  async function handleSubmit() {
    if (!form.disciplina_id || !form.tema_id || !form.data || !session) return
    setSaving(true)
    try {
      await createGravacao({ professor_id: session.id, disciplina_id: form.disciplina_id, tema_id: form.tema_id, data_hora: `${form.data}T${form.hora}:00`, duracao_minutos: form.duracao_minutos, observacoes: form.observacoes })
      setShowForm(false)
      setForm({ disciplina_id: 0, tema_id: 0, data: '', hora: '09:00', duracao_minutos: 60, observacoes: '' })
      await load()
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function quickApprove(id: number, status: 'aprovada' | 'cancelada') {
    await updateGravacao(id, { status }); await load()
  }

  const filteredTemas = temas.filter(t => t.disciplina_id === form.disciplina_id)
  const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

  if (sessionLoading) return null

  return (
    <div style={{ minHeight: '100vh', background: '#0a0d14', padding: '32px 40px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <BackButton />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>📅 Recording Schedule</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Shared weekly calendar — all professors</p>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#94a3b8', cursor: 'pointer' }}>←</button>
            <span style={{ fontSize: 12, color: '#64748b', minWidth: 140, textAlign: 'center' }}>
              {weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – {weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
            <button onClick={() => setWeekOffset(0)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 12px', color: '#94a3b8', cursor: 'pointer', fontSize: 11 }}>Today</button>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#94a3b8', cursor: 'pointer' }}>→</button>
            <button onClick={() => setShowForm(true)} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '10px 18px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 8 }}>+ Propose Recording</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_COLOR).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: v, display: 'inline-block' }} />{STATUS_LABEL[k]}
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ padding: '12px 8px', borderRight: '1px solid rgba(255,255,255,0.04)' }} />
            {weekDates.map((date, i) => {
              const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
              return (
                <div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderRight: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isToday ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{DAYS[date.getDay()]}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: isToday ? '#a78bfa' : '#e2e8f0' }}>{date.getDate()}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>{date.toLocaleDateString('pt-BR', { month: 'short' })}</div>
                </div>
              )
            })}
          </div>
          {periods.map((period, pi) => (
            <div key={period.key} style={{ display: 'grid', gridTemplateColumns: '90px repeat(7, 1fr)', borderBottom: pi < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ padding: '16px 8px', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{period.label}</div>
                <div style={{ fontSize: 9, color: '#475569' }}>{period.range}</div>
              </div>
              {weekDates.map((date, di) => {
                const dateStr = date.toISOString().split('T')[0]
                const isToday = dateStr === new Date().toISOString().split('T')[0]
                const cellGravs = gravacoes.filter(g => g.data_hora.startsWith(dateStr) && getPeriod(g.data_hora) === period.key)
                return (
                  <div key={di} style={{ minHeight: 100, padding: 6, borderRight: di < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isToday ? 'rgba(99,102,241,0.02)' : 'transparent', display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {cellGravs.map(g => {
                      const isOwn = g.professor_id === session?.id
                      const canOpen = isOwn || isCoordinator
                      return (
                        <div key={g.id} onClick={() => canOpen && setSelectedGravacao(g)}
                          style={{ background: `${STATUS_COLOR[g.status]}18`, border: `1px solid ${STATUS_COLOR[g.status]}50`, borderRadius: 8, padding: '6px 8px', cursor: canOpen ? 'pointer' : 'default', opacity: g.status === 'cancelada' ? 0.5 : 1, transition: 'transform 0.15s' }}
                          onMouseEnter={e => { if (canOpen) (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}>
                          <div style={{ fontSize: 9, color: STATUS_COLOR[g.status], fontWeight: 700 }}>
                            {g.data_hora.slice(11, 16)} · {g.colaboradores?.nome?.split(' ')[0]}
                            {!isOwn && <span style={{ marginLeft: 4, opacity: 0.6 }}>🔒</span>}
                          </div>
                          <div style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 600, marginTop: 2 }}>{g.disciplinas?.nome?.slice(0, 16)}{(g.disciplinas?.nome?.length || 0) > 16 ? '…' : ''}</div>
                          <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>{g.temas?.tema_especifico?.slice(0, 22)}{(g.temas?.tema_especifico?.length || 0) > 22 ? '…' : ''}</div>
                          {g.links?.length > 0 && <div style={{ fontSize: 9, color: '#60a5fa', marginTop: 2 }}>🔗 {g.links.length}</div>}
                          {isCoordinator && g.status === 'proposta' && (
                            <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
                              <button onClick={e => { e.stopPropagation(); quickApprove(g.id, 'aprovada') }} style={{ fontSize: 8, background: 'rgba(96,165,250,0.2)', border: 'none', borderRadius: 3, padding: '2px 5px', color: '#60a5fa', cursor: 'pointer', fontWeight: 700 }}>✓</button>
                              <button onClick={e => { e.stopPropagation(); quickApprove(g.id, 'cancelada') }} style={{ fontSize: 8, background: 'rgba(248,113,113,0.2)', border: 'none', borderRadius: 3, padding: '2px 5px', color: '#f87171', cursor: 'pointer', fontWeight: 700 }}>✕</button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {isCoordinator && gravacoes.filter(g => g.status === 'proposta').length > 0 && (
          <div>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⏳ Pending Approvals ({gravacoes.filter(g => g.status === 'proposta').length})
            </h2>
            {gravacoes.filter(g => g.status === 'proposta').map(g => (
              <div key={g.id} style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{g.colaboradores?.nome}</div>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{g.disciplinas?.nome} · {g.temas?.tema_especifico}</div>
                  <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>{new Date(g.data_hora).toLocaleString('pt-BR')} · {g.duracao_minutos} min</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setSelectedGravacao(g)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#94a3b8', fontSize: 12, cursor: 'pointer' }}>Details</button>
                  <button onClick={() => quickApprove(g.id, 'aprovada')} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, padding: '8px 16px', color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Approve</button>
                  <button onClick={() => quickApprove(g.id, 'cancelada')} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 14px', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕ Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedGravacao && session && (
        <RecordingDetailModal gravacao={selectedGravacao} session={session} onClose={() => setSelectedGravacao(null)} onSaved={load} />
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 24 }}>Propose Recording</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Discipline</label>
                <select value={form.disciplina_id} onChange={e => setForm(f => ({ ...f, disciplina_id: Number(e.target.value), tema_id: 0 }))} style={inp}>
                  <option value={0}>Select...</option>
                  {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Topic</label>
                <select value={form.tema_id} onChange={e => setForm(f => ({ ...f, tema_id: Number(e.target.value) }))} disabled={!form.disciplina_id} style={{ ...inp, color: form.disciplina_id ? '#e2e8f0' : '#475569' }}>
                  <option value={0}>Select...</option>
                  {filteredTemas.map(t => <option key={t.id} value={t.id}>{t.tema_especifico}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Date</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Time</label>
                  <input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} style={inp} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Min</label>
                  <input type="number" value={form.duracao_minutos} onChange={e => setForm(f => ({ ...f, duracao_minutos: Number(e.target.value) }))} min={15} step={15} style={inp} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Notes</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Optional..." style={{ ...inp, resize: 'none' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={handleSubmit} disabled={saving || !form.disciplina_id || !form.tema_id || !form.data}
                style={{ flex: 2, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '11px', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: (saving || !form.disciplina_id || !form.tema_id || !form.data) ? 0.5 : 1 }}>
                {saving ? 'Saving...' : 'Propose Recording'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
