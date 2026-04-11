'use client'
export const dynamic = 'force-dynamic'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface DiscStats {
  id: number; nome: string; cor: string; microassunto: string | null
  total_temas: number; concluidos: number; em_andamento: number; pendentes: number
  paginas_totais: number; progresso_geral: number
}
interface UserInfo { id: string; nivel: string; nome: string }

export default function Dashboard() {
  const router = useRouter()
  const [disciplinas, setDisciplinas] = useState<DiscStats[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [professorDisciplinas, setProfessorDisciplinas] = useState<number[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: colab } = await supabase.from('colaboradores').select('nivel, nome').eq('id', user.id).single()
      if (colab) {
        setUserInfo({ id: user.id, nivel: colab.nivel, nome: colab.nome })
        if (colab.nivel === 'professor') {
          const { data: pd } = await supabase.from('professor_disciplinas').select('disciplina_id').eq('professor_id', user.id)
          setProfessorDisciplinas(pd?.map(d => d.disciplina_id) || [])
        }
      }
    }
    const r = await fetch('/api/disciplines')
    setDisciplinas(await r.json())
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const isProfessor = userInfo?.nivel === 'professor'
  const isCoordinator = userInfo?.nivel === 'coordenador'

  const filtered = disciplinas
    .filter(d => isProfessor ? professorDisciplinas.includes(d.id) : true)
    .filter(d => d.nome.toLowerCase().includes(busca.toLowerCase()))

  const totalTemas = filtered.reduce((a, d) => a + d.total_temas, 0)
  const totalConcluidos = filtered.reduce((a, d) => a + d.concluidos, 0)
  const totalAndamento = filtered.reduce((a, d) => a + d.em_andamento, 0)
  const totalPaginas = filtered.reduce((a, d) => a + (d.paginas_totais || 0), 0)
  const progressoGeral = totalTemas > 0 ? Math.round(totalConcluidos * 100 / totalTemas) : 0

  const navItems = [
    { href:'/', label:'Dashboard', icon:'📊' },
    { href:'/disciplinas', label:'Disciplinas', icon:'📚' },
    { href:'/kanban', label:'Kanban', icon:'🗂️' },
    { href:'/agenda', label:'Agenda', icon:'📅' },
    ...(isCoordinator ? [{ href:'/admin/colaboradores', label:'Collaborators', icon:'👥' }] : [])
  ]

  const SW = sidebarOpen ? 220 : 64

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'#0a0d14' }}>
      <div style={{ width:SW, background:'rgba(255,255,255,0.02)', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', position:'fixed', top:0, bottom:0, left:0, transition:'width 0.2s ease', overflow:'hidden' }}>
        <div style={{ padding:'20px 16px', borderBottom:'1px solid rgba(255,255,255,0.06)', display:'flex', alignItems:'center', justifyContent:'space-between', minHeight:72 }}>
          {sidebarOpen ? (
            <>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'white', flexShrink:0 }}>M</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:700, color:'#e2e8f0', whiteSpace:'nowrap' }}>Med2026</div>
                  <div style={{ fontSize:10, color:'#64748b', whiteSpace:'nowrap' }}>Ciclo Básico</div>
                </div>
              </div>
              <button onClick={() => setSidebarOpen(false)} style={{ background:'rgba(255,255,255,0.05)', border:'none', borderRadius:6, padding:'4px 8px', color:'#64748b', cursor:'pointer', fontSize:14 }}>←</button>
            </>
          ) : (
            <div style={{ width:'100%', display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
              <div style={{ width:32, height:32, borderRadius:8, background:'linear-gradient(135deg,#6366f1,#8b5cf6)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:700, color:'white' }}>M</div>
              <button onClick={() => setSidebarOpen(true)} style={{ background:'none', border:'none', color:'#64748b', cursor:'pointer', fontSize:14 }}>→</button>
            </div>
          )}
        </div>
        <nav style={{ padding:'12px 8px', flex:1 }}>
          {navItems.map(item => (
            <Link key={item.href} href={item.href} style={{ textDecoration:'none' }}>
              <div title={!sidebarOpen ? item.label : ''} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, color: item.href==='/' ? '#a78bfa' : '#64748b', background: item.href==='/' ? 'rgba(167,139,250,0.1)' : 'transparent', fontSize:13, fontWeight:500, marginBottom:2, cursor:'pointer', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
                <span style={{ flexShrink:0 }}>{item.icon}</span>
                {sidebarOpen && item.label}
              </div>
            </Link>
          ))}
        </nav>
        <div style={{ padding:'16px 8px', borderTop:'1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={handleLogout} style={{ width:'100%', display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:8, color:'#64748b', background:'transparent', border:'none', fontSize:13, cursor:'pointer', justifyContent: sidebarOpen ? 'flex-start' : 'center' }}>
            <span>🚪</span>{sidebarOpen && 'Sign Out'}
          </button>
        </div>
        {sidebarOpen && (
          <div style={{ padding:'0 20px 16px', fontSize:11, color:'#475569' }}>
            {userInfo?.nome && <div style={{ marginBottom:4, color:'#64748b', fontWeight:500, fontSize:12 }}>{userInfo.nome}</div>}
            258 temas · 18 disciplinas<br/>~2.136 páginas
          </div>
        )}
      </div>

      <div style={{ marginLeft:SW, flex:1, padding:'32px 40px', transition:'margin-left 0.2s ease' }}>
        <div style={{ marginBottom:32 }}>
          <h1 style={{ fontSize:28, fontWeight:700, color:'#f1f5f9', letterSpacing:'-0.5px' }}>
            {isProfessor ? `Olá, ${userInfo?.nome?.split(' ')[0]}! 👋` : 'Dashboard de Produção'}
          </h1>
          <p style={{ color:'#64748b', fontSize:14, marginTop:6 }}>
            {isProfessor ? 'Your disciplines and progress' : 'Ciclo Básico de Medicina 2026'}
          </p>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16, marginBottom:32 }}>
          {[
            { label:'Progresso Geral', value:`${progressoGeral}%`, sub:`${totalConcluidos} de ${totalTemas} temas`, color:'#a78bfa' },
            { label:'Em Andamento', value:totalAndamento, sub:'temas em produção', color:'#fbbf24' },
            { label:'Concluídos', value:totalConcluidos, sub:'temas finalizados', color:'#4ade80' },
            { label:'Total de Páginas', value:totalPaginas.toLocaleString('pt-BR'), sub:'meta: 2.136 pgs', color:'#60a5fa' },
          ].map(kpi => (
            <div key={kpi.label} style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'20px 24px' }}>
              <div style={{ fontSize:11, color:'#64748b', marginBottom:8, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px' }}>{kpi.label}</div>
              <div style={{ fontSize:32, fontWeight:700, color:kpi.color, lineHeight:1 }}>{kpi.value}</div>
              <div style={{ fontSize:12, color:'#475569', marginTop:6 }}>{kpi.sub}</div>
            </div>
          ))}
        </div>

        <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:16, padding:'20px 24px', marginBottom:32 }}>
          <div style={{ display:'flex', justifyContent:'space-between', marginBottom:10 }}>
            <span style={{ fontSize:13, fontWeight:600, color:'#cbd5e1' }}>Progresso Total</span>
            <span style={{ fontSize:13, color:'#a78bfa', fontWeight:700 }}>{progressoGeral}%</span>
          </div>
          <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:6, height:10, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:6, width:`${progressoGeral}%`, background:'linear-gradient(90deg,#6366f1,#a78bfa)', transition:'width 0.8s ease' }} />
          </div>
          <div style={{ display:'flex', gap:24, marginTop:12 }}>
            {[{label:'Concluídos',color:'#4ade80',n:totalConcluidos},{label:'Em Andamento',color:'#fbbf24',n:totalAndamento},{label:'Pendentes',color:'#64748b',n:totalTemas-totalConcluidos-totalAndamento}].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#94a3b8' }}>
                <span style={{ width:8, height:8, borderRadius:'50%', background:l.color, display:'inline-block' }} />
                {l.label}: <strong style={{ color:'#e2e8f0', marginLeft:4 }}>{l.n}</strong>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginBottom:20 }}>
          <input value={busca} onChange={e => setBusca(e.target.value)} placeholder="🔍  Buscar disciplina..."
            style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:10, padding:'8px 14px', color:'#e2e8f0', fontSize:13, outline:'none', width:300 }} />
        </div>

        {loading ? (
          <div style={{ textAlign:'center', padding:60, color:'#475569' }}>Carregando...</div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:16 }}>
            {filtered.map(d => {
              const pct = d.progresso_geral || 0
              return (
                <Link key={d.id} href={`/disciplinas?id=${d.id}`} style={{ textDecoration:'none' }}>
                  <div style={{ background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.06)', borderRadius:14, padding:'18px 20px', cursor:'pointer', transition:'all 0.2s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor=`${d.cor}60`; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor='rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.03)' }}
                  >
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                      <div>
                        <div style={{ fontSize:14, fontWeight:600, color:'#e2e8f0' }}>{d.nome}</div>
                        {d.microassunto && <div style={{ fontSize:11, color:'#475569', marginTop:2 }}>{d.microassunto}</div>}
                      </div>
                      <div style={{ textAlign:'right' }}>
                        <div style={{ fontSize:22, fontWeight:700, color:d.cor }}>{pct}%</div>
                        <div style={{ fontSize:10, color:'#475569' }}>{d.total_temas} temas</div>
                      </div>
                    </div>
                    <div style={{ background:'rgba(255,255,255,0.06)', borderRadius:4, height:6, overflow:'hidden', marginBottom:12 }}>
                      <div style={{ height:'100%', borderRadius:4, width:`${pct}%`, background:d.cor, transition:'width 0.5s ease' }} />
                    </div>
                    <div style={{ display:'flex', gap:12 }}>
                      {[{l:'✓',v:d.concluidos,c:'#4ade80'},{l:'◐',v:d.em_andamento,c:'#fbbf24'},{l:'○',v:d.pendentes,c:'#475569'}].map(s => (
                        <div key={s.l} style={{ fontSize:12, color:s.c, fontWeight:600 }}>{s.l} {s.v}</div>
                      ))}
                      {d.paginas_totais > 0 && <div style={{ fontSize:12, color:'#60a5fa', marginLeft:'auto', fontWeight:600 }}>{d.paginas_totais}p</div>}
                    </div>
                  </div>
                </Link>
              )
            })}
            {filtered.length === 0 && <div style={{ color:'#475569', fontSize:14, padding:40 }}>No disciplines found.</div>}
          </div>
        )}
      </div>
    </div>
  )
}
