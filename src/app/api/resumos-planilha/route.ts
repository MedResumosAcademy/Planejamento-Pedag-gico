import snapshot from '@/data/resumos-planilha.snapshot.json'
import { parseCiclo } from '@/lib/cycles'
import { RESUMOS_SHEET_URL, type ResumoInventory } from '@/lib/resumos-google-parser'
import { readResumosGoogle, resumosGoogleConfigured } from '@/lib/resumos-google-server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' }

function snapshotResponse(ciclo: 'basico' | 'clinico', warning: string) {
  const inventory = snapshot as ResumoInventory
  return Response.json({
    version: 1,
    ciclo,
    data: inventory.cycles[ciclo],
    source_state: 'snapshot',
    source_url: RESUMOS_SHEET_URL,
    source_read_at: inventory.source_read_at[ciclo],
    source_fingerprint: `xlsx-sha256:${snapshot.source_file_sha256}`,
    warning,
  }, { headers })
}

export async function GET(request: Request) {
  const ciclo = parseCiclo(new URL(request.url).searchParams.get('ciclo'))
  if (!ciclo) return Response.json({ error: 'Ciclo inválido' }, { status: 400, headers })

  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'Não autenticado' }, { status: 401, headers })
  const { data: collaborator, error: roleError } = await supabase.from('colaboradores')
    .select('nivel').eq('id', user.id).single()
  if (roleError || collaborator?.nivel !== 'coordenador') {
    return Response.json({ error: 'Acesso não autorizado' }, { status: 403, headers })
  }

  if (!resumosGoogleConfigured()) return snapshotResponse(ciclo, 'Integração online ainda não configurada. Exibindo retrato datado da planilha.')
  // The legacy coordinator role is not a trusted ACL while colaboradores has no RLS.
  // Only explicitly provisioned acervo operators may see fresh online totals.
  try {
    const { data, error } = await createAdminClient().from('acervo_operadores')
      .select('user_id').eq('user_id', user.id).maybeSingle()
    if (error || !data) {
      return snapshotResponse(ciclo, 'Leitura online ainda não habilitada para este acesso. Exibindo retrato datado da planilha.')
    }
  } catch {
    console.error('Falha na autorização de leitura online de resumos: acervo_acl_unavailable')
    return snapshotResponse(ciclo, 'Leitura online ainda não habilitada. Exibindo retrato datado da planilha.')
  }
  try {
    const { inventory, source_fingerprint, fetched_at } = await readResumosGoogle()
    return Response.json({
      version: 1,
      ciclo,
      data: inventory.cycles[ciclo],
      source_state: 'online',
      source_url: RESUMOS_SHEET_URL,
      source_read_at: inventory.source_read_at[ciclo],
      source_fingerprint: `values-sha256:${source_fingerprint}`,
      fetched_at,
    }, { headers })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    const safeReason = code.startsWith('google_') || /^(Resumo|Temas|Por disciplina|Para o time atualizar)(!|:)/.test(code)
      ? code : 'validation_or_network_failed'
    console.error('Falha na leitura de resumos do Google Sheets:', safeReason)
    const warning = code === 'google_permission_denied'
      ? 'Conta de serviço sem permissão de leitura. Exibindo retrato datado da planilha.'
      : code === 'google_quota_exceeded'
        ? 'Limite temporário de consultas à planilha. Exibindo retrato datado.'
      : code === 'google_auth_failed' || code.startsWith('google_invalid_')
        ? 'Credencial da conta de serviço inválida. Exibindo retrato datado da planilha.'
        : 'Leitura online indisponível ou não reconciliada. Exibindo retrato datado da planilha.'
    return snapshotResponse(ciclo, warning)
  }
}
