import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { userId, csvUrl } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing params' }, { status: 400 })
    if (csvUrl && !csvUrl.startsWith('https://docs.google.com/spreadsheets/')) {
      return NextResponse.json({ error: 'Invalid CSV URL' }, { status: 400 })
    }

    const stats = { total: 0, rc: 0, auto: 0, num: 0, patch: 0 }

    // CSV, cartes manuelles et ancien total sont indépendants → en parallèle
    const [csvText, manuellesRes, prevRes] = await Promise.all([
      csvUrl
        ? fetch(csvUrl, { cache: 'no-store' }).then(r => r.ok ? r.text() : null).catch(() => null)
        : Promise.resolve(null),
      supabase.from('cartes_manuelles').select('rc, auto, patch, num').eq('user_id', userId),
      supabase.from('profiles').select('stats_total').eq('id', userId).single(),
    ])

    if (csvText) {
      const lines = csvText.split(/\r?\n/).slice(4)
      lines.forEach(line => {
        const c = line.split(',')
        if (!c[0] || !c[0].includes('http')) return
        stats.total++
        if (c[10]?.toLowerCase().includes('oui')) stats.rc++
        if (c[9]?.toLowerCase().includes('oui')) stats.auto++
        if (c[11]?.toLowerCase().includes('oui')) stats.patch++
        if (c[8]?.trim()) stats.num++
      })
    }

    if (manuellesRes.data) {
      manuellesRes.data.forEach((m: any) => {
        stats.total++
        if (m.rc) stats.rc++
        if (m.auto) stats.auto++
        if (m.patch) stats.patch++
        if (m.num) stats.num++
      })
    }

    const prevTotal = prevRes.data?.stats_total || 0
    const delta = Math.max(0, stats.total - prevTotal)

    await supabase.from('profiles').update({
      stats_total: stats.total,
      stats_rc: stats.rc,
      stats_auto: stats.auto,
      stats_num: stats.num,
      stats_patch: stats.patch,
      stats_updated_at: new Date().toISOString(),
    }).eq('id', userId)

    // Incrémenter le compteur mensuel si des cartes ont été ajoutées
    if (delta > 0) {
      const month = new Date().toISOString().slice(0, 7)
      const { data: existing } = await supabase.from('monthly_additions').select('count').eq('user_id', userId).eq('month', month).single()
      await supabase.from('monthly_additions').upsert(
        { user_id: userId, month, count: (existing?.count || 0) + delta },
        { onConflict: 'user_id,month' }
      )
    }

    return NextResponse.json({ ok: true, stats })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
