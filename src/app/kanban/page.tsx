'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import Link from 'next/link'
import { CycleSwitcher, useCycle } from '@/components/CycleProvider'
import { useSession } from '@/hooks/useSession'
import { CICLOS } from '@/lib/cycles'
import CategorySwitcher, { useContentCategory } from '@/components/CategorySwitcher'
import { CONTENT_CATEGORIES, categoryStages, categoryStatus } from '@/lib/content-categories'

type Status = 'pendente' | 'em_andamento' | 'concluido'

interface Tema {
  id:number; disciplina_id:number; disciplina_nome:string; disciplina_cor:string
  ordem:number; tema_especifico:string; paginas:number|null; status_geral:Status
  mat_atualizado:Status; mat_revisado:Status; mat_diagramado:Status; mat_conferencia:Status
  vid_envio_tema:Status; vid_slide_pronto:Status; vid_diagramacao:Status; vid_aprovacao_slide:Status
  vid_agendamento:Status; vid_gravacao_feita:Status; vid_aprovacao_aula:Status; vid_publicada:Status
  comp_questoes:Status; comp_flashcards:Status
}

const COLS: { key:Status; label:string; color:string }[] = [
  { key:'pendente', label:'Pendente', color:'#94a3b8' },
  { key:'em_andamento', label:'Em Andamento', color:'#d97706' },
  { key:'concluido', label:'Concluído', color:'#16a34a' },
]

