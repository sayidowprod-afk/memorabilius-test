import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Cache mémoire des cartes CSV parsées, par profileId — survit entre les requêtes dans le même process Node.js
const CSV_TTL = 60 * 60 * 1000 // 1h
interface CsvEntry { cards: any[]; expiry: number; url: string }
const csvCache = new Map<string, CsvEntry>()

async function getProfileCsvCards(profileId: string, csvUrl: string): Promise<any[]> {
  const cached = csvCache.get(profileId)
  // Retourne le cache si valide ET si l'URL n'a pas changé
  if (cached && cached.expiry > Date.now() && cached.url === csvUrl) return cached.cards

  try {
    const r = await fetch(csvUrl, { signal: AbortSignal.timeout(3000) })
    if (!r.ok) return []
    const text = await r.text()
    const rows = text.split(/\r?\n/).slice(4)

    const cards: any[] = []
    rows.forEach(row => {
      const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
      if (!c[0]?.includes('http')) return
      cards.push({
        img:    c[0]?.trim(),
        name:   (c[2] || '').replace(/^"|"$/g, ''),
        team:   (c[3] || '').replace(/^"|"$/g, ''),
        year:   (c[4] || '').replace(/^"|"$/g, ''),
        brand:  (c[5] || '').replace(/^"|"$/g, ''),
        serie:  (c[6] || '').replace(/^"|"$/g, ''),
        variant:(c[7] || '').replace(/^"|"$/g, ''),
        num:    (c[8] || '').replace(/^"|"$/g, ''),
        auto:   (c[9] || '').toLowerCase().includes('oui'),
        rc:     (c[10] || '').toLowerCase().includes('oui'),
        patch:  (c[11] || '').toLowerCase().includes('oui'),
      })
    })

    csvCache.set(profileId, { cards, expiry: Date.now() + CSV_TTL, url: csvUrl })
    return cards
  } catch {
    return []
  }
}

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.toLowerCase().trim()
  if (!query || query.length < 2) return NextResponse.json([])

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, lien_csv, couleur_bordure')
  if (!profiles) return NextResponse.json([])

  const results: any[] = []

  const { data: privees } = await supabase
    .from('cartes_privees')
    .select('user_id, card_key')
    .limit(50000)
  const privateSet = new Set((privees || []).map(p => `${p.user_id}::${p.card_key}`))
  const isPrivate = (userId: string, cardKey: string) => privateSet.has(`${userId}::${cardKey}`)

  // Cartes manuelles — filtre SQL
  const { data: manuelles } = await supabase
    .from('cartes_manuelles')
    .select('*')
    .or(`nom.ilike.%${query}%,equipe.ilike.%${query}%,variation.ilike.%${query}%,marque.ilike.%${query}%`)
    .limit(500)

  const profileMap = new Map(profiles.map(p => [p.id, p]))

  ;(manuelles || []).forEach(m => {
    const p = profileMap.get(m.user_id)
    if (!p || isPrivate(m.user_id, m.image_recto)) return
    results.push({
      img: m.image_recto || 'https://placehold.co/300x420?text=No+Image',
      name: m.nom || '', team: m.equipe || '', year: m.annee || '',
      brand: m.marque || '', serie: m.collection || '', variant: m.variation || '',
      num: m.num || '', auto: m.auto || false, rc: m.rc || false, patch: m.patch || false,
      collector: p.display_name, collectorId: p.id,
      collectorAvatar: p.avatar_url, accent: p.couleur_bordure || '#003DA6',
    })
  })

  // Cartes CSV — utilise le cache mémoire, parallèle
  await Promise.all(profiles.filter(p => p.lien_csv).map(async (p) => {
    const cards = await getProfileCsvCards(p.id, p.lien_csv)
    cards.forEach(c => {
      const name = c.name.toLowerCase()
      const team = c.team.toLowerCase()
      const variant = c.variant.toLowerCase()
      const brand = c.brand.toLowerCase()
      if (!(name.includes(query) || team.includes(query) || variant.includes(query) || brand.includes(query))) return
      if (isPrivate(p.id, c.img)) return
      results.push({ ...c, collector: p.display_name, collectorId: p.id, collectorAvatar: p.avatar_url, accent: p.couleur_bordure || '#003DA6' })
    })
  }))

  // Collectionneurs
  const users = profiles
    .filter(p => p.display_name?.toLowerCase().includes(query))
    .map(p => ({ id: p.id, display_name: p.display_name, avatar_url: p.avatar_url, accent: p.couleur_bordure || '#003DA6' }))

  // Joueurs (card_set_entries — dédupliqués par nom)
  const { data: playerEntries } = await supabase
    .from('card_set_entries')
    .select('player_name, is_rc, card_sets(sport)')
    .ilike('player_name', `%${query}%`)
    .limit(200)

  const playersMap = new Map<string, { name: string; isRc: boolean; sports: Set<string> }>()
  for (const e of playerEntries || []) {
    const name = e.player_name
    if (!name) continue
    const sport = (e as any).card_sets?.sport || 'nba'
    if (!playersMap.has(name)) playersMap.set(name, { name, isRc: false, sports: new Set() })
    const p = playersMap.get(name)!
    if (e.is_rc) p.isRc = true
    p.sports.add(sport)
  }
  const players = [...playersMap.values()]
    .sort((a, b) => a.name.toLowerCase().startsWith(query) ? -1 : b.name.toLowerCase().startsWith(query) ? 1 : 0)
    .slice(0, 10)
    .map(p => ({ name: p.name, isRc: p.isRc, sports: [...p.sports] }))

  results.sort((a, b) => {
    const aExact = a.name.toLowerCase().startsWith(query) ? 0 : 1
    const bExact = b.name.toLowerCase().startsWith(query) ? 0 : 1
    return aExact - bExact
  })

  return NextResponse.json({ cards: results, users, players })
}
