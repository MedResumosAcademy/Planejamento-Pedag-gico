import { createClient } from '@supabase/supabase-js'

// Cliente com service role — usado APENAS em código de servidor (rotas de API,
// jobs agendados). Ignora RLS para ler todos os dados num disparo sem sessão de
// usuário. NUNCA importar isto em componentes de cliente.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY no ambiente.')
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
