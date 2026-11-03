import { authorizeAcervo, acervoError, feedConfigured, AcervoError } from '@/lib/acervo-server'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const { admin } = await authorizeAcervo()
    const items = []
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await admin.from('acervo_itens').select('*').order('id').range(offset, offset + 999)
      if (error) throw error
      items.push(...data)
      if (data.length < 1000) break
      if (offset >= 19_000) throw new AcervoError('Acervo acima do limite desta visualização. Solicite paginação ampliada.', 503)
    }
    const { data: runs, error } = await admin.from('acervo_importacoes').select('id,created_at,applied_at,applied_count').not('applied_at', 'is', null).order('applied_at', { ascending: false }).limit(10)
    if (error) throw error
    return Response.json({ items, runs, feedConfigured: feedConfigured() }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) { return acervoError(error) }
}
