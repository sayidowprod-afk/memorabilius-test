import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET(req: NextRequest) {
  // Vercel cron security: only allow internal calls
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Find the month that just ended
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() // 0-indexed: current month = last month we're computing for
  const monthStart = new Date(year, month - 1, 1).toISOString()
  const monthEnd = new Date(year, month, 1).toISOString()
  const monthLabel = `${year}-${String(month).padStart(2, '0')}` // e.g. "2026-05"

  // Check if badge already awarded this month
  const { data: existing } = await supabase
    .from('badges')
    .select('id')
    .eq('type', 'collectionneur_du_mois')
    .eq('mois', monthLabel)
    .single()

  if (existing) {
    return NextResponse.json({ message: 'Badge already awarded for this month' })
  }

  // Count cards added per user during the month
  const { data: counts } = await supabase
    .from('cartes_manuelles')
    .select('user_id')
    .gte('created_at', monthStart)
    .lt('created_at', monthEnd)

  if (!counts || counts.length === 0) {
    return NextResponse.json({ message: 'No cards added this month' })
  }

  const tally: Record<string, number> = {}
  for (const row of counts) {
    tally[row.user_id] = (tally[row.user_id] || 0) + 1
  }

  const winner = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]
  if (!winner) return NextResponse.json({ message: 'No winner' })

  const [winnerId, cardCount] = winner

  // Award the badge
  await supabase.from('badges').insert({
    user_id: winnerId,
    type: 'collectionneur_du_mois',
    mois: monthLabel,
    description: `${cardCount} cartes ajoutées en ${monthLabel}`,
  })

  // Notify the winner
  await supabase.from('notifications').insert({
    user_id: winnerId,
    type: 'badge',
    contenu: `🏆 Tu es le Collectionneur du mois de ${monthLabel} ! Tu as ajouté ${cardCount} cartes.`,
    lu: false,
  })

  return NextResponse.json({ winner: winnerId, cards: cardCount, month: monthLabel })
}
