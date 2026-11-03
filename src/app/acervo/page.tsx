'use client'

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import CategorySwitcher, { useContentCategory } from '@/components/CategorySwitcher'
import { CycleSwitcher, useCycle } from '@/components/CycleProvider'
import { useSession } from '@/hooks/useSession'
import { CONTENT_CATEGORIES } from '@/lib/content-categories'
import { ACERVO_STAGES, ACERVO_STAGE_LABELS, MAX_SNAPSHOT_BYTES, itemKey, summarizeAcervo, type AcervoStored, type AcervoItem } from '@/lib/acervo-contract'
import styles from './page.module.css'

type Theme = { id: number; disciplina_id: number; tema_especifico: string; disciplina_nome: string }
type PreviewItem = AcervoItem & { action: string; tema_id: number | null }
type Preview = { id: string; expires_at: string; source: string; environment: string; instance: string; observed_at: string; items: PreviewItem[] }
type Inventory = { items: AcervoStored[]; runs: { id: string; applied_at: string; applied_count: number }[]; feedConfigured: boolean }
const date = (value: string) => new Date(value).toLocaleString('pt-BR')
const actionLabel: Record<string, string> = { new: 'Novo', updated: 'Atualizar', unchanged: 'Sem mudança nos metadados' }

async function jsonResponse(response: Response) {
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Não foi possível concluir.')
  return result
}

