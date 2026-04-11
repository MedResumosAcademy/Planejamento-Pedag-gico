import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  try {
    const { email, nome } = await req.json()
    if (!email || !nome) return NextResponse.json({ error: 'Email and name are required' }, { status: 400 })
    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    const { error: dbError } = await supabaseAdmin.from('colaboradores').insert({ id: data.user.id, nome, email, nivel: 'coordenador' })
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })
    return NextResponse.json({ id: data.user.id, message: 'Invite sent successfully' })
  } catch (e: any) {
    return NextResponse.json({ error: e.message || 'Internal server error' }, { status: 500 })
  }
}
