import { NextResponse } from 'next/server'
import { buildReport, sendReport, type Period } from '@/lib/reports'
import { parseCiclo } from '@/lib/cycles'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Autoriza via Bearer CRON_SECRET (Vercel Cron injeta automaticamente) ou ?token=REPORT_SECRET
function authorized(req: Request): boolean {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')
  const auth = req.headers.get('authorization') || ''
  const cronSecret = process.env.CRON_SECRET
  const reportSecret = process.env.REPORT_SECRET
  if (cronSecret && auth === `Bearer ${cronSecret}`) return true
  if (reportSecret && token && token === reportSecret) return true
  return false
}

export async function GET(req: Request, ctx: { params: Promise<{ period: string }> }) {
  const { period } = await ctx.params
  if (period !== 'weekly' && period !== 'monthly') {
    return NextResponse.json({ error: 'period deve ser "weekly" ou "monthly"' }, { status: 400 })
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = new URL(req.url)
  const rawCiclo = url.searchParams.get('ciclo')
  const ciclo = parseCiclo(rawCiclo) ?? 'basico'
  if (rawCiclo && !parseCiclo(rawCiclo)) {
    return NextResponse.json({ error: 'ciclo deve ser "basico" ou "clinico"' }, { status: 400 })
  }
  // Pré-visualização: retorna o HTML do relatório sem enviar (?preview=1)
  if (url.searchParams.get('preview') === '1') {
    try {
      const { html } = await buildReport(period as Period, ciclo)
      return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
    }
  }
  try {
    const result = await sendReport(period as Period, ciclo)
    return NextResponse.json(result, { status: result.ok ? 200 : 500 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 })
  }
}
