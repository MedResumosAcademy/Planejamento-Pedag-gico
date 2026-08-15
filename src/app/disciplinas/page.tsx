'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/hooks/useSession'
import { getRevisoesByTema, addRevisao, deleteRevisao } from '@/lib/repositories/revisoes'
import { getProfessores, type ProfessorOption } from '@/lib/repositories/colaboradores'
import { CycleSwitcher, useCycle } from '@/components/CycleProvider'
import { CICLOS } from '@/lib/cycles'
import type { Revisao } from '@/types'

const todayISO = () => new Date().toISOString().slice(0, 10)
const fmtBR = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })

type Status = 'pendente' | 'em_andamento' | 'concluido'
const CYCLE: Status[] = ['pendente','em_andamento','concluido']
const SLABEL: Record<Status,string> = { pendente:'Pendente', em_andamento:'Em andamento', concluido:'Concluído' }
const SCOLOR: Record<Status,string> = { pendente:'#94a3b8', em_andamento:'#d97706', concluido:'#16a34a' }
const SBG: Record<Status,string> = { pendente:'rgba(71,85,105,0.2)', em_andamento:'rgba(251,191,36,0.15)', concluido:'rgba(74,222,128,0.15)' }

interface Tema {
  id:number; disciplina_id:number; disciplina_nome:string; disciplina_cor:string
  ordem:number; tema_especifico:string; paginas:number|null; questoes_previstas:number|null
  responsavel:string|null; observacoes:string|null; gravado_em:string|null; status_geral:Status
  mat_atualizado:Status; mat_revisado:Status; mat_diagramado:Status; mat_conferencia:Status
  vid_envio_tema:Status; vid_slide_pronto:Status; vid_diagramacao:Status; vid_aprovacao_slide:Status
  vid_agendamento:Status; vid_gravacao_feita:Status; vid_aprovacao_aula:Status; vid_publicada:Status
  comp_simulado:Status; comp_questoes:Status; comp_flashcards:Status
}
interface Disc { id:number; nome:string; cor:string; ciclo:'basico'|'clinico'; microassunto:string|null; total_temas:number; concluidos:number; em_andamento:number; pendentes:number; paginas_totais:number; progresso_geral:number }

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
  const router = useRouter()
  const { ciclo } = useCycle()
  const cycleConfig = CICLOS[ciclo]
  const selectedId = sp.get('id') ? Number(sp.get('id')) : null
  const [disciplinas, setDisciplinas] = useState<Disc[]>([])
  const [disciplinasLoaded, setDisciplinasLoaded] = useState(false)
  const [temas, setTemas] = useState<Tema[]>([])
  const [loading, setLoading] = useState(false)
  const [busca, setBusca] = useState('')
  const [expandido, setExpandido] = useState<number|null>(null)
  const [filtroStatus, setFiltroStatus] = useState<Status|''>('')
  const { session, loading: sessionLoading, isCoordinator } = useSession()
  const [professores, setProfessores] = useState<ProfessorOption[]>([])
  const [revisoes, setRevisoes] = useState<Record<number, Revisao[]>>({})
  const [revLoading, setRevLoading] = useState<Record<number, boolean>>({})
  const [revForm, setRevForm] = useState<{ data: string; texto: string }>({ data: todayISO(), texto: '' })
  const [revSaving, setRevSaving] = useState(false)
  const [revErro, setRevErro] = useState('')

  const loadDiscs = useCallback(async () => {
    if (sessionLoading) return
    setDisciplinasLoaded(false)
    try {
      const r = await fetch(`/api/disciplines${isCoordinator ? `?ciclo=${ciclo}` : ''}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setDisciplinas(await r.json())
    } catch (e) {
      console.error('Falha ao carregar disciplinas:', e)
      setDisciplinas([])
    } finally {
      setDisciplinasLoaded(true)
    }
  }, [ciclo, isCoordinator, sessionLoading])

  const loadTemas = useCallback(async (did?: number) => {
    if (sessionLoading) return
    setLoading(true)
    const params = new URLSearchParams()
    if (did) params.set('disciplina_id', String(did))
    if (isCoordinator) params.set('ciclo', ciclo)
    const url = `/api/themes${params.size ? `?${params}` : ''}`
    const r = await fetch(url); setTemas(await r.json()); setLoading(false)
  }, [ciclo, isCoordinator, sessionLoading])

  useEffect(() => { loadDiscs() }, [loadDiscs])
  useEffect(() => { loadTemas(selectedId ?? undefined) }, [selectedId, loadTemas])
  useEffect(() => {
    if (isCoordinator && disciplinasLoaded && selectedId && !disciplinas.some(d => d.id === selectedId)) {
      router.replace('/disciplinas')
    }
  }, [disciplinas, disciplinasLoaded, isCoordinator, router, selectedId])
  useEffect(() => { setExpandido(null) }, [ciclo])
  useEffect(() => { getProfessores().then(setProfessores).catch(e => console.error('Falha ao carregar professores:', e)) }, [])

  const toggle = async (t: Tema, campo: string) => {
    const curr = (t as any)[campo] as Status
    const valor = CYCLE[(CYCLE.indexOf(curr)+1)%CYCLE.length]
    const r = await fetch('/api/themes', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({id:t.id,campo,valor}) })
    if (r.ok) { const u = await r.json(); setTemas(prev => prev.map(x => x.id===u.id?u:x)) }
  }

  const openTema = (t: Tema) => {
    const willOpen = expandido !== t.id
    setExpandido(willOpen ? t.id : null)
    setRevForm({ data: todayISO(), texto: '' })
    if (willOpen && revisoes[t.id] === undefined) loadRevisoes(t.id)
  }
  const loadRevisoes = async (temaId: number) => {
    setRevLoading(p => ({ ...p, [temaId]: true }))
    try { const rs = await getRevisoesByTema(temaId); setRevisoes(p => ({ ...p, [temaId]: rs })) }
    catch (e) { console.error('Falha ao carregar revisões:', e); setRevisoes(p => ({ ...p, [temaId]: [] })) }
    setRevLoading(p => ({ ...p, [temaId]: false }))
  }
  const setGravadoEm = async (t: Tema, valor: string) => {
    setRevErro('')
    const r = await fetch('/api/themes', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:t.id, campo:'gravado_em', valor: valor || null }) })
    if (r.ok) { const u = await r.json(); setTemas(prev => prev.map(x => x.id===u.id?u:x)) }
    else { const j = await r.json().catch(() => ({})); setRevErro(j.error || 'Não foi possível salvar a data de gravação.') }
  }
  const setResponsavel = async (t: Tema, valor: string) => {
    setRevErro('')
    const r = await fetch('/api/themes', { method:'PATCH', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ id:t.id, campo:'responsavel', valor: valor || null }) })
    if (r.ok) { const u = await r.json(); setTemas(prev => prev.map(x => x.id===u.id?u:x)) }
    else { const j = await r.json().catch(() => ({})); setRevErro(j.error || 'Não foi possível salvar o professor designado.') }
  }
  const submitRevisao = async (t: Tema) => {
    if (!revForm.texto.trim()) return
    setRevSaving(true); setRevErro('')
    try {
      await addRevisao({ tema_id: t.id, revisado_em: revForm.data || todayISO(), o_que_mudou: revForm.texto.trim(), autor: session?.nome ?? null })
      setRevForm({ data: todayISO(), texto: '' })
      await loadRevisoes(t.id)
    } catch (e: any) { console.error('Falha ao salvar revisão:', e); setRevErro(e?.message || 'Não foi possível salvar a revisão.') }
    setRevSaving(false)
  }
  const removeRevisao = async (t: Tema, id: number) => {
    try { await deleteRevisao(id); await loadRevisoes(t.id) } catch (e) { console.error(e) }
  }

  const selectedDisc = disciplinas.find(d => d.id === selectedId)
  const filtered = temas.filter(t =>
    t.tema_especifico.toLowerCase().includes(busca.toLowerCase()) &&
    (!filtroStatus || t.status_geral===filtroStatus)
  )

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#f4f6fb' }}>
      {/* Sidebar */}
      <div style={{ width:220, background:'rgba(0,0,0,0.02)', borderRight:'1px solid rgba(0,0,0,0.06)', position:'fixed', top:0, bottom:0, left:0, overflowY:'auto', display:'flex', flexDirection:'column' }}>
        <div style={{ padding:'16px', borderBottom:'1px solid rgba(0,0,0,0.06)' }}>
          <Link href="/" style={{ textDecoration:'none', color:'#64748b', fontSize:12 }}>← Dashboard</Link>
          <div style={{ fontSize:16, fontWeight:700, color:'#1e293b', marginTop:10 }}>Disciplinas</div>
          {isCoordinator && <div style={{ marginTop:12 }}><CycleSwitcher compact /></div>}
        </div>
        <div style={{ padding:'8px', flex:1 }}>
          <Link href="/disciplinas" style={{ textDecoration:'none' }}>
            <div style={{ padding:'8px 12px', borderRadius:8, fontSize:13, color:!selectedId?'#7c3aed':'#64748b', background:!selectedId?'rgba(167,139,250,0.1)':'transparent', marginBottom:4, cursor:'pointer', fontWeight:500 }}>Todas</div>
          </Link>
          {disciplinas.map(d => (
            <Link key={d.id} href={`/disciplinas?id=${d.id}`} style={{ textDecoration:'none' }}>
              <div style={{ padding:'7px 12px', borderRadius:8, fontSize:12, color:selectedId===d.id?'#1e293b':'#64748b', background:selectedId===d.id?`${d.cor}20`:'transparent', marginBottom:2, cursor:'pointer', display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ width:7, height:7, borderRadius:'50%', background:d.cor, flexShrink:0 }} />
                <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.nome}</span>
                <span style={{ fontSize:10, color:'#94a3b8' }}>{d.concluidos}/{d.total_temas}</span>
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
                <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a' }}>{selectedDisc.nome}</h1>
                {selectedDisc.microassunto && <div style={{ fontSize:13, color:'#64748b' }}>{selectedDisc.microassunto}</div>}
              </div>
              <div style={{ marginLeft:'auto', textAlign:'right' }}>
                <div style={{ fontSize:28, fontWeight:700, color:selectedDisc.cor }}>{selectedDisc.progresso_geral || 0}%</div>
                <div style={{ fontSize:12, color:'#94a3b8' }}>{selectedDisc.concluidos}/{selectedDisc.total_temas} temas</div>
              </div>
            </div>
          ) : <h1 style={{ fontSize:22, fontWeight:700, color:'#0f172a' }}>Todos os Temas · {isCoordinator ? cycleConfig.label : 'Minhas disciplinas'}</h1>}
        </div>

        {/* Filtros */}
        <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
          <input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="🔍 Buscar tema..." style={{ background:'rgba(0,0,0,0.04)', border:'1px solid rgba(0,0,0,0.08)', borderRadius:10, padding:'8px 14px', color:'#1e293b', fontSize:13, outline:'none', flex:1, minWidth:200 }} />
          {(['','pendente','em_andamento','concluido'] as const).map(s => (
            <button key={s} onClick={()=>setFiltroStatus(s)} style={{ padding:'8px 14px', borderRadius:10, fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:500, background:filtroStatus===s?'rgba(167,139,250,0.2)':'rgba(0,0,0,0.04)', border:filtroStatus===s?'1px solid rgba(167,139,250,0.4)':'1px solid rgba(0,0,0,0.08)', color:filtroStatus===s?'#7c3aed':'#64748b' }}>
              {s===''?'Todos':SLABEL[s as Status]}
            </button>
          ))}
        </div>

        {/* Lista */}
        {loading ? <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Carregando...</div> : (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {filtered.map(t => {
              const isOpen = expandido===t.id
              return (
                <div key={t.id} style={{ background:'rgba(0,0,0,0.03)', border:'1px solid rgba(0,0,0,0.06)', borderRadius:12, overflow:'hidden', borderLeft:`3px solid ${SCOLOR[t.status_geral]}` }}>
                  <div onClick={()=>openTema(t)} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 18px', cursor:'pointer' }}>
                    <span style={{ fontSize:13, color:'#94a3b8', width:24, flexShrink:0 }}>{t.ordem}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:14, fontWeight:500, color:'#1e293b', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.tema_especifico}</div>
                      {!selectedId && <div style={{ fontSize:11, color:'#94a3b8', marginTop:2 }}>{t.disciplina_nome}</div>}
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {GRUPOS.map(g => {
                        const done = g.campos.filter(c => (t as any)[c.k]==='concluido').length
                        return <div key={g.key} style={{ fontSize:11, padding:'2px 8px', borderRadius:20, background:`${g.color}15`, color:g.color, border:`1px solid ${g.color}30`, fontWeight:600 }}>{done}/{g.campos.length}</div>
                      })}
                    </div>
                    {t.paginas && <span style={{ fontSize:12, color:'#2563eb', flexShrink:0 }}>{t.paginas}p</span>}
                    <span style={{ color:'#94a3b8', fontSize:11, transform:isOpen?'rotate(180deg)':'none', display:'inline-block', transition:'transform 0.2s' }}>▼</span>
                  </div>

                  {isOpen && (
                    <div style={{ padding:'0 18px 18px', borderTop:'1px solid rgba(0,0,0,0.05)' }}>
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
                                        borderColor: isDone ? '#16a34a' : isInProgress ? '#d97706' : 'rgba(0,0,0,0.1)',
                                        background: isDone ? 'rgba(74,222,128,0.2)' : isInProgress ? 'rgba(251,191,36,0.15)' : 'rgba(0,0,0,0.03)',
                                        color: isDone ? '#16a34a' : isInProgress ? '#d97706' : '#94a3b8',
                                        fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                                        transition:'all 0.2s', fontFamily:'inherit'
                                      }}>
                                      {isDone ? '✓' : step.icon}
                                    </button>
                                    <span style={{ fontSize:9, color: isDone ? '#16a34a' : isInProgress ? '#d97706' : '#94a3b8', textAlign:'center', lineHeight:1.3, maxWidth:72, fontWeight: isDone || isInProgress ? 600 : 400 }}>{step.l}</span>
                                  </div>
                                  {idx < VID_STEPS.length - 1 && (
                                    <div style={{ width:24, height:2, background: isDone ? '#16a34a' : 'rgba(0,0,0,0.08)', flexShrink:0, marginBottom:20 }} />
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
                        <div style={{ display:'flex', gap:16, paddingTop:8, borderTop:'1px solid rgba(0,0,0,0.05)', flexWrap:'wrap' }}>
                          {t.paginas && <span style={{ fontSize:12, color:'#64748b' }}>📄 {t.paginas} páginas</span>}
                          {t.questoes_previstas && <span style={{ fontSize:12, color:'#64748b' }}>❓ {t.questoes_previstas} questões</span>}
                          {t.responsavel && <span style={{ fontSize:12, color:'#64748b' }}>👤 {t.responsavel}</span>}
                        </div>

                        {/* Controle de versões */}
                        <div style={{ paddingTop:14, borderTop:'1px solid rgba(0,0,0,0.05)' }}>
                          <div style={{ fontSize:11, fontWeight:700, color:'#7c3aed', textTransform:'uppercase', letterSpacing:'0.8px', marginBottom:12 }}>Controle de versões</div>

                          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, flexWrap:'wrap' }}>
                            <span style={{ fontSize:12, color:'#475569' }}>🎥 Aula gravada em</span>
                            <input type="date" value={t.gravado_em || ''} onChange={e=>setGravadoEm(t, e.target.value)}
                              style={{ background:'rgba(0,0,0,0.05)', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, padding:'6px 10px', color:'#1e293b', fontSize:12, outline:'none', colorScheme:'light' }} />
                            {t.gravado_em && <button onClick={()=>setGravadoEm(t,'')} style={{ background:'none', border:'none', color:'#64748b', fontSize:11, cursor:'pointer' }}>limpar</button>}

                            <span style={{ fontSize:12, color:'#475569', marginLeft:8 }}>👤 Professor designado</span>
                            {(() => {
                              const daDisciplina = professores.filter(p => p.disciplina_ids.includes(t.disciplina_id))
                              const outros = professores.filter(p => !p.disciplina_ids.includes(t.disciplina_id))
                              const conhecido = professores.some(p => p.nome === t.responsavel)
                              return (
                                <select value={t.responsavel || ''} onChange={e=>setResponsavel(t, e.target.value)}
                                  style={{ background:'rgba(0,0,0,0.05)', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, padding:'6px 10px', color:'#1e293b', fontSize:12, outline:'none', minWidth:180, cursor:'pointer' }}>
                                  <option value="">— Selecionar professor —</option>
                                  {t.responsavel && !conhecido && <option value={t.responsavel}>{t.responsavel}</option>}
                                  {daDisciplina.length > 0 && (
                                    <optgroup label="Desta disciplina">
                                      {daDisciplina.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                    </optgroup>
                                  )}
                                  {outros.length > 0 && (
                                    <optgroup label="Outros professores">
                                      {outros.map(p => <option key={p.id} value={p.nome}>{p.nome}</option>)}
                                    </optgroup>
                                  )}
                                </select>
                              )
                            })()}
                            {t.responsavel && <button onClick={()=>setResponsavel(t,'')} style={{ background:'none', border:'none', color:'#64748b', fontSize:11, cursor:'pointer' }}>limpar</button>}
                          </div>

                          <div style={{ fontSize:12, color:'#475569', marginBottom:8 }}>📝 Revisões do material</div>
                          <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:10 }}>
                            {revLoading[t.id] && <div style={{ fontSize:12, color:'#94a3b8' }}>Carregando...</div>}
                            {!revLoading[t.id] && (revisoes[t.id]?.length ?? 0) === 0 && <div style={{ fontSize:12, color:'#94a3b8' }}>Nenhuma revisão registrada ainda.</div>}
                            {(revisoes[t.id] || []).map(r => (
                              <div key={r.id} style={{ background:'rgba(0,0,0,0.02)', border:'1px solid rgba(0,0,0,0.06)', borderRadius:8, padding:'8px 10px', display:'flex', gap:10, alignItems:'flex-start' }}>
                                <div style={{ fontSize:11, color:'#7c3aed', fontWeight:600, whiteSpace:'nowrap', paddingTop:1 }}>{fmtBR(r.revisado_em)}</div>
                                <div style={{ flex:1, minWidth:0 }}>
                                  <div style={{ fontSize:13, color:'#334155', lineHeight:1.4 }}>{r.o_que_mudou}</div>
                                  {r.autor && <div style={{ fontSize:10.5, color:'#94a3b8', marginTop:2 }}>por {r.autor}</div>}
                                </div>
                                <button onClick={()=>removeRevisao(t, r.id)} title="Remover" style={{ background:'none', border:'none', color:'#64748b', fontSize:12, cursor:'pointer', flexShrink:0 }}>✕</button>
                              </div>
                            ))}
                          </div>

                          <div style={{ display:'flex', gap:8, alignItems:'flex-start', flexWrap:'wrap' }}>
                            <input type="date" value={revForm.data} onChange={e=>setRevForm(f=>({...f, data:e.target.value}))}
                              style={{ background:'rgba(0,0,0,0.05)', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, padding:'8px 10px', color:'#1e293b', fontSize:12, outline:'none', colorScheme:'light' }} />
                            <input value={revForm.texto} onChange={e=>setRevForm(f=>({...f, texto:e.target.value}))} placeholder="O que mudou nesta revisão?"
                              onKeyDown={e=>{ if(e.key==='Enter') submitRevisao(t) }}
                              style={{ flex:1, minWidth:200, background:'rgba(0,0,0,0.05)', border:'1px solid rgba(0,0,0,0.1)', borderRadius:8, padding:'8px 12px', color:'#1e293b', fontSize:13, outline:'none' }} />
                            <button onClick={()=>submitRevisao(t)} disabled={revSaving || !revForm.texto.trim()}
                              style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', border:'none', borderRadius:8, padding:'8px 14px', color:'#fff', fontSize:12, fontWeight:600, cursor: revSaving||!revForm.texto.trim()?'not-allowed':'pointer', opacity: revSaving||!revForm.texto.trim()?0.6:1, whiteSpace:'nowrap' }}>+ Registrar</button>
                          </div>
                          {revErro && <div style={{ marginTop:10, fontSize:11.5, color:'#dc2626', lineHeight:1.5 }}>⚠️ {revErro}<br/><span style={{ color:'#475569' }}>Confira se o <code>migration-versionamento.sql</code> já foi rodado no Supabase (SQL Editor → Run).</span></div>}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
            {filtered.length===0 && <div style={{ textAlign:'center', padding:60, color:'#94a3b8' }}>Nenhum tema encontrado.</div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function DisciplinasPage() {
  return (
    <Suspense fallback={<div style={{ background:'#f4f6fb', minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#94a3b8' }}>Carregando...</div>}>
      <Inner />
    </Suspense>
  )
}
