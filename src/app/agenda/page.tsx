'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Gravacao {
  id: number; professor_id: string; disciplina_id: number; tema_id: number
  data_hora: string; duracao_minutos: number; status: string
  observacoes: string | null; links: { label: string; url: string }[]
  concluida_em: string | null
  colaboradores?: { nome: string }
  disciplinas?: { nome: string; cor: string }
  temas?: { tema_especifico: string }
}
interface Disciplina { id: number; nome: string; cor: string }
interface Tema { id: number; disciplina_id: number; tema_especifico: string }

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_COLOR: Record<string, string> = {
  proposta: '#fbbf24', aprovada: '#60a5fa', concluida: '#4ade80', cancelada: '#f87171'
}
const STATUS_LABEL: Record<string, string> = {
  proposta: 'Proposed', aprovada: 'Approved', concluida: 'Recorded', cancelada: 'Cancelled'
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

function getPeriod(hora: string): 'manha' | 'tarde' | 'noite' {
  const h = parseInt(hora.slice(11, 13))
  if (h < 12) return 'manha'
  if (h < 18) return 'tarde'
  return 'noite'
}

const periods = [
  { key: 'manha', label: '🌅 Morning', range: '00:00–12:00' },
  { key: 'tarde', label: '☀️ Afternoon', range: '12:00–18:00' },
  { key: 'noite', label: '🌙 Evening', range: '18:00–24:00' },
]

export default function AgendaPage() {
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([])
  const [disciplinas, setDisciplinas] = useState<Disciplina[]>([])
  const [temas, setTemas] = useState<Tema[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)
  const [showForm, setShowForm] = useState(false)
  const [selectedGravacao, setSelectedGravacao] = useState<Gravacao | null>(null)
  const [saving, setSaving] = useState(false)
  const [userInfo, setUserInfo] = useState<{ id: string; nivel: string } | null>(null)
  const [form, setForm] = useState({
    disciplina_id: 0, tema_id: 0, data: '', hora: '09:00',
    duracao_minutos: 60, observacoes: ''
  })
  const [detailForm, setDetailForm] = useState({
    status: '', observacoes: '', links: [] as { label: string; url: string }[]
  })

  const supabase = createClient()
  const weekDates = getWeekDates(weekOffset)

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: colab } = await supabase.from('colaboradores').select('nivel').eq('id', user.id).single()
    setUserInfo({ id: user.id, nivel: colab?.nivel || '' })

    const startDate = weekDates[0].toISOString().split('T')[0]
    const endDate = weekDates[6].toISOString().split('T')[0]

    const [{ data: gravs }, { data: discs }, { data: ts }] = await Promise.all([
      supabase.from('gravacoes')
        .select('*, colaboradores(nome), disciplinas(nome, cor), temas(tema_especifico)')
        .gte('data_hora', startDate)
        .lte('data_hora', endDate + 'T23:59:59')
        .order('data_hora'),
      supabase.from('disciplinas').select('id, nome, cor').order('nome'),
      supabase.from('temas').select('id, disciplina_id, tema_especifico').order('ordem'),
    ])

    setGravacoes(gravs || [])
    setDisciplinas(discs || [])
    setTemas(ts || [])
    setLoading(false)
  }, [weekOffset])

  useEffect(() => { load() }, [load])

  function openDetail(g: Gravacao) {
    setSelectedGravacao(g)
    setDetailForm({
      status: g.status,
      observacoes: g.observacoes || '',
      links: g.links || []
    })
  }

  async function saveDetail() {
    if (!selectedGravacao) return
    setSaving(true)
    const updates: any = {
      status: detailForm.status,
      observacoes: detailForm.observacoes,
      links: detailForm.links,
    }
    if (detailForm.status === 'concluida' && selectedGravacao.status !== 'concluida') {
      updates.concluida_em = new Date().toISOString()
    }
    await supabase.from('gravacoes').update(updates).eq('id', selectedGravacao.id)
    setSelectedGravacao(null)
    await load()
    setSaving(false)
  }

  async function handleSubmit() {
    if (!form.disciplina_id || !form.tema_id || !form.data) return
    setSaving(true)
    await supabase.from('gravacoes').insert({
      professor_id: userInfo!.id,
      disciplina_id: form.disciplina_id,
      tema_id: form.tema_id,
      data_hora: `${form.data}T${form.hora}:00`,
      duracao_minutos: form.duracao_minutos,
      observacoes: form.observacoes || null,
      links: [],
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

  function addLink() {
    setDetailForm(f => ({ ...f, links: [...f.links, { label: '', url: '' }] }))
  }

  function updateLink(i: number, field: string, value: string) {
    setDetailForm(f => {
      const links = [...f.links]
      links[i] = { ...links[i], [field]: value }
      return { ...f, links }
    })
  }

  function removeLink(i: number) {
    setDetailForm(f => ({ ...f, links: f.links.filter((_, idx) => idx !== i) }))
  }

  const isCoordinator = userInfo?.nivel === 'coordenador'
  const filteredTemas = temas.filter(t => t.disciplina_id === form.disciplina_id)

  const inputStyle = {
    width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none',
    boxSizing: 'border-box' as const
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0d14', padding: '32px 40px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>📅 Recording Schedule</h1>
            <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>Weekly recording calendar — all professors</p>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <button onClick={() => setWeekOffset(w => w - 1)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>←</button>
            <span style={{ fontSize: 13, color: '#64748b', minWidth: 140, textAlign: 'center' }}>
              {weekDates[0].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })} – {weekDates[6].toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}
            </span>
            <button onClick={() => setWeekOffset(0)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#94a3b8', cursor: 'pointer', fontSize: 12 }}>Today</button>
            <button onClick={() => setWeekOffset(w => w + 1)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '8px 14px', color: '#94a3b8', cursor: 'pointer', fontSize: 14 }}>→</button>
            <button onClick={() => setShowForm(true)} style={{ background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '10px 18px', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginLeft: 8 }}>
              + Propose Recording
            </button>
          </div>
        </div>

        {/* Legend */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
          {Object.entries(STATUS_COLOR).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: v, display: 'inline-block' }} />
              {STATUS_LABEL[k]}
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#64748b' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.2)', display: 'inline-block' }} />
            Other professor (read-only)
          </div>
        </div>

        {/* Calendar grid */}
        <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 16, overflow: 'hidden' }}>
          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: '90px repeat(7, 1fr)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            <div style={{ padding: '12px 8px', borderRight: '1px solid rgba(255,255,255,0.04)' }} />
            {weekDates.map((date, i) => {
              const isToday = date.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]
              return (
                <div key={i} style={{ padding: '12px 8px', textAlign: 'center', borderRight: i < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none', background: isToday ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                  <div style={{ fontSize: 10, color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>{DAYS[date.getDay()]}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: isToday ? '#a78bfa' : '#e2e8f0', marginTop: 2 }}>{date.getDate()}</div>
                  <div style={{ fontSize: 10, color: '#475569' }}>{date.toLocaleDateString('pt-BR', { month: 'short' })}</div>
                </div>
              )
            })}
          </div>

          {/* Period rows */}
          {periods.map((period, pi) => (
            <div key={period.key} style={{ display: 'grid', gridTemplateColumns: '90px repeat(7, 1fr)', borderBottom: pi < 2 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
              <div style={{ padding: '16px 8px', borderRight: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: 4 }}>
                <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>{period.label}</div>
                <div style={{ fontSize: 9, color: '#475569' }}>{period.range}</div>
              </div>
              {weekDates.map((date, di) => {
                const dateStr = date.toISOString().split('T')[0]
                const isToday = dateStr === new Date().toISOString().split('T')[0]
                const cellGravs = gravacoes.filter(g =>
                  g.data_hora.startsWith(dateStr) && getPeriod(g.data_hora) === period.key
                )
                return (
                  <div key={di} style={{
                    minHeight: 100, padding: 6,
                    borderRight: di < 6 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    background: isToday ? 'rgba(99,102,241,0.03)' : 'transparent',
                    display: 'flex', flexDirection: 'column', gap: 4
                  }}>
                    {cellGravs.map(g => {
                      const isOwn = g.professor_id === userInfo?.id
                      const canEdit = isOwn || isCoordinator
                      return (
                        <div key={g.id}
                          onClick={() => canEdit ? openDetail(g) : null}
                          style={{
                            background: canEdit ? `${STATUS_COLOR[g.status]}18` : 'rgba(255,255,255,0.04)',
                            border: `1px solid ${canEdit ? STATUS_COLOR[g.status] + '50' : 'rgba(255,255,255,0.1)'}`,
                            borderRadius: 8, padding: '6px 8px',
                            cursor: canEdit ? 'pointer' : 'default',
                            opacity: g.status === 'cancelada' ? 0.5 : 1,
                            transition: 'all 0.15s'
                          }}
                          onMouseEnter={e => { if (canEdit) (e.currentTarget as HTMLElement).style.transform = 'scale(1.01)' }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                            <div style={{ fontSize: 9, color: canEdit ? STATUS_COLOR[g.status] : '#64748b', fontWeight: 700 }}>
                              {g.data_hora.slice(11, 16)}
                            </div>
                            {!isOwn && <span style={{ fontSize: 8, color: '#475569', background: 'rgba(255,255,255,0.05)', borderRadius: 3, padding: '1px 4px' }}>🔒</span>}
                          </div>
                          <div style={{ fontSize: 10, color: '#cbd5e1', fontWeight: 600, marginTop: 2, lineHeight: 1.3 }}>
                            {g.colaboradores?.nome?.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 1, lineHeight: 1.3 }}>
                            {g.disciplinas?.nome?.slice(0, 16)}{(g.disciplinas?.nome?.length || 0) > 16 ? '…' : ''}
                          </div>
                          <div style={{ fontSize: 9, color: '#64748b', marginTop: 1 }}>
                            {g.temas?.tema_especifico?.slice(0, 22)}{(g.temas?.tema_especifico?.length || 0) > 22 ? '…' : ''}
                          </div>
                          {g.links && g.links.length > 0 && (
                            <div style={{ fontSize: 9, color: '#60a5fa', marginTop: 3 }}>🔗 {g.links.length} link{g.links.length > 1 ? 's' : ''}</div>
                          )}
                          {/* Coordinator approve/reject buttons */}
                          {isCoordinator && g.status === 'proposta' && (
                            <div style={{ display: 'flex', gap: 3, marginTop: 5 }}>
                              <button onClick={e => { e.stopPropagation(); updateStatus(g.id, 'aprovada') }}
                                style={{ fontSize: 8, background: 'rgba(96,165,250,0.2)', border: 'none', borderRadius: 3, padding: '2px 6px', color: '#60a5fa', cursor: 'pointer', fontWeight: 700 }}>✓ Approve</button>
                              <button onClick={e => { e.stopPropagation(); updateStatus(g.id, 'cancelada') }}
                                style={{ fontSize: 8, background: 'rgba(248,113,113,0.2)', border: 'none', borderRadius: 3, padding: '2px 6px', color: '#f87171', cursor: 'pointer', fontWeight: 700 }}>✕</button>
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

        {/* Pending approvals for coordinator */}
        {isCoordinator && gravacoes.filter(g => g.status === 'proposta').length > 0 && (
          <div style={{ marginTop: 24 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#64748b', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⏳ Pending Approvals ({gravacoes.filter(g => g.status === 'proposta').length})
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {gravacoes.filter(g => g.status === 'proposta').map(g => (
                <div key={g.id} style={{ background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#e2e8f0' }}>{g.colaboradores?.nome}</div>
                    <div style={{ fontSize: 12, color: '#64748b' }}>{g.disciplinas?.nome} · {g.temas?.tema_especifico}</div>
                    <div style={{ fontSize: 11, color: '#fbbf24', marginTop: 2 }}>{new Date(g.data_hora).toLocaleString('pt-BR')}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => updateStatus(g.id, 'aprovada')} style={{ background: 'rgba(96,165,250,0.15)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 8, padding: '8px 16px', color: '#60a5fa', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✓ Approve</button>
                    <button onClick={() => updateStatus(g.id, 'cancelada')} style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: 8, padding: '8px 16px', color: '#f87171', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✕ Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedGravacao && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto' }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Recording Details</h2>
                <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{selectedGravacao.colaboradores?.nome}</div>
              </div>
              <button onClick={() => setSelectedGravacao(null)} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>

            {/* Info */}
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{selectedGravacao.disciplinas?.nome}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{selectedGravacao.temas?.tema_especifico}</div>
              <div style={{ fontSize: 12, color: '#64748b' }}>
                📅 {new Date(selectedGravacao.data_hora).toLocaleString('pt-BR')} · ⏱ {selectedGravacao.duracao_minutos} min
              </div>
              {selectedGravacao.concluida_em && (
                <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>
                  ✅ Recorded on {new Date(selectedGravacao.concluida_em).toLocaleDateString('pt-BR')}
                </div>
              )}
            </div>

            {/* Status */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Status</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['proposta', 'aprovada', 'concluida', 'cancelada'] as const).map(s => (
                  <button key={s} onClick={() => setDetailForm(f => ({ ...f, status: s }))}
                    disabled={!isCoordinator && selectedGravacao.professor_id !== userInfo?.id}
                    style={{
                      padding: '7px 14px', borderRadius: 8, border: '1px solid',
                      borderColor: detailForm.status === s ? STATUS_COLOR[s] : 'rgba(255,255,255,0.08)',
                      background: detailForm.status === s ? `${STATUS_COLOR[s]}20` : 'transparent',
                      color: detailForm.status === s ? STATUS_COLOR[s] : '#64748b',
                      fontSize: 12, fontWeight: 600, cursor: 'pointer'
                    }}>
                    {STATUS_LABEL[s]}
                  </button>
                ))}
              </div>
            </div>

            {/* Observations */}
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Observations</label>
              <textarea value={detailForm.observacoes} onChange={e => setDetailForm(f => ({ ...f, observacoes: e.target.value }))}
                rows={3} placeholder="Add notes about this recording..."
                style={{ ...inputStyle, resize: 'none' }} />
            </div>

            {/* Links */}
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>External Links</label>
                <button onClick={addLink} style={{ fontSize: 11, color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add link</button>
              </div>
              {detailForm.links.map((link, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
                  <input value={link.label} onChange={e => updateLink(i, 'label', e.target.value)} placeholder="Label (e.g. Drive, YouTube...)"
                    style={{ ...inputStyle, flex: 1 }} />
                  <input value={link.url} onChange={e => updateLink(i, 'url', e.target.value)} placeholder="https://..."
                    style={{ ...inputStyle, flex: 2 }} />
                  <button onClick={() => removeLink(i)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, padding: '8px 10px', color: '#f87171', cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>✕</button>
                </div>
              ))}
              {/* Show existing links as clickable */}
              {detailForm.links.filter(l => l.url).map((link, i) => (
                <div key={`view-${i}`} style={{ display: 'none' }} />
              ))}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSelectedGravacao(null)} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Cancel</button>
              <button onClick={saveDetail} disabled={saving}
                style={{ flex: 2, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '11px', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Propose Recording Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 }}>
          <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 480 }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: '#f1f5f9', marginBottom: 24 }}>Propose Recording</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Discipline</label>
                <select value={form.disciplina_id} onChange={e => setForm(f => ({ ...f, disciplina_id: Number(e.target.value), tema_id: 0 }))}
                  style={{ ...inputStyle }}>
                  <option value={0}>Select a discipline...</option>
                  {disciplinas.map(d => <option key={d.id} value={d.id}>{d.nome}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Topic</label>
                <select value={form.tema_id} onChange={e => setForm(f => ({ ...f, tema_id: Number(e.target.value) }))} disabled={!form.disciplina_id}
                  style={{ ...inputStyle, color: form.disciplina_id ? '#e2e8f0' : '#475569' }}>
                  <option value={0}>Select a topic...</option>
                  {filteredTemas.map(t => <option key={t.id} value={t.id}>{t.tema_especifico}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div style={{ gridColumn: 'span 1' }}>
                  <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Date</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Time</label>
                  <input type="time" value={form.hora} onChange={e => setForm(f => ({ ...f, hora: e.target.value }))} style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Duration (min)</label>
                  <input type="number" value={form.duracao_minutos} onChange={e => setForm(f => ({ ...f, duracao_minutos: Number(e.target.value) }))} min={15} step={15} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Notes (optional)</label>
                <textarea value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} rows={2} placeholder="Any observations..."
                  style={{ ...inputStyle, resize: 'none' }} />
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
