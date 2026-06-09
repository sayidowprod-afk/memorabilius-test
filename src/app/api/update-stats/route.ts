import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, csvUrl } = await req.json()
    if (!userId || !csvUrl) return NextResponse.json({ error: 'Missing params' }, { status: 400 })

    // Fetcher le CSV
    const r = await fetch(csvUrl, { cache: 'no-store' })
    if (!r.ok) return NextResponse.json({ error: 'CSV fetch failed' }, { status: 500 })

    const text = await r.text()
    const lines = text.split(/\r?\n/).slice(1)
    const stats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }

    lines.forEach(line => {
      const c = line.split(',')
      if (!c[0] || c[0].length < 10) return
      stats.total++
      if (c[10]?.toLowerCase().includes('oui')) stats.rc++
      if (c[9]?.toLowerCase().includes('oui')) stats.auto++
      if (c[11]?.toLowerCase().includes('oui')) stats.patch++
      if (c[8]?.trim()) stats.num++
    })

    // Mettre à jour en base
    await supabase.from('profiles').update({
      stats_total: stats.total,
      stats_rc: stats.rc,
      stats_auto: stats.auto,
      stats_num: stats.num,
      stats_patch: stats.patch,
      stats_updated_at: new Date().toISOString(),
    }).eq('id', userId)

    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