function AcervoInner() {
  const { session, loading: sessionLoading, isCoordinator } = useSession()
  const { ciclo } = useCycle()
  const { category, setCategory } = useContentCategory()
  const [inventory, setInventory] = useState<Inventory | null>(null)
  const [themes, setThemes] = useState<Theme[]>([])
  const [preview, setPreview] = useState<Preview | null>(null)
  const [bindings, setBindings] = useState<Record<string, number | null>>({})
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [ack, setAck] = useState(false)
  const [mode, setMode] = useState<'content' | 'batch'>('content')
  const [search, setSearch] = useState('')
  const [environment, setEnvironment] = useState<'production' | 'staging'>('production')
  const [selectedSource, setSelectedSource] = useState('')

  const load = useCallback(async () => {
    const next = await jsonResponse(await fetch('/api/acervo', { cache: 'no-store' }))
    setInventory(next)
  }, [])
  useEffect(() => {
    if (!isCoordinator) return
    let active = true
    fetch('/api/acervo', { cache: 'no-store' }).then(jsonResponse).then(data => { if (active) setInventory(data) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [isCoordinator])
  useEffect(() => {
    setPreview(null); setBindings({}); setAck(false); setThemes([])
    if (!isCoordinator) return
    let active = true
    fetch(`/api/themes?ciclo=${ciclo}`).then(jsonResponse).then(data => { if (active) setThemes(data) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [ciclo, isCoordinator])

  const sourceKey = (item: AcervoStored) => `${item.source} / ${item.instance}`
  const sources = Array.from(new Set((inventory?.items || []).filter(item => item.environment === environment).map(sourceKey))).sort()
  const activeSource = sources.includes(selectedSource) ? selectedSource : sources[0] ?? ''
  const cycleItems = useMemo(() => (inventory?.items || []).filter(item => item.cycle === ciclo && item.environment === environment && `${item.source} / ${item.instance}` === activeSource), [inventory, ciclo, environment, activeSource])
  const summary = summarizeAcervo(cycleItems, category)
  const unclassified = (inventory?.items || []).filter(item => item.cycle === null && item.environment === environment && sourceKey(item) === activeSource).length
  const rows = cycleItems.filter(item => item.category === category && item.kind === mode && `${item.label} ${item.taxonomy_label ?? ''} ${item.external_id}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()))

  async function makePreview(input: unknown) {
    setBusy(true); setError(''); setNotice(''); setPreview(null); setAck(false)
    try {
      const next: Preview = await jsonResponse(await fetch('/api/acervo/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }))
      setPreview(next)
      setBindings(Object.fromEntries(next.items.map(item => [itemKey(item), item.tema_id])))
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha na prévia.') }
    finally { setBusy(false) }
  }
  async function readFile(file?: File) {
    if (!file) return
    setError(''); setPreview(null); setAck(false)
    if (file.size > MAX_SNAPSHOT_BYTES) { setError('O arquivo deve ter no máximo 2 MB.'); return }
    try { await makePreview(JSON.parse(await file.text())) }
    catch { setError('Arquivo JSON inválido. Use o contrato de metadados v1.') }
  }
  async function apply() {
    if (!preview || !ack) return
    setBusy(true); setError('')
    try {
      const result = await jsonResponse(await fetch('/api/acervo/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ preview_id: preview.id, bindings: preview.items.map(item => ({ entity: item.entity, external_id: item.external_id, tema_id: bindings[itemKey(item)] ?? null })) }) }))
      setPreview(null); setAck(false)
      setNotice(`${result.applied} registros sincronizados. O planejamento manual foi preservado.`)
      await load()
    } catch (e) { setError(e instanceof Error ? e.message : 'Falha ao aplicar.') }
    finally { setBusy(false) }
  }

  if (sessionLoading) return <main className={styles.loading}>Carregando acesso…</main>
  if (!session) return <main className={styles.loading}><Link href="/login">Entrar para acessar o painel</Link></main>
  if (!isCoordinator) return <main className={styles.loading}>Área de gestão. <Link href="/">Voltar ao painel</Link></main>
  return <>
    <div className={styles.sidebar}><Sidebar session={session} /></div>
    <main className={styles.main}>
      <header className={styles.header}>
        <div><Link href="/">← Painel</Link><p className={styles.eyebrow}>GESTÃO DE CONTEÚDO</p><h1>Acervo e fábricas</h1><p>O que existe na origem, separado do planejamento editorial.</p></div>
        <CycleSwitcher />
      </header>
      <CategorySwitcher category={category} onChange={setCategory} />
      <div className={styles.factoryLinks} aria-label="Origens das fábricas" role="group">
        <a href="https://mra-fabrica-de-questoes.medresumosof.workers.dev/" target="_blank" rel="noopener noreferrer">Abrir fábrica de questões ↗</a>
        <a href="https://app-staging.mracademy.com.br/admin/fabrica-flashcards" target="_blank" rel="noopener noreferrer">Abrir fábrica de flashcards — staging ↗</a>
        <span>CLI do Welber no MRA Project · sincronização de metadados pendente</span>
      </div>
      {error && <div role="alert" className={styles.error}>{error}</div>}
      {notice && <div role="status" className={styles.success}>{notice}</div>}
      <section className={styles.connection} aria-label="Conexão com as fontes">
        <div><strong>{inventory?.feedConfigured ? 'Fonte de metadados configurada' : 'Conexão direta pendente'}</strong><p>Apenas leitura da origem. Nenhuma geração, aprovação ou publicação será disparada.</p></div>
        <div className={styles.actions}>
          <button disabled={busy || !inventory?.feedConfigured} onClick={() => makePreview({ mode: 'feed' })}>Buscar na origem</button>
          <label className={styles.file}>Prévia de arquivo JSON<input aria-label="Importar arquivo de metadados JSON" type="file" accept="application/json,.json" disabled={busy || !inventory} onChange={event => { void readFile(event.target.files?.[0]); event.target.value = '' }} /></label>
        </div>
      </section>
      <div className={styles.filters}>
        <label>Ambiente da origem <select value={environment} onChange={event => setEnvironment(event.target.value as typeof environment)}><option value="production">Produção — leitura</option><option value="staging">Staging — teste</option></select></label>
        <label>Fonte <select value={activeSource} onChange={event => setSelectedSource(event.target.value)}>{sources.length ? sources.map(source => <option key={source}>{source}</option>) : <option value="">Nenhuma importada</option>}</select></label>
        <span>Última importação: {inventory?.runs[0] ? date(inventory.runs[0].applied_at) : 'nenhuma'}</span>
      </div>
      <section className={styles.cards} aria-label="Contagens de conteúdo importado">
        <article><span>Registros de {CONTENT_CATEGORIES[category].label.toLocaleLowerCase()}</span><strong>{inventory ? summary.total : '—'}</strong><small>Conteúdo identificado; lotes não entram nesta soma.</small></article>
        {ACERVO_STAGES.map(stage => <article key={stage}><span>{ACERVO_STAGE_LABELS[stage]}</span><strong>{inventory ? summary.stages[stage].count : '—'}</strong><small>{summary.stages[stage].unknown} sem informação desta etapa</small></article>)}
      </section>
      <p className={styles.hint}>As etapas são independentes: publicado não comprova revisão humana. As fontes não são somadas entre si, pois podem representar o mesmo conteúdo. {unclassified > 0 && `${unclassified} registros sem ciclo ficam fora das contagens; corrija a classificação na origem e importe novamente.`}</p>
      {preview && <section className={styles.preview} aria-label="Prévia da importação">
        <h2>Revisar antes de aplicar</h2>
        <p>{preview.source} · {preview.environment} · {preview.instance} · coleta em {date(preview.observed_at)}</p>
        <p>{preview.items.length} registros. A prévia expira em {date(preview.expires_at)}. Itens ausentes do arquivo não serão excluídos.</p>
        <div className={styles.tableWrap}><table><thead><tr><th>Registro / origem</th><th>Alteração</th><th>Ciclo</th><th>Vincular ao planejamento</th></tr></thead><tbody>{preview.items.map(item => <tr key={itemKey(item)}>
          <td>{item.label}<small>{CONTENT_CATEGORIES[item.category].label} · {item.kind === 'batch' ? 'Lote' : 'Conteúdo'} · {item.taxonomy_label || 'Sem taxonomia'}</small></td>
          <td>{actionLabel[item.action]}<small>{ACERVO_STAGES.map(stage => `${ACERVO_STAGE_LABELS[stage]}: ${item.facts[stage] ?? 'não informado'}`).join(' · ')}</small></td><td>{item.cycle || 'Sem classificação'}</td>
          <td>{item.cycle === ciclo ? <select aria-label={`Tema para ${item.label}`} value={bindings[itemKey(item)] ?? ''} onChange={event => { setAck(false); setBindings(previous => ({ ...previous, [itemKey(item)]: event.target.value ? Number(event.target.value) : null })) }}><option value="">Sem vínculo com tema</option>{themes.map(theme => <option key={theme.id} value={theme.id}>{theme.disciplina_nome} — {theme.tema_especifico}</option>)}</select> : <span>{item.tema_id ? `Vínculo existente #${item.tema_id} preservado` : 'Sem vínculo; selecione esse ciclo para associar em nova prévia.'}</span>}</td>
        </tr>)}</tbody></table></div>
        <label className={styles.confirm}><input type="checkbox" checked={ack} onChange={event => setAck(event.target.checked)} /> Conferi a origem, o escopo compartilhado e os vínculos. Importar somente metadados, sem alterar etapas manuais.</label>
        <div className={styles.actions}><button disabled={busy || !ack} onClick={apply}>{busy ? 'Processando…' : 'Confirmar importação'}</button><button disabled={busy} onClick={() => setPreview(null)}>Cancelar prévia</button></div>
      </section>}
      <section className={styles.inventory}>
        <div className={styles.filters}><h2>{mode === 'batch' ? 'Acompanhamento das fábricas' : 'Conteúdo sincronizado'}</h2><div className={styles.actions}><button aria-pressed={mode === 'content'} onClick={() => setMode('content')}>Conteúdo</button><button aria-pressed={mode === 'batch'} onClick={() => setMode('batch')}>Lotes ({summary.batches})</button></div></div>
        <label className={styles.search}>Buscar por identificação ou taxonomia<input value={search} onChange={event => setSearch(event.target.value)} placeholder="Nome, ID ou disciplina" /></label>
        {rows.length === 0 ? <div className={styles.empty}><h3>{inventory ? 'Nenhum registro importado nesta seleção' : 'Acervo ainda indisponível'}</h3><p>{mode === 'batch' ? 'Conecte a fábrica ou importe seus metadados para acompanhar lotes. Isso não inicia novas gerações.' : 'Os dados do planejamento continuam em Disciplinas. Esta área só mostra conteúdo confirmado por uma importação.'}</p><Link href={`/disciplinas?categoria=${category}`}>Ver planejamento de {CONTENT_CATEGORIES[category].label.toLocaleLowerCase()}</Link></div> : <div className={styles.tableWrap}><table><thead><tr><th>Registro</th><th>Origem / estado</th>{ACERVO_STAGES.map(stage => <th key={stage}>{ACERVO_STAGE_LABELS[stage]}</th>)}<th>Vínculo / coleta</th></tr></thead><tbody>{rows.map(item => <tr key={item.id}><td>{item.label}<small>{item.taxonomy_label || 'Sem classificação'} · {item.entity} / {item.external_id}</small></td><td>{item.source}<small>{item.instance} · {item.native_status || 'Não informado'}</small></td>{ACERVO_STAGES.map(stage => <td key={stage}>{item.facts[stage] ?? '—'}</td>)}<td>{item.tema_id && themes.find(theme => theme.id === item.tema_id) ? <Link href={`/disciplinas?categoria=${category}&id=${themes.find(theme => theme.id === item.tema_id)!.disciplina_id}`}>Tema #{item.tema_id}</Link> : item.tema_id ? `Tema #${item.tema_id}` : 'Sem vínculo'}<small>{date(item.observed_at)}</small></td></tr>)}</tbody></table></div>}
      </section>
    </main>
  </>
}
export default function AcervoPage() { return <Suspense fallback={<main className={styles.loading}>Carregando acervo…</main>}><AcervoInner /></Suspense> }
