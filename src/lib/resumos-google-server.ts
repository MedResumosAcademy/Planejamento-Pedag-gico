import { createHash, sign } from 'node:crypto'
import {
  parseResumosGoogleValues,
  RESUMOS_SHEET_ID,
  RESUMOS_SHEET_TABS,
  type ResumoInventory,
  type SheetValues,
} from './resumos-google-parser'

const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SHEETS_URL = `https://sheets.googleapis.com/v4/spreadsheets/${RESUMOS_SHEET_ID}`
let tokenCache: { value: string; expiresAt: number } | null = null

interface SheetMetadata {
  spreadsheetId?: string
  sheets?: Array<{ properties?: { title?: string; gridProperties?: { rowCount?: number } } }>
}

interface ValueRanges {
  valueRanges?: Array<{ values?: SheetValues }>
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url')
}

export function resumosGoogleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SHEETS_CLIENT_EMAIL && process.env.GOOGLE_SHEETS_PRIVATE_KEY)
}

async function accessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) return tokenCache.value
  const email = process.env.GOOGLE_SHEETS_CLIENT_EMAIL
  const rawKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY
  if (!email || !rawKey) throw new Error('google_not_configured')
  if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+\.iam\.gserviceaccount\.com$/.test(email)) {
    throw new Error('google_invalid_service_account')
  }
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claim = base64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: now, exp: now + 3600 }))
  const unsigned = `${header}.${claim}`
  let signature: Buffer
  try {
    signature = sign('RSA-SHA256', Buffer.from(unsigned), rawKey.replace(/\\n/g, '\n'))
  } catch {
    throw new Error('google_invalid_service_account_key')
  }
  const assertion = `${unsigned}.${base64url(signature)}`
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(10_000),
  })
  if (!response.ok) throw new Error('google_auth_failed')
  const payload = await response.json() as { access_token?: unknown; expires_in?: unknown }
  if (typeof payload.access_token !== 'string' || !payload.access_token) throw new Error('google_auth_failed')
  const ttl = typeof payload.expires_in === 'number' && payload.expires_in > 0 ? payload.expires_in : 3600
  tokenCache = { value: payload.access_token, expiresAt: Date.now() + Math.min(ttl, 3600) * 1000 }
  return payload.access_token
}

async function sheetsJson<T>(url: string, token: string): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
  })
  if (response.status === 401) { tokenCache = null; throw new Error('google_auth_failed') }
  if (response.status === 403) throw new Error('google_permission_denied')
  if (response.status === 429) throw new Error('google_quota_exceeded')
  if (!response.ok) throw new Error('google_read_failed')
  const size = Number(response.headers.get('content-length'))
  if (Number.isFinite(size) && size > 3_000_000) throw new Error('google_response_too_large')
  const body = await response.text()
  if (Buffer.byteLength(body, 'utf8') > 3_000_000) throw new Error('google_response_too_large')
  return JSON.parse(body) as T
}

export async function readResumosGoogle(): Promise<{
  inventory: ResumoInventory
  source_fingerprint: string
  fetched_at: string
}> {
  const token = await accessToken()
  const metadataQuery = new URLSearchParams({ fields: 'spreadsheetId,sheets(properties(title,gridProperties(rowCount)))' })
  const metadata = await sheetsJson<SheetMetadata>(`${SHEETS_URL}?${metadataQuery}`, token)
  if (metadata.spreadsheetId !== RESUMOS_SHEET_ID || !Array.isArray(metadata.sheets)) {
    throw new Error('google_wrong_spreadsheet')
  }
  const bounds = new Map(metadata.sheets.map(sheet => [sheet.properties?.title, sheet.properties?.gridProperties?.rowCount]))
  const limits: Record<(typeof RESUMOS_SHEET_TABS)[number], number> = {
    // gridProperties counts blank allocated rows too, not only populated rows.
    Resumo: 50_000, Temas: 50_000, 'Por disciplina': 50_000, 'Para o time atualizar': 50_000,
  }
  for (const name of RESUMOS_SHEET_TABS) {
    const rows = bounds.get(name)
    if (!Number.isSafeInteger(rows) || !rows || rows < 1 || rows > limits[name]) {
      throw new Error('google_sheet_bounds_invalid')
    }
  }
  const query = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE' })
  query.append('ranges', "'Resumo'!A1:D16")
  query.append('ranges', `'Temas'!A1:L${bounds.get('Temas')}`)
  query.append('ranges', `'Por disciplina'!A1:E${bounds.get('Por disciplina')}`)
  query.append('ranges', `'Para o time atualizar'!A1:E${bounds.get('Para o time atualizar')}`)
  const values = await sheetsJson<ValueRanges>(`${SHEETS_URL}/values:batchGet?${query}`, token)
  if (!Array.isArray(values.valueRanges) || values.valueRanges.length !== RESUMOS_SHEET_TABS.length) {
    throw new Error('google_missing_ranges')
  }
  const [resumo, temas, porDisciplina, paraAtualizar] = values.valueRanges.map(item => item.values ?? [])
  const inventory = parseResumosGoogleValues({ resumo, temas, porDisciplina, paraAtualizar })
  const source_fingerprint = createHash('sha256').update(JSON.stringify([resumo, temas, porDisciplina, paraAtualizar])).digest('hex')
  return { inventory, source_fingerprint, fetched_at: new Date().toISOString() }
}
