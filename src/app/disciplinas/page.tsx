'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

type Status = 'pendente' | 'em_andamento' | 'concluido'
const CYCLE: Status[] = ['pendente','em_andamento','concluido']
const SLABEL: Record<Status,string> = { pendente:'Pendente', em_andamento:'Em andamento', concluido:'Concluído' }
const SCOLOR: Record<Status,string> = { pendente:'#475569', em_andamento:'#fbbf24', concluido:'#4ade80' }
const SBG: Record<Status,string> = { pendente:'rgba(71,85,105,0.2)', em_andamento:'rgba(251,191,36,0.15)', concluido:'rgba(74,222,128,0.15)' }

interface Tema {
  id:number; disciplina_id:number; disciplina_nome:string; disciplina_cor:string
  ordem:number; tema_especifico:string; paginas:number|null; questoes_previstas:number|null
  responsavel:string|null; observacoes:string|null; status_geral:Status
  mat_atualizado:Status; mat_revisado:Status; mat_diagramado:Status; mat_conferencia:Status
  vid_envio_tema:Status; vid_slide_pronto:Status; vid_diagramacao:Status; vid_aprovacao_slide:Status
  vid_agendamento:Status; vid_gravacao_feita:Status; vid_aprovacao_aula:Status; vid_publicada:Status
  comp_simulado:Status; comp_questoes:Status; comp_flashcards:Status
}
interface Disc { id:number; nome:string; cor:string; microassunto:string|null; total_temas:number; concluidos:number; em_andamento:number; pendentes:number; paginas_totais:number; progresso_geral:number }

const GRUPOS = [
  {
    key:'mat', label:'Materiais', color:'#16a34a',
    campos:[
      {k:'mat_atualizado',l:'Atualizado'},
      {k:'mat_revisado',l:'Revisado'},
      {k:'mat_diagramado',l:'Diagramado'},
      {k:'mat_conferencia',l:'Conferência'},
    ]
  },
  {
    key:'vid', label:'Vídeo', color:'#2563eb',
    campos:[
      {k:'vid_envio_tema',l:'Envio do Tema'},
      {k:'vid_slide_pronto',l:'Slide Pronto'},
      {k:'vid_diagramacao',l:'Diagramação'},
      {k:'vid_aprovacao_slide',l:'Aprovação Slide'},
      {k:'vid_agendamento',l:'Agendamento'},
      {k:'vid_gravacao_feita',l:'Gravação'},
      {k:'vid_aprovacao_aula',l:'Aprovação Aula'},
      {k:'vid_publicada',l:'Publicada'},
    ]
  },
  {
    key:'comp', label:'Complementos', color:'#d97706',
    campos:[
      {k:'comp_simulado',l:'Simulado'},
      {k:'comp_questoes',l:'Questões'},
      {k:'comp_flashcards',l:'Flashcards'},
    ]
  },
]

// Step indicators for video workflow
const VID_STEPS = [
  { k:'vid_envio_tema', l:'Enviar tema', icon:'📨' },
  { k:'vid_slide_pronto', l:'Slide pronto', icon:'📊' },
  { k:'vid_diagramacao', l:'Diagramação', icon:'🎨' },
  { k:'vid_aprovacao_slide', l:'Aprovação slide', icon:'✅' },
  { k:'vid_agendamento', l:'Agendar aula', icon:'📅' },
  { k:'vid_gravacao_feita', l:'Gravação', icon:'🎥' },
  { k:'vid_aprovacao_aula', l:'Aprovação aula', icon:'👍' },
  { k:'vid_publicada', l:'No sistema', icon:'🚀' },
]

