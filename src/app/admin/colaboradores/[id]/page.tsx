'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_COLOR: Record<string, string> = { pendente:'#475569', em_andamento:'#fbbf24', concluido:'#4ade80' }
const STATUS_LABEL: Record<string, string> = { pendente:'Pending', em_andamento:'In Progress', concluido:'Done' }

const SUB_STATUS_LABELS: Record<string, string> = {
  mat_atualizado: 'Updated', mat_revisado: 'Revised', mat_diagramado: 'Diagrammed', mat_conferencia: 'Checked',
  vid_slide: 'Slide', vid_gravacao: 'Recording', vid_edicao: 'Editing',
  comp_simulado: 'Simulation', comp_questoes: 'Questions', comp_flashcards: 'Flashcards'
}

interface Professor {
  id: string; nome: string; email: string; telefone: string | null; criado_em: string
  professor_disciplinas?: { disciplina_id: number }[]
  professor_horarios?: { dia_semana: number; hora_inicio: string; hora_fim: string }[]
}

interface Tema {
  id: number; tema_especifico: string; status_geral: string
  mat_atualizado: string; mat_revisado: string; mat_diagramado: string; mat_conferencia: string
  vid_slide: string; vid_gravacao: string; vid_edicao: string
  comp_simulado: string; comp_questoes: string; comp_flashcards: string
  disciplinas?: { nome: string; cor: string }
}

interface Gravacao {
  id: number; data_hora: string; status: string
  disciplinas?: { nome: string }; temas?: { tema_especifico: string }
}

