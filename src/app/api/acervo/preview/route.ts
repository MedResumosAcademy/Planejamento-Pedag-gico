import { authorizeAcervo, acervoError, AcervoError, readLimitedJson, fetchMetadataSnapshot } from '@/lib/acervo-server'
import { itemKey, parseSnapshot, type AcervoStored } from '@/lib/acervo-contract'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { admin, user } = await authorizeAcervo(request)
    const body = await readLimitedJson(request) as Record<string, unknown>
    let snapshot
    try { snapshot = body?.mode === 'feed' ? await fetchMetadataSnapshot() : parseSnapshot(body) }
    catch (error) { if (error instanceof AcervoError) throw error; throw new AcervoError(error instanceof Error ? error.message : 'Arquivo inválido.') }
    const existing = new Map<string, AcervoStored>()
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from('acervo_itens').select('*').eq('source', snapshot.source).eq('environment', snapshot.environment).eq('instance', snapshot.instance).order('id').range(offset, offset + 999)
      if (error) throw error
      for (const row of data as AcervoStored[]) existing.set(itemKey(row), row)
      if (data.length < 1000) break
      if (offset >= 19_000) throw new AcervoError('Origem acima do limite desta prévia.', 503)
    }
    const comparisons = snapshot.items.map(item => {
      const old = existing.get(itemKey(item))
      const conflict = old && (Date.parse(snapshot.observed_at) < Date.parse(old.observed_at) || Date.parse(item.updated_at) < Date.parse(old.updated_at) || item.category !== old.category || item.kind !== old.kind)
      const changed = old && ['cycle', 'label', 'taxonomy_label', 'native_status', 'updated_at'].some(key => String(item[key as keyof typeof item]) !== String(old[key as keyof typeof old]))
      const factChanged = old && JSON.stringify(item.facts) !== JSON.stringify(old.facts)
      return { ...item, action: conflict ? 'conflict' : !old ? 'new' : changed || factChanged ? 'updated' : 'unchanged', tema_id: old?.tema_id ?? null }
    })
    if (comparisons.some(item => item.action === 'conflict')) throw new AcervoError('Arquivo antigo ou identidade incompatível com o acervo salvo. Refaça a coleta; nada foi alterado.', 409)
    const baseline = snapshot.items.map(item => ({ entity: item.entity, external_id: item.external_id, synced_at: existing.get(itemKey(item))?.synced_at ?? null }))
    const { data: run, error } = await admin.from('acervo_importacoes').insert({ actor_id: user.id, payload: { snapshot, baseline } }).select('id,expires_at').single()
    if (error) throw error
    return Response.json({ ...run, source: snapshot.source, environment: snapshot.environment, instance: snapshot.instance, observed_at: snapshot.observed_at, items: comparisons })
  } catch (error) { return acervoError(error) }
}
