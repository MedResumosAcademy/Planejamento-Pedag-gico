'use client'
import { useState } from 'react'
import { updateGravacao } from '@/lib/repositories/gravacoes'
import type { Gravacao, ExternalLink, RecordingStatus, UserSession } from '@/types'

interface Props { gravacao: Gravacao; session: UserSession; onClose: () => void; onSaved: () => void }

const STATUS_COLOR: Record<string, string> = { proposta: '#fbbf24', aprovada: '#60a5fa', concluida: '#4ade80', cancelada: '#f87171' }
const STATUS_LABEL: Record<string, string> = { proposta: 'Proposed', aprovada: 'Approved', concluida: 'Recorded', cancelada: 'Cancelled' }

export default function RecordingDetailModal({ gravacao, session, onClose, onSaved }: Props) {
  const canEdit = gravacao.professor_id === session.id || session.nivel === 'coordenador'
  const isCoordinator = session.nivel === 'coordenador'
  const [status, setStatus] = useState<RecordingStatus>(gravacao.status)
  const [gravada, setGravada] = useState(gravacao.gravada ?? false)
  const [cancelada, setCancelada] = useState(gravacao.cancelada ?? false)
  const [motivoCancelamento, setMotivoCancelamento] = useState(gravacao.motivo_cancelamento || '')
  const [observacoes, setObservacoes] = useState(gravacao.observacoes || '')
  const [links, setLinks] = useState<ExternalLink[]>(gravacao.links || [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function addLink() { setLinks(l => [...l, { label: '', url: '' }]) }
  function removeLink(i: number) { setLinks(l => l.filter((_, idx) => idx !== i)) }
  function updateLink(i: number, field: keyof ExternalLink, value: string) {
    setLinks(l => { const n = [...l]; n[i] = { ...n[i], [field]: value }; return n })
  }

  async function handleSave() {
    setSaving(true); setError('')
    try {
      const updates: Parameters<typeof updateGravacao>[1] = {
        status: gravada ? 'concluida' : cancelada ? 'cancelada' : status,
        gravada,
        cancelada,
        motivo_cancelamento: cancelada ? motivoCancelamento || null : null,
        observacoes: observacoes || null,
        links: links.filter(l => l.url),
      }
      if (gravada && !gravacao.concluida_em) updates.concluida_em = new Date().toISOString()
      await updateGravacao(gravacao.id, updates)
      onSaved(); onClose()
    } catch (e: any) { setError(e.message || 'Error saving') }
    setSaving(false)
  }

  const inp = { width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, padding: '10px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <div style={{ background: '#0f1420', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20, padding: 32, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: '#f1f5f9', margin: 0 }}>Recording Details</h2>
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>{gravacao.colaboradores?.nome}</div>
          </div>
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.05)', border: 'none', borderRadius: 8, padding: '6px 10px', color: '#64748b', cursor: 'pointer', fontSize: 16 }}>✕</button>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#e2e8f0', marginBottom: 4 }}>{gravacao.disciplinas?.nome}</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 8 }}>{gravacao.temas?.tema_especifico}</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>📅 {new Date(gravacao.data_hora).toLocaleString('pt-BR')} · ⏱ {gravacao.duracao_minutos} min</div>
          {gravacao.concluida_em && <div style={{ fontSize: 11, color: '#4ade80', marginTop: 4 }}>✅ Recorded on {new Date(gravacao.concluida_em).toLocaleDateString('pt-BR')}</div>}
        </div>

        {isCoordinator && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Approval Status</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['proposta', 'aprovada', 'cancelada'] as RecordingStatus[]).map(s => (
                <button key={s} onClick={() => setStatus(s)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid', borderColor: status === s ? STATUS_COLOR[s] : 'rgba(255,255,255,0.08)', background: status === s ? `${STATUS_COLOR[s]}20` : 'transparent', color: status === s ? STATUS_COLOR[s] : '#64748b', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        )}

        {canEdit && (
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Recording Status</label>
            <div style={{ display: 'flex', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 16px', borderRadius: 10, border: '1px solid', borderColor: gravada ? '#4ade80' : 'rgba(255,255,255,0.1)', background: gravada ? 'rgba(74,222,128,0.1)' : 'transparent', flex: 1 }}>
                <input type="checkbox" checked={gravada} onChange={e => { setGravada(e.target.checked); if (e.target.checked) setCancelada(false) }} style={{ accentColor: '#4ade80' }} />
                <span style={{ fontSize: 13, color: gravada ? '#4ade80' : '#64748b', fontWeight: 600 }}>✅ Recorded</span>
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', padding: '10px 16px', borderRadius: 10, border: '1px solid', borderColor: cancelada ? '#f87171' : 'rgba(255,255,255,0.1)', background: cancelada ? 'rgba(248,113,113,0.1)' : 'transparent', flex: 1 }}>
                <input type="checkbox" checked={cancelada} onChange={e => { setCancelada(e.target.checked); if (e.target.checked) setGravada(false) }} style={{ accentColor: '#f87171' }} />
                <span style={{ fontSize: 13, color: cancelada ? '#f87171' : '#64748b', fontWeight: 600 }}>❌ Cancelled</span>
              </label>
            </div>
            {cancelada && (
              <div style={{ marginTop: 12 }}>
                <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 6, textTransform: 'uppercase' }}>Cancellation Reason</label>
                <input value={motivoCancelamento} onChange={e => setMotivoCancelamento(e.target.value)} placeholder="Why was this cancelled?" style={inp} />
              </div>
            )}
          </div>
        )}

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'block', marginBottom: 8, textTransform: 'uppercase' }}>Observations</label>
          {canEdit
            ? <textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} placeholder="Notes about this class..." style={{ ...inp, resize: 'vertical' }} />
            : <div style={{ fontSize: 13, color: '#94a3b8', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, minHeight: 60 }}>{observacoes || 'No observations.'}</div>
          }
        </div>

        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <label style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, textTransform: 'uppercase' }}>External Links</label>
            {canEdit && <button onClick={addLink} style={{ fontSize: 11, color: '#a78bfa', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>+ Add link</button>}
          </div>
          {canEdit ? links.map((link, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input value={link.label} onChange={e => updateLink(i, 'label', e.target.value)} placeholder="Label (Drive, YouTube...)" style={{ ...inp, flex: '0 0 140px' }} />
              <input value={link.url} onChange={e => updateLink(i, 'url', e.target.value)} placeholder="https://..." style={{ ...inp, flex: 1 }} />
              <button onClick={() => removeLink(i)} style={{ background: 'rgba(239,68,68,0.1)', border: 'none', borderRadius: 6, padding: '8px 10px', color: '#f87171', cursor: 'pointer', flexShrink: 0 }}>✕</button>
            </div>
          )) : links.length > 0 ? links.map((l, i) => (
            <a key={i} href={l.url} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: 6, textDecoration: 'none', color: '#60a5fa', fontSize: 13 }}>
              🔗 {l.label || l.url}
            </a>
          )) : <div style={{ fontSize: 13, color: '#475569' }}>No links added.</div>}
        </div>

        {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 16 }}>{error}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, padding: '11px', color: '#94a3b8', fontSize: 13, cursor: 'pointer' }}>Close</button>
          {canEdit && <button onClick={handleSave} disabled={saving} style={{ flex: 2, background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', border: 'none', borderRadius: 10, padding: '11px', color: 'white', fontSize: 13, fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Saving...' : 'Save Changes'}</button>}
        </div>
      </div>
    </div>
  )
}