function KanbanInner() {
  const { ciclo } = useCycle()
  const { loading: sessionLoading, isCoordinator } = useSession()
  const cycleConfig = CICLOS[ciclo]
  const [temas, setTemas] = useState<Tema[]>([])
  const [loading, setLoading] = useState(true)
  const { category, setCategory } = useContentCategory()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [dragId, setDragId] = useState<number|null>(null)
  const [dragOver, setDragOver] = useState<Status|null>(null)

  const load = useCallback(async () => {
    if (sessionLoading) return
    setLoading(true)
    const r = await fetch(`/api/themes${isCoordinator ? `?ciclo=${ciclo}` : ''}`)
    setTemas(await r.json())
    setLoading(false)
  }, [ciclo, isCoordinator, sessionLoading])

  useEffect(() => { load() }, [load])

  const e = { ...CONTENT_CATEGORIES[category], campos: categoryStages(category) }

  const cols: Record<Status, Tema[]> = { pendente:[], em_andamento:[], concluido:[] }
  temas.forEach(t => { cols[categoryStatus(t, category)].push(t) })

  const moveCard = async (tema: Tema, novoStatus: Status) => {
    if (saving) return
    setSaving(true); setError('')
    try {
      for (const campo of e.campos) {
        const response = await fetch('/api/themes', {
          method:'PATCH', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ id:tema.id, campo, valor:novoStatus })
        })
        if (!response.ok) throw new Error('Não foi possível atualizar todas as etapas. Confira o estado atual antes de tentar novamente.')
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Falha ao salvar.') }
    finally { await load(); setSaving(false) }
  }

  return (
    <div style={{ minHeight:'100vh', background:'#f4f6fb' }}>
      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'rgba(244,246,251,0.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(0,0,0,0.06)', padding:'14px 32px', display:'flex', flexWrap:'wrap', alignItems:'center', gap:16 }}>
        <Link href="/" style={{ textDecoration:'none', color:'#64748b', fontSize:13 }}>← Dashboard</Link>
        <div style={{ width:1, height:20, background:'rgba(0,0,0,0.1)' }} />
        <h1 style={{ fontSize:18, fontWeight:700, color:'#0f172a', margin:0 }}>Kanban</h1>
        {isCoordinator && <CycleSwitcher compact />}
        <CategorySwitcher category={category} onChange={setCategory} />
        <div style={{ marginLeft:'auto', fontSize:13, color:'#94a3b8' }}>{loading?'Carregando...':`${temas.length} temas · ${isCoordinator ? cycleConfig.label : 'minhas disciplinas'}`}</div>
      </div>

      <div style={{ padding:'24px 32px' }}>
        {error && <p role="alert" style={{ color:'#b91c1c' }}>{error}</p>}
        <p style={{ color:'#475569', fontSize:13 }}>Esteira de {e.label}. Mover um tema altera somente as etapas desta categoria.{saving ? ' Salvando…' : ''}</p>
        {/* Etapas da esteira */}
        <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:20 }}>
          {e.campos.map(c => (
            <span key={c} style={{ fontSize:12, padding:'4px 12px', borderRadius:20, background:`${e.color}15`, border:`1px solid ${e.color}30`, color:e.color, fontWeight:500 }}>
              {e.stages.find(stage => stage.key === c)?.label}
            </span>
          ))}
        </div>

        {/* Board */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(260px,1fr))', gap:16 }}>
          {COLS.map(col => (
            <div key={col.key}
              onDragOver={e=>{ e.preventDefault(); setDragOver(col.key) }}
              onDragLeave={()=>setDragOver(null)}
              onDrop={async e=>{ e.preventDefault(); setDragOver(null); if(dragId){ const t=temas.find(x=>x.id===dragId); if(t) await moveCard(t,col.key) } }}
              style={{ minHeight:400 }}
            >
              {/* Col header */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background: dragOver===col.key?`${col.color}15`:'rgba(0,0,0,0.03)', border:`1px solid ${dragOver===col.key?col.color+'40':'rgba(0,0,0,0.06)'}`, borderRadius:10, marginBottom:12, transition:'all 0.15s' }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background:col.color }} />
                <span style={{ fontSize:13, fontWeight:600, color:'#334155', flex:1 }}>{col.label}</span>
                <span style={{ fontSize:12, fontWeight:700, background:`${col.color}20`, color:col.color, border:`1px solid ${col.color}30`, borderRadius:20, padding:'2px 8px' }}>{cols[col.key].length}</span>
              </div>

              {/* Cards */}
              {cols[col.key].map(t => (
                <div key={t.id}
                  draggable={!saving}
                  onDragStart={()=>setDragId(t.id)}
                  onDragEnd={()=>setDragId(null)}
                  style={{ background:dragId===t.id?'rgba(0,0,0,0.08)':'rgba(0,0,0,0.04)', border:`1px solid ${t.disciplina_cor}30`, borderLeft:`3px solid ${t.disciplina_cor}`, borderRadius:10, padding:'12px 14px', cursor:'grab', marginBottom:8, opacity:dragId===t.id?0.5:1, transition:'opacity 0.15s' }}
                >
                  <div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>{t.disciplina_nome}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#1e293b', marginBottom:8, lineHeight:1.4 }}>{t.tema_especifico}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontSize:11, color:'#94a3b8' }}>
                      {e.campos.filter(c=>(t as any)[c]==='concluido').length}/{e.campos.length} etapas
                    </div>
                    <Link href={`/disciplinas?id=${t.disciplina_id}&categoria=${category}`} style={{ fontSize:12, color:e.color }}>Ver disciplina</Link>
                  </div>
                  <label style={{ display:'block', marginTop:10, fontSize:12, color:'#475569' }}>
                    Mover em {e.label}
                    <select aria-label={`Status de ${t.tema_especifico} em ${e.label}`} value={col.key} disabled={saving} onChange={event => moveCard(t, event.target.value as Status)} style={{ display:'block', width:'100%', minHeight:44, marginTop:4, border:'1px solid #cbd5e1', borderRadius:6, background:'#fff', padding:8 }}>
                      {COLS.map(status => <option key={status.key} value={status.key}>{status.label}</option>)}
                    </select>
                  </label>
                </div>
              ))}

              {cols[col.key].length===0 && (
                <div style={{ border:'2px dashed rgba(0,0,0,0.06)', borderRadius:10, padding:'40px 20px', textAlign:'center', color:'#334155', fontSize:13 }}>
                  Arraste cards aqui
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function KanbanPage() {
  return <Suspense fallback={<div>Carregando…</div>}><KanbanInner /></Suspense>
}
