'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'

type Status = 'pendente' | 'em_andamento' | 'concluido'

interface Tema {
  id:number; disciplina_id:number; disciplina_nome:string; disciplina_cor:string
  ordem:number; tema_especifico:string; paginas:number|null; status_geral:Status
  mat_atualizado:Status; mat_revisado:Status; mat_diagramado:Status; mat_conferencia:Status
  vid_slide:Status; vid_gravacao:Status; vid_edicao:Status
  comp_simulado:Status; comp_questoes:Status; comp_flashcards:Status
}

type Esteira = 'mat'|'vid'|'comp'

const ESTEIRAS = [
  { key:'mat' as Esteira, label:'Materiais', color:'#16a34a', campos:['mat_atualizado','mat_revisado','mat_diagramado','mat_conferencia'] },
  { key:'vid' as Esteira, label:'Vídeo Aulas', color:'#2563eb', campos:['vid_slide','vid_gravacao','vid_edicao'] },
  { key:'comp' as Esteira, label:'Complementos', color:'#d97706', campos:['comp_simulado','comp_questoes','comp_flashcards'] },
]

const COLS: { key:Status; label:string; color:string }[] = [
  { key:'pendente', label:'Pendente', color:'#475569' },
  { key:'em_andamento', label:'Em Andamento', color:'#fbbf24' },
  { key:'concluido', label:'Concluído', color:'#4ade80' },
]

function getEsteiraStatus(t: Tema, campos: string[]): Status {
  const vals = campos.map(c => (t as any)[c] as Status)
  if (vals.every(v => v==='concluido')) return 'concluido'
  if (vals.some(v => v!=='pendente')) return 'em_andamento'
  return 'pendente'
}

export default function KanbanPage() {
  const [temas, setTemas] = useState<Tema[]>([])
  const [loading, setLoading] = useState(true)
  const [esteira, setEsteira] = useState<Esteira>('mat')
  const [dragId, setDragId] = useState<number|null>(null)
  const [dragOver, setDragOver] = useState<Status|null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const r = await fetch('/api/themes')
    setTemas(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const e = ESTEIRAS.find(x => x.key===esteira)!

  const cols: Record<Status, Tema[]> = { pendente:[], em_andamento:[], concluido:[] }
  temas.forEach(t => { cols[getEsteiraStatus(t, e.campos)].push(t) })

  const moveCard = async (tema: Tema, novoStatus: Status) => {
    for (const campo of e.campos) {
      await fetch('/api/themes', {
        method:'PATCH', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ id:tema.id, campo, valor:novoStatus })
      })
    }
    await load()
  }

  return (
    <div style={{ minHeight:'100vh', background:'#0a0d14' }}>
      {/* Header */}
      <div style={{ position:'sticky', top:0, zIndex:40, background:'rgba(10,13,20,0.95)', backdropFilter:'blur(12px)', borderBottom:'1px solid rgba(255,255,255,0.06)', padding:'14px 32px', display:'flex', alignItems:'center', gap:16 }}>
        <Link href="/" style={{ textDecoration:'none', color:'#64748b', fontSize:13 }}>← Dashboard</Link>
        <div style={{ width:1, height:20, background:'rgba(255,255,255,0.1)' }} />
        <h1 style={{ fontSize:18, fontWeight:700, color:'#f1f5f9', margin:0 }}>Kanban</h1>
        <div style={{ display:'flex', gap:8, marginLeft:16 }}>
          {ESTEIRAS.map(ex => (
            <button key={ex.key} onClick={()=>setEsteira(ex.key)} style={{ padding:'7px 16px', borderRadius:8, fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600, background:esteira===ex.key?`${ex.color}20`:'rgba(255,255,255,0.04)', border:esteira===ex.key?`1px solid ${ex.color}60`:'1px solid rgba(255,255,255,0.08)', color:esteira===ex.key?ex.color:'#64748b', transition:'all 0.15s' }}>
              {ex.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft:'auto', fontSize:13, color:'#475569' }}>{loading?'Carregando...':`${temas.length} temas`}</div>
      </div>

      <div style={{ padding:'24px 32px' }}>
        {/* Etapas da esteira */}
        <div style={{ display:'flex', gap:8, marginBottom:20 }}>
          {e.campos.map(c => (
            <span key={c} style={{ fontSize:12, padding:'4px 12px', borderRadius:20, background:`${e.color}15`, border:`1px solid ${e.color}30`, color:e.color, fontWeight:500 }}>
              {c.replace('mat_','').replace('vid_','').replace('comp_','').replace('_',' ')}
            </span>
          ))}
        </div>

        {/* Board */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16 }}>
          {COLS.map(col => (
            <div key={col.key}
              onDragOver={e=>{ e.preventDefault(); setDragOver(col.key) }}
              onDragLeave={()=>setDragOver(null)}
              onDrop={async e=>{ e.preventDefault(); setDragOver(null); if(dragId){ const t=temas.find(x=>x.id===dragId); if(t) await moveCard(t,col.key) } }}
              style={{ minHeight:400 }}
            >
              {/* Col header */}
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background: dragOver===col.key?`${col.color}15`:'rgba(255,255,255,0.03)', border:`1px solid ${dragOver===col.key?col.color+'40':'rgba(255,255,255,0.06)'}`, borderRadius:10, marginBottom:12, transition:'all 0.15s' }}>
                <span style={{ width:10, height:10, borderRadius:'50%', background:col.color }} />
                <span style={{ fontSize:13, fontWeight:600, color:'#cbd5e1', flex:1 }}>{col.label}</span>
                <span style={{ fontSize:12, fontWeight:700, background:`${col.color}20`, color:col.color, border:`1px solid ${col.color}30`, borderRadius:20, padding:'2px 8px' }}>{cols[col.key].length}</span>
              </div>

              {/* Cards */}
              {cols[col.key].map(t => (
                <div key={t.id}
                  draggable
                  onDragStart={()=>setDragId(t.id)}
                  onDragEnd={()=>setDragId(null)}
                  style={{ background:dragId===t.id?'rgba(255,255,255,0.08)':'rgba(255,255,255,0.04)', border:`1px solid ${t.disciplina_cor}30`, borderLeft:`3px solid ${t.disciplina_cor}`, borderRadius:10, padding:'12px 14px', cursor:'grab', marginBottom:8, opacity:dragId===t.id?0.5:1, transition:'opacity 0.15s' }}
                >
                  <div style={{ fontSize:11, color:'#64748b', marginBottom:4 }}>{t.disciplina_nome}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0', marginBottom:8, lineHeight:1.4 }}>{t.tema_especifico}</div>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontSize:11, color:'#475569' }}>
                      {e.campos.filter(c=>(t as any)[c]==='concluido').length}/{e.campos.length} etapas
                    </div>
                    {t.paginas && <div style={{ fontSize:11, color:'#60a5fa' }}>{t.paginas}p</div>}
                  </div>
                </div>
              ))}

              {cols[col.key].length===0 && (
                <div style={{ border:'2px dashed rgba(255,255,255,0.06)', borderRadius:10, padding:'40px 20px', textAlign:'center', color:'#334155', fontSize:13 }}>
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
