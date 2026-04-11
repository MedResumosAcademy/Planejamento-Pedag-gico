import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

export async function POST(req: Request) {
  const { nome, email, telefone, password, disciplinas, horarios } = await req.json()

  // Create auth user
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const userId = data.user.id

  // Insert into colaboradores
  const { error: dbError } = await supabaseAdmin
    .from('colaboradores')
    .insert({ id: userId, nome, email, telefone: telefone || null, nivel: 'professor' })
  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

  // Link disciplines
  if (disciplinas?.length > 0) {
    await supabaseAdmin.from('professor_disciplinas').insert(
      disciplinas.map((d: number) => ({ professor_id: userId, disciplina_id: d }))
    )
  }

  // Save availability
  if (horarios?.length > 0) {
    await supabaseAdmin.from('professor_horarios').insert(
      horarios.map((h: any) => ({ professor_id: userId, ...h }))
    )
  }

  return NextResponse.json({ id: userId })
}
