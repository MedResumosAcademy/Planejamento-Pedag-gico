import { authorizeAcervo, acervoError, AcervoError, readLimitedJson } from '@/lib/acervo-server'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { admin, user } = await authorizeAcervo(request)
    const body = await readLimitedJson(request) as { preview_id?: unknown; bindings?: unknown }
    if (typeof body?.preview_id !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.preview_id) || !Array.isArray(body.bindings) || body.bindings.length > 2000) throw new AcervoError('Confirmação inválida.')
    const bindings = body.bindings.map((value: { entity?: unknown; external_id?: unknown; tema_id?: unknown }) => {
      if (!value || typeof value.entity !== 'string' || typeof value.external_id !== 'string' || !(value.tema_id === null || (typeof value.tema_id === 'number' && Number.isSafeInteger(value.tema_id) && value.tema_id > 0))) throw new AcervoError('Associação inválida.')
      return { entity: value.entity, external_id: value.external_id, tema_id: value.tema_id }
    })
    const { data, error } = await admin.rpc('aplicar_acervo_previa', { p_preview: body.preview_id, p_actor: user.id, p_bindings: bindings })
    if (error) throw new AcervoError('Prévia expirada, alterada ou associação incompatível. Refaça a prévia; o lote não foi aplicado.', 409)
    return Response.json(data)
  } catch (error) { return acervoError(error) }
}
