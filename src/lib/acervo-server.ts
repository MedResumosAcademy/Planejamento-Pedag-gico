import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { MAX_SNAPSHOT_BYTES, parseSnapshot } from '@/lib/acervo-contract'

export class AcervoError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export async function authorizeAcervo(request?: Request) {
  if (request && request.method !== 'GET') {
    const origin = request.headers.get('origin')
    // Browser mutations only; prevents cross-site form/fetch with ambient cookies.
    const target = new URL(request.url)
    // Next may normalize the internal URL to localhost; Host remains the browser's destination.
    let originUrl: URL | null = null
    try { originUrl = origin ? new URL(origin) : null } catch { /* fail closed */ }
    if (!originUrl || originUrl.origin !== origin || originUrl.host !== request.headers.get('host') || originUrl.protocol !== target.protocol) throw new AcervoError('Origem da solicitação inválida.', 403)
  }
  const client = await createClient()
  const { data: { user }, error } = await client.auth.getUser()
  if (error || !user) throw new AcervoError('Entre novamente para acessar o acervo.', 401)
  const admin = createAdminClient()
  // Dedicated, service-managed ACL. Do not trust writable legacy collaborator roles.
  const { data, error: aclError } = await admin.from('acervo_operadores').select('user_id').eq('user_id', user.id).maybeSingle()
  if (aclError) throw new AcervoError('Integração ainda não configurada no banco.', 503)
  if (!data) throw new AcervoError('Seu acesso ao acervo precisa ser habilitado por um administrador.', 403)
  return { admin, user }
}
export async function readLimitedJson(request: Request) {
  if (!request.headers.get('content-type')?.includes('application/json')) throw new AcervoError('Envie JSON.', 415)
  return readJsonBody(request)
}
async function readJsonBody(body: Request | Response) {
  const reader = body.body?.getReader()
  if (!reader) throw new AcervoError('Arquivo vazio.')
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    bytes += value.byteLength
    if (bytes > MAX_SNAPSHOT_BYTES) { await reader.cancel(); throw new AcervoError('Arquivo maior que 2 MB.', 413) }
    chunks.push(value)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown }
  catch { throw new AcervoError('JSON inválido.') }
}
export function feedConfigured() { return Boolean(process.env.MRA_METADATA_FEED_URL && process.env.MRA_METADATA_FEED_TOKEN) }
export async function fetchMetadataSnapshot() {
  if (!feedConfigured()) throw new AcervoError('Fonte direta ainda não conectada. Use um arquivo de metadados ou configure o feed de leitura.', 503)
  const url = new URL(process.env.MRA_METADATA_FEED_URL!)
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || url.port) throw new AcervoError('URL do feed inválida.', 503)
  // Server-owned exact host allowlist, no user-controlled endpoints or redirects.
  const allowed = (process.env.MRA_METADATA_ALLOWED_HOSTS || '').split(',').map(s => s.trim()).filter(Boolean)
  if (!allowed.includes(url.hostname) || !url.hostname.includes('.') || /^(localhost|127\.|0\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)) throw new AcervoError('Host do feed não autorizado.', 503)
  const response = await fetch(url, { headers: { Authorization: `Bearer ${process.env.MRA_METADATA_FEED_TOKEN}` }, redirect: 'error', cache: 'no-store', signal: AbortSignal.timeout(15_000) })
  if (!response.ok) throw new AcervoError('A origem não respondeu com metadados válidos. Nenhuma alteração aplicada.', 502)
  return parseSnapshot(await readJsonBody(response))
}
export function acervoError(error: unknown) {
  if (error instanceof AcervoError) return Response.json({ error: error.message }, { status: error.status })
  // Do not return SQL errors, infrastructure details or credentials.
  return Response.json({ error: 'Não foi possível concluir a operação. Nenhuma alteração manual foi solicitada.' }, { status: 500 })
}
