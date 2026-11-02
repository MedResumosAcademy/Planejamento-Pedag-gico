import { NextResponse, type NextRequest } from 'next/server'
import type { EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const allowedTypes = new Set<EmailOtpType>(['invite', 'recovery'])

export async function GET(request: NextRequest) {
  const tokenHash = request.nextUrl.searchParams.get('token_hash')
  const type = request.nextUrl.searchParams.get('type') as EmailOtpType | null

  if (tokenHash && type && allowedTypes.has(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type })

    if (!error) {
      return NextResponse.redirect(new URL('/redefinir-senha', request.url))
    }
  }

  return NextResponse.redirect(new URL('/recuperar-senha?erro=link-invalido', request.url))
}