function Inner() {
  const sp = useSearchParams()
  const selectedId = sp.get('id') ? Number(sp.get('id')) : null
  const [disciplinas, setDisciplinas] = useState<Disc[]>([])
  const [temas, setTemas] = useState<Tema[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<number|null>(null)
  const [filtroStatus, setFiltroStatus] = useState<Status|''>('')

  const loadDiscs = useCallback(async () => {
    const r = await fetch('/api/disciplines'); setDisciplinas(await r.json())
  }, [])

  const loadTemas = useCallback(async (did?: number) => {
    setLoading(true)
    const url = did ? `/api/themes?disciplina_id=${did}` : '/api/themes'
    const r = await fetch(url); setTemas(await r.json()); setLoading(false)
  }, [])

  useEffect(() => { loadDiscs() }, [loadDiscs])
  useEffect(() => { loadTemas(selectedId ?? undefined) }, [selectedId, loadTemas])

  const toggle = async (t: Tema, campo: string) => {
    const curr = (t as any)[campo] as Status
    const valor = CYCLE[(CYCLE.indexOf(curr)+1)%CYCLE.length]
    const r = await fetch('/api/themes', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:t.id,campo,valor}) })
    if (r.ok) { const u = await r.json(); setTemas(prev => prev.map(x => x.id===u.id?u:x)) }
  }

  const selectedDisc = disciplinas.find(d => d.id === selectedId)
  const filtered = temas.filter(t =>
    t.tema_especifico.toLowerCase().includes(busca.toLowerCase()) &&
    (!filtroStatus || t.status_geral===filtroStatus)
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0a0d14' }}>
      {/* Sidebar */}
      <div style={{ width:220, background:'rgba(255,255,255,0.02)', borderRight:'1px solid rgba(255,255,255,0.06)', position:'fixed', top:0, bottom:0, left:0, overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
          <Link href="/" style={{ textDecoration:'none', color:'#64748b', fontSize:12 }}>← Dashboard</Link>
          <div style={{ fontSize:16, fontWeight:700, color:'#e2e8f0', marginTop:10 }}>Disciplinas</div>
        </div>
        <div style={{ padding:'8px', flex:1 }}>
          <Link href="/disciplinas" style={{ textDecoration:'none' }}>
            <div style={{ padding:'8px 12px', borderRadius:8, fontSize:13, color:!selectedId?'#a78bfa':'#64748b', background:!selectedId?'rgba(167,139,250,0.1)':'transparent', marginBottom:4, cursor:'pointer', fontWeight:500 }}>Todas</div>
          </Link>
          {disciplinas.map(d => (
            <Link key={d.id} href={`/disciplinas?id=${d.id}`} style={{ textDecoration:'none' }}>
              <div style={{ padding:'7px 12px', borderRadius:8, fontSize:12, color:selectedId===d.id?'#e2e8f0':'#64748b', background:selectedId===d.id?`${d.cor}20`:'transparent', marginBottom:2, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:d.cor, flexShrink:0 }} />
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.nome}</span>
                <span style={{ fontSize:10, color:'#475569' }}>{d.concluidos}/{d.total_temas}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ marginLeft:220, flex:1, padding:'32px 40px' }}>
        <div style={{ marginBottom:24 }}>
          {selectedDisc ? (
            <div style={{ display:'flex', alignItems:'center', gap:14 }}>
              <div>
                <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9' }}>{selectedDisc.nome}</h1>
                {selectedDisc.microassunto && <div style={{ fontSize:13, color:'#64748b' }}>{selectedDisc.microassunto}</div>}
              </div>
              <div style={{ marginLeft:'auto', textAlign:'right' }}>
                <div style={{ fontSize:28, fontWeight:700, color:selectedDisc.cor }}>{selectedDisc.progresso_geral || 0}%</div>
                <div style={{ fontSize:12, color:'#475569' }}>{selectedDisc.concluidos}/{selectedDisc.total_temas} temas</div>
              </div>
            </div>
          ) : <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9' }}>Todos os Temas</h1>}
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar tema..." style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 14px', color:'#e2e8f0', fontSize:13, outline:'none', flex:1, minWidth:200 }} />
          {(['','pendente','em_andamento','concluido'] as const).map(s => (
            <button key={s} onClick={()=>setFiltroStatus(s)} style={{ padding:'8px 14px', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500, background:filtroStatus===s?'rgba(167,139,250,0.2)':'rgba(255,255,255,0.04)', border:filtroStatus===s?'1px solid rgba(167,139,250,0.4)':'1px solid rgba(255,255,255,0.08)', color:filtroStatus===s?'#a78bfa':'#64748b' }}>
              {s===''?'Todos':SLABEL[s as Status]}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? <div style={{ textAlign:'center', padding:60, color:'#475569' }}>Carregando...</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(t => {
              const isOpen = expandido===t.id
              return (
                <div key={t.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, overflow:'hidden', borderLeft:`3px solid ${SCOLOR[t.status_geral]}` }}>
                  <div onClick={()=>setExpandido(isOpen?null:t.id)} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', cursor:'pointer' }}>
                    <span style={{ fontSize:13, color:'#475569', width:24, flexShrink:0 }}>{t.ordem}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:500, color:'#e2e8f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.tema_especifico}</div>
                      {!selectedId && <div style={{ fontSize:11, color:'#475569', marginTop:2 }}>{t.disciplina_nome}</div>}
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {GRUPOS.map(g => {
                        const done = g.campos.filter(c => (t as any)[c.k]==='concluido').length
                        return <div key={g.key} style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:`${g.color}15`, color:g.color, border:`1px solid ${g.color}30`, fontWeight:600 }}>{done}/{g.campos.length}</div>
                      })}
                    </div>
                    {t.paginas && <span style={{ fontSize:12, color:'#60a5fa', flexShrink:0 }}>{t.paginas}p</span>}
                    <span style={{ color:'#475569', fontSize:11, transform:isOpen?'rotate(180deg)':'none', display:'inline-block', transition:'transform 0.2s' }}>▼</span>
                  </div>

                  {isOpen && (
                    <div style={{ padding:'0 18px 18px', borderTop:'1px solid rgba(255,255,255,0.05)' }}>
                      <div style={{ paddingTop:16, display:'flex', flexDirection:'column', gap:20 }}>

                        {/* Materiais */}
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:'#16a34a', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>Materiais</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {GRUPOS[0].campos.map(c => {
                              const s = (t as any)[c.k] as Status
                              return (
                                <div key={c.k} style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center' }}>
                                  <span style={{ fontSize:11, color:'#64748b' }}>{c.l}</span>
                                  <button onClick={()=>toggle(t,c.k)} style={{ background:SBG[s], border:`1px solid ${SCOLOR[s]}40`, borderRadius:6, padding:'3px 10px', fontSize:11, color:SCOLOR[s], cursor:'pointer', fontWeight:500, fontFamily:'inherit' }}>
                                    {s==='concluido'?'✓':s==='em_andamento'?'◐':'○'} {SLABEL[s]}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Vídeo — workflow sequencial */}
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:'#2563eb', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>Vídeo</div>
                          <div style={{ display:'flex', alignItems:'flex-start', gap:0, overflowX:'auto', paddingBottom:8 }}>
                            {VID_STEPS.map((step, idx) => {
                              const s = (t as any)[step.k] as Status
                              const isDone = s === 'concluido'
                              const isInProgress = s === 'em_andamento'
                              return (
                                <div key={step.k} style={{ display:'flex', alignItems:'center' }}>
                                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, minWidth:80 }}>
                                    <button onClick={()=>toggle(t,step.k)}
                                      style={{
                                        width:40, height:40, borderRadius:'50%', border:'2px solid',
                                        borderColor: isDone ? '#4ade80' : isInProgress ? '#fbbf24' : 'rgba(255,255,255,0.1)',
                                        background: isDone ? 'rgba(74,222,128,0.2)' : isInProgress ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.03)',
                                        color: isDone ? '#4ade80' : isInProgress ? '#fbbf24' : '#475569',
                                        fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                                        transition:'all 0.2s', fontFamily:'inherit'
                                      }}>
                                      {isDone ? '✓' : step.icon}
                                    </button>
                                    <span style={{ fontSize:9, color: isDone ? '#4ade80' : isInProgress ? '#fbbf24' : '#475569', textAlign:'center', lineHeight:1.3, maxWidth:72, fontWeight: isDone || isInProgress ? 600 : 400 }}>{step.l}</span>
                                  </div>
                                  {idx < VID_STEPS.length - 1 && (
                                    <div style={{ width:24, height:2, background: isDone ? '#4ade80' : 'rgba(255,255,255,0.08)', flexShrink:0, marginBottom:20 }} />
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Complementos */}
                        <div>
                          <div style={{ fontSize:11, fontWeight:700, color:'#d97706', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:10 }}>Complementos</div>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                            {GRUPOS[2].campos.map(c => {
                              const s = (t as any)[c.k] as Status
                              return (
                                <div key={c.k} style={{ display:'flex', flexDirection:'column', gap:4, alignItems:'center' }}>
                                  <span style={{ fontSize:11, color:'#64748b' }}>{c.l}</span>
                                  <button onClick={()=>toggle(t,c.k)} style={{ background:SBG[s], border:`1px solid ${SCOLOR[s]}40`, borderRadius:6, padding:'3px 10px', fontSize:11, color:SCOLOR[s], cursor:'pointer', fontWeight:500, fontFamily:'inherit' }}>
                                    {s==='concluido'?'✓':s==='em_andamento'?'◐':'○'} {SLABEL[s]}
                                  </button>
                                </div>
                              )
                            })}
                          </div>
                        </div>

                        {/* Info */}
                        <div style={{ display:'flex', gap:16, paddingTop:8, borderTop:'1px solid rgba(255,255,255,0.05)', flexWrap:'wrap' }}>
                          {t.paginas && <span style={{ fontSize:12, color:'#64748b' }}>📄 {t.paginas} páginas</span>}
                          {t.questoes_previstas && <span style={{ fontSize:12, color:'#64748b' }}>❓ {t.questoes_previstas} questões</span>}
                          {t.responsavel && <span style={{ fontSize:12, color:'#64748b' }}>👤 {t.responsavel}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length===0 && <div style={{ textAlign:'center', padding:60, color:'#475569' }}>Nenhum tema encontrado.</div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DisciplinasPage() {
  return (
    <Suspense fallback={<div style={{ background:'#0a0d14', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Carregando...</div>}>
      <Inner />
    </Suspense>
  )
}
