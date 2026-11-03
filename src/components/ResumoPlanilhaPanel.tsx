import type { Ciclo } from '@/lib/cycles'
import { RESUMOS_PLANILHA, resumoPlanilha, resumoPlanilhaColeta, resumoPlanilhaPct } from '@/lib/resumos-planilha'

export default function ResumoPlanilhaPanel({ ciclo }: { ciclo: Ciclo }) {
  const data = resumoPlanilha(ciclo)
  const pct = resumoPlanilhaPct(ciclo)
  return (
    <section aria-label="Inventário de resumos da planilha" style={{ background:'#ecfdf5', border:'1px solid #86efac', borderRadius:16, padding:'20px 24px', margin:'0 0 24px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:16, flexWrap:'wrap' }}>
        <div>
          <h2 style={{ fontSize:16, fontWeight:700, color:'#14532d', margin:'0 0 6px' }}>Resumos · inventário da planilha</h2>
          <p style={{ fontSize:12, color:'#166534', margin:0 }}>Retrato da planilha: PDFs considerados prontos; Drive lido em {resumoPlanilhaColeta(ciclo)}. Atualização manual, não sincronizada em tempo real.</p>
        </div>
        <a href={RESUMOS_PLANILHA.source_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:12, color:'#166534', textDecoration:'underline' }}>Abrir planilha de origem</a>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(135px,1fr))', gap:12, marginTop:18 }}>
        {([
          ['Temas na planilha', data.temas], ['PDFs prontos', data.prontos], ['Faltando', data.faltando], ['Concluído', `${pct}%`],
        ] as const).map(([label, value]) => (
          <div key={label} style={{ background:'#fff', border:'1px solid #bbf7d0', borderRadius:10, padding:'12px 14px' }}>
            <div style={{ fontSize:11, color:'#166534' }}>{label}</div>
            <div style={{ fontSize:23, fontWeight:700, color:'#14532d', marginTop:4 }}>{value}</div>
          </div>
        ))}
      </div>
      <p style={{ fontSize:12, color:'#166534', margin:'14px 0 0' }}>Totais do ciclo inteiro: filtros do painel não se aplicam a este inventário. Os temas e etapas editoriais cadastrados aparecem separadamente abaixo e não alteram estes totais.</p>
      <details style={{ marginTop:14 }}>
        <summary style={{ cursor:'pointer', fontSize:12, fontWeight:600, color:'#14532d' }}>Ver as {data.disciplines.length} disciplinas da planilha</summary>
        <div style={{ marginTop:10, maxHeight:320, overflowY:'auto', background:'#fff', borderRadius:10, border:'1px solid #bbf7d0' }}>
          {data.disciplines.map(d => (
            <div key={d.nome} style={{ display:'flex', justifyContent:'space-between', gap:12, padding:'8px 12px', borderBottom:'1px solid #dcfce7', fontSize:12, color:'#334155' }}>
              <span>{d.nome}</span><span style={{ whiteSpace:'nowrap' }}>{d.prontos}/{d.temas} prontos · {d.faltando} faltando</span>
            </div>
          ))}
        </div>
      </details>
    </section>
  )
}