export default function ProfessorProfilePage() {
  const { id } = useParams()
  const router = useRouter()
  const [professor, setProfessor] = useState<Professor | null>(null)
  const [temas, setTemas] = useState<Tema[]>([])
  const [gravacoes, setGravacoes] = useState<Gravacao[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'temas' | 'agenda'>('overview')

  const supabase = createClient()

  useEffect(() => {
    async function load() {
      setLoading(true)
      const [{ data: prof }, { data: gravs }] = await Promise.all([
        supabase.from('colaboradores')
          .select('*, professor_disciplinas(disciplina_id), professor_horarios(dia_semana, hora_inicio, hora_fim)')
          .eq('id', id).single(),
        supabase.from('gravacoes')
          .select('*, disciplinas(nome), temas(tema_especifico)')
          .eq('professor_id', id)
          .order('data_hora', { ascending: false })
          .limit(20)
      ])
      setProfessor(prof)
      setGravacoes(gravs || [])

      if (prof?.professor_disciplinas?.length) {
        const discIds = prof.professor_disciplinas.map((d: any) => d.disciplina_id)
        const { data: ts } = await supabase
          .from('temas')
          .select('*, disciplinas(nome, cor)')
          .in('disciplina_id', discIds)
          .order('disciplina_id').order('ordem')
        setTemas(ts || [])
      }
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div style={{ minHeight:'100vh', background:'#0a0d14', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569' }}>Loading...</div>
  if (!professor) return <div style={{ minHeight:'100vh', background:'#0a0d14', display:'flex', alignItems:'center', justifyContent:'center', color:'#f87171' }}>Professor not found.</div>

  const totalTemas = temas.length
  const concluidos = temas.filter(t => t.status_geral === 'concluido').length
  const emAndamento = temas.filter(t => t.status_geral === 'em_andamento').length
  const progresso = totalTemas > 0 ? Math.round(concluidos * 100 / totalTemas) : 0

  const gravsAprovadas = gravacoes.filter(g => g.status === 'aprovada').length
  const gravsConcluidas = gravacoes.filter(g => g.status === 'concluida').length

  const tabStyle = (tab: string) => ({
    padding:'8px 18px', borderRadius:8, border:'none', fontSize:13, fontWeight:600, cursor:'pointer',
    background: activeTab === tab ? 'rgba(99,102,241,0.15)' : 'transparent',
    color: activeTab === tab ? '#a78bfa' : '#64748b'
  })

  return (
    <div style={{ minHeight:'100vh', background:'#0a0d14', padding:'32px 40px' }}>
      <div style={{ maxWidth:900, margin:'0 auto' }}>

        {/* Back */}
        <button onClick={() => router.back()} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:13, marginBottom:20, display:'flex', alignItems:'center', gap:6 }}>
          ← Back to Collaborators
        </button>

        {/* Profile header */}
        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'24px 28px', marginBottom:24, display:'flex', alignItems:'center', gap:20 }}>
          <div style={{ width:64, height:64, borderRadius:16, background:'linear-gradient(135deg,#0891b2,#0d9488)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:700, color:'white', flexShrink:0 }}>
            {professor.nome.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <h1 style={{ fontSize:22, fontWeight:700, color:'#f1f5f9', margin:0 }}>{professor.nome}</h1>
            <div style={{ fontSize:13, color:'#64748b', marginTop:4 }}>{professor.email}{professor.telefone ? ` · ${professor.telefone}` : ''}</div>
            <div style={{ fontSize:11, color:'#475569', marginTop:4 }}>Member since {new Date(professor.criado_em).toLocaleDateString('pt-BR')}</div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, textAlign:'center' }}>
            {[
              { label:'Progress', value:`${progresso}%`, color:'#a78bfa' },
              { label:'Recorded', value:gravsConcluidas, color:'#4ade80' },
              { label:'Pending', value:gravsAprovadas, color:'#fbbf24' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize:22, fontWeight:700, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11, color:'#64748b' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:4, marginBottom:20, background:'rgba(255,255,255,0.02)', borderRadius:10, padding:4, width:'fit-content' }}>
          <button style={tabStyle('overview')} onClick={() => setActiveTab('overview')}>Overview</button>
          <button style={tabStyle('temas')} onClick={() => setActiveTab('temas')}>Topics ({totalTemas})</button>
          <button style={tabStyle('agenda')} onClick={() => setActiveTab('agenda')}>Recordings ({gravacoes.length})</button>
        </div>

        {/* Overview tab */}
        {activeTab === 'overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'20px' }}>
              <h3 style={{ fontSize:13, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14 }}>Disciplines</h3>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {temas.length === 0 ? <div style={{ color:'#475569', fontSize:13 }}>No disciplines assigned.</div> :
                  [...new Map(temas.map(t => [t.disciplinas?.nome, t])).values()].map(t => {
                    const discTemas = temas.filter(tt => tt.disciplinas?.nome === t.disciplinas?.nome)
                    const done = discTemas.filter(tt => tt.status_geral === 'concluido').length
                    const pct = discTemas.length > 0 ? Math.round(done * 100 / discTemas.length) : 0
                    return (
                      <div key={t.disciplinas?.nome}>
                        <div style={{ display:'flex', justifyContent:'space-between', marginBottom:4 }}>
                          <span style={{ fontSize:13, color:'#e2e8f0' }}>{t.disciplinas?.nome}</span>
                          <span style={{ fontSize:12, color: t.disciplinas?.cor || '#64748b', fontWeight:600 }}>{pct}%</span>
                        </div>
                        <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:4, height:5, overflow:'hidden' }}>
                          <div style={{ height:'100%', width:`${pct}%`, background: t.disciplinas?.cor || '#6366f1', borderRadius:4 }} />
                        </div>
                      </div>
                    )
                  })
                }
              </div>
            </div>
            <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'20px' }}>
              <h3 style={{ fontSize:13, fontWeight:600, color:'#64748b', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:14 }}>Availability</h3>
              {(!professor.professor_horarios || professor.professor_horarios.length === 0) ? (
                <div style={{ color:'#475569', fontSize:13 }}>No availability registered.</div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {professor.professor_horarios.map((h, i) => (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', background:'rgba(255,255,255,0.03)', borderRadius:8 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#a78bfa', width:32 }}>{DAYS[h.dia_semana]}</span>
                      <span style={{ fontSize:12, color:'#94a3b8' }}>{h.hora_inicio.slice(0,5)} – {h.hora_fim.slice(0,5)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Topics tab */}
        {activeTab === 'temas' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {temas.map(t => {
              const subStatus = [
                { group:'Material', items:[{k:'mat_atualizado',v:t.mat_atualizado},{k:'mat_revisado',v:t.mat_revisado},{k:'mat_diagramado',v:t.mat_diagramado},{k:'mat_conferencia',v:t.mat_conferencia}] },
                { group:'Video', items:[{k:'vid_slide',v:t.vid_slide},{k:'vid_gravacao',v:t.vid_gravacao},{k:'vid_edicao',v:t.vid_edicao}] },
                { group:'Extras', items:[{k:'comp_simulado',v:t.comp_simulado},{k:'comp_questoes',v:t.comp_questoes},{k:'comp_flashcards',v:t.comp_flashcards}] },
              ]
              return (
                <div key={t.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'14px 18px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{t.tema_especifico}</div>
                      <div style={{ fontSize:11, color:'#64748b' }}>{t.disciplinas?.nome}</div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:600, padding:'3px 10px', borderRadius:6, background:`${STATUS_COLOR[t.status_geral]}20`, color:STATUS_COLOR[t.status_geral] }}>
                      {STATUS_LABEL[t.status_geral]}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:16, flexWrap:'wrap' }}>
                    {subStatus.map(group => (
                      <div key={group.group}>
                        <div style={{ fontSize:10, color:'#475569', fontWeight:600, marginBottom:4, textTransform:'uppercase' }}>{group.group}</div>
                        <div style={{ display:'flex', gap:4 }}>
                          {group.items.map(item => (
                            <div key={item.k} title={SUB_STATUS_LABELS[item.k]}
                              style={{ width:28, height:28, borderRadius:6, background:`${STATUS_COLOR[item.v]}20`, border:`1px solid ${STATUS_COLOR[item.v]}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:STATUS_COLOR[item.v], fontWeight:600 }}>
                              {item.v === 'concluido' ? '✓' : item.v === 'em_andamento' ? '◐' : '○'}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Recordings tab */}
        {activeTab === 'agenda' && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {gravacoes.length === 0 ? (
              <div style={{ color:'#475569', fontSize:13, padding:40, textAlign:'center' }}>No recordings yet.</div>
            ) : gravacoes.map(g => (
              <div key={g.id} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:12, padding:'14px 18px', display:'flex', alignItems:'center', gap:16 }}>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e2e8f0' }}>{g.disciplinas?.nome}</div>
                  <div style={{ fontSize:12, color:'#64748b' }}>{g.temas?.tema_especifico}</div>
                  <div style={{ fontSize:11, color:'#94a3b8', marginTop:4 }}>{new Date(g.data_hora).toLocaleString('pt-BR')}</div>
                </div>
                <span style={{ fontSize:11, fontWeight:600, padding:'4px 12px', borderRadius:6, background:`${STATUS_COLOR[g.status] || '#475569'}20`, color:STATUS_COLOR[g.status] || '#475569' }}>
                  {g.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
