import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get('q')?.toLowerCase().trim()
  if (!query || query.length < 2) return NextResponse.json([])

  // Récupérer tous les profils
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, lien_csv, couleur_bordure')

  if (!profiles) return NextResponse.json([])

  const results: any[] = []

  // Clés des cartes privées (card_key = image URL)
  const { data: privees } = await supabase.from('cartes_privees').select('user_id, card_key')
  const privateSet = new Set((privees || []).map(p => `${p.user_id}::${p.card_key}`))
  const isPrivate = (userId: string, cardKey: string) => privateSet.has(`${userId}::${cardKey}`)

  // Cartes manuelles (toutes les cartes publiques)
  const { data: manuelles } = await supabase
    .from('cartes_manuelles')
    .select('*')

  const profileMap = new Map(profiles.map(p => [p.id, p]))

  ;(manuelles || []).forEach(m => {
    const name = (m.nom || '').toLowerCase()
    const team = (m.equipe || '').toLowerCase()
    const variant = (m.variation || '').toLowerCase()
    const brand = (m.marque || '').toLowerCase()
    if (!query || !(name.includes(query) || team.includes(query) || variant.includes(query) || brand.includes(query))) return
    const p = profileMap.get(m.user_id)
    if (!p) return
    if (isPrivate(m.user_id, m.image_recto)) return
    results.push({
      img: m.image_recto || 'https://placehold.co/300x420?text=No+Image',
      name: m.nom || '',
      team: m.equipe || '',
      year: m.annee || '',
      brand: m.marque || '',
      serie: m.collection || '',
      variant: m.variation || '',
      num: m.num || '',
      auto: m.auto || false,
      rc: m.rc || false,
      patch: m.patch || false,
      collector: p.display_name,
      collectorId: p.id,
      collectorAvatar: p.avatar_url,
      accent: p.couleur_bordure || '#003DA6',
    })
  })

  // Cartes CSV
  await Promise.all(profiles.filter(p => p.lien_csv).map(async (p) => {
    try {
      const r = await fetch(p.lien_csv, { next: { revalidate: 3600 } })
      if (!r.ok) return
      const text = await r.text()
      const rows = text.split(/\r?\n/).slice(4)

      rows.forEach(row => {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        if (!c[0]?.includes('http')) return
        const name = (c[2] || '').toLowerCase()
        const team = (c[3] || '').toLowerCase()
        const variant = (c[7] || '').toLowerCase()
        const brand = (c[5] || '').toLowerCase()

        if (name.includes(query) || team.includes(query) || variant.includes(query) || brand.includes(query)) {
          if (isPrivate(p.id, c[0]?.trim())) return
          results.push({
            img: c[0]?.trim(),
            name: c[2] || '',
            team: c[3] || '',
            year: c[4] || '',
            brand: c[5] || '',
            serie: c[6] || '',
            variant: c[7] || '',
            num: c[8] || '',
            auto: c[9]?.toLowerCase().includes('oui') || false,
            rc: c[10]?.toLowerCase().includes('oui') || false,
            patch: c[11]?.toLowerCase().includes('oui') || false,
            collector: p.display_name,
            collectorId: p.id,
            collectorAvatar: p.avatar_url,
            accent: p.couleur_bordure || '#003DA6',
          })
        }
      })
    } catch { }
  }))

  // Collectionneurs dont le nom correspond
  const users = profiles
    .filter(p => p.display_name && p.display_name.toLowerCase().includes(query))
    .map(p => ({
      id: p.id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      accent: p.couleur_bordure || '#003DA6',
    }))

  // Trier cartes par pertinence (nom exact en premier)
  results.sort((a, b) => {
    const aExact = a.name.toLowerCase().startsWith(query) ? 0 : 1
    const bExact = b.name.toLowerCase().startsWith(query) ? 0 : 1
    return aExact - bExact
  })

  return NextResponse.json({ cards: results.slice(0, 60), users })
}
