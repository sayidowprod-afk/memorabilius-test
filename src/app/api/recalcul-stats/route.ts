import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export const maxDuration = 60

export async function GET() {
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, lien_csv')
    .not('lien_csv', 'is', null)
    .neq('lien_csv', '')

  if (!profiles) return NextResponse.json({ error: 'No profiles' })

  const results = []

  for (const p of profiles) {
    try {
      const r = await fetch(p.lien_csv, { cache: 'no-store' })
      if (!r.ok) { results.push({ id: p.id, error: 'fetch failed' }); continue }

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

      await supabase.from('profiles').update({
        stats_total: stats.total,
        stats_rc: stats.rc,
        stats_auto: stats.auto,
        stats_num: stats.num,
        stats_patch: stats.patch,
        stats_updated_at: new Date().toISOString(),
      }).eq('id', p.id)

      results.push({ id: p.id, stats })
    } catch (e) {
      results.push({ id: p.id, error: String(e) })
    }
  }

  return NextResponse.json({ ok: true, count: results.length, results })
}
