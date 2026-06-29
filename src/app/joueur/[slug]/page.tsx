import { createClient } from '@supabase/supabase-js'
import type { Metadata } from 'next'
import Link from 'next/link'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'
import { fetchEspnHeadshot } from '@/lib/espnHeadshot'

export const revalidate = 3600

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)


function slugToName(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function seasonLabel(year: number, sport = 'nba') {
  return ['nfl', 'baseball', 'pokemon', 'mtg'].includes(sport)
    ? String(year)
    : `${year}-${String(year + 1).slice(2)}`
}

async function fetchPlayer(slug: string) {
  const playerName = slugToName(slug)
  const lowerFull = playerName.toLowerCase()

  // 1re vague : données structurées + profils CSV en parallèle
  const [entriesRes, manuRes, profilesRes] = await Promise.all([
    supabase
      .from('card_set_entries')
      .select('set_id, variation, is_rc, card_sets(id, name, year, brand, sport)')
      .ilike('player_name', playerName),
    supabase
      .from('cartes_manuelles')
      .select('id, nom, annee, rc, marque, collection, variation, image_recto, is_horizontal, user_id, profiles(display_name, avatar_url, couleur_bordure)')
      .ilike('nom', `%${playerName}%`)
      .not('image_recto', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5000),
    supabase
      .from('profiles')
      .select('id, display_name, avatar_url, lien_csv, couleur_bordure')
      .not('lien_csv', 'is', null),
  ])

  // Sets
  const setsMap = new Map<number, any>()
  for (const e of entriesRes.data || []) {
    const cs = (e as any).card_sets
    if (!cs) continue
    if (!setsMap.has(cs.id)) setsMap.set(cs.id, { ...cs, isRc: false, variations: [] })
    const s = setsMap.get(cs.id)!
    if (e.is_rc) s.isRc = true
    if (e.variation && !s.variations.includes(e.variation)) s.variations.push(e.variation)
  }
  const sets = [...setsMap.values()].sort((a, b) => (b.year || 0) - (a.year || 0))
  const primarySport = sets[0]?.sport || 'nba'

  // RC year : depuis sets d'abord, sinon depuis cartes_manuelles
  const rcFromSets = sets.find((s: any) => s.isRc)?.year as number | undefined
  const rcFromManuelles = (manuRes.data || []).find((m: any) => m.rc)?.annee as number | undefined
  const rcYear = rcFromSets || rcFromManuelles

  // 2e vague : CSV + headshot en parallèle (indépendants l'un de l'autre)
  const [csvAll, headshot] = await Promise.all([
    fetchCsvCardsForProfiles(profilesRes.data || []),
    fetchEspnHeadshot(playerName, primarySport),
  ])

  // Cartes manuelles
  const manuellesCards = (manuRes.data || []).map((m: any) => ({
    id: m.id,
    img: m.image_recto,
    nom: m.nom,
    annee: m.annee,
    marque: m.marque,
    is_horizontal: m.is_horizontal,
    user_id: m.user_id,
    display_name: m.profiles?.display_name,
    avatar_url: m.profiles?.avatar_url,
    accent: m.profiles?.couleur_bordure || '#003DA6',
    source: 'manuel' as const,
  }))

  // Cartes CSV — filtre par nom complet
  const csvCards = csvAll
    .filter(c => c.name.toLowerCase().includes(lowerFull))
    .map(c => ({
      id: `csv-${c.user_id}-${c.img}`,
      img: c.img,
      nom: c.name,
      annee: c.year,
      marque: c.brand,
      is_horizontal: false,
      user_id: c.user_id,
      display_name: c.display_name,
      avatar_url: c.avatar_url,
      accent: c.accent,
      source: 'csv' as const,
    }))

  // Fusionner + dédupliquer par img URL
  const seen = new Set<string>()
  const communityCards = [...manuellesCards, ...csvCards].filter(c => {
    if (seen.has(c.img)) return false
    seen.add(c.img)
    return true
  })

  return { playerName, sets, communityCards, rcYear, headshot }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const { playerName, sets, communityCards } = await fetchPlayer(slug)

  const title = `${playerName} — Cartes de collection | Memorabilius`
  const desc = `Retrouvez toutes les cartes ${playerName} sur Memorabilius : ${sets.length} sets, ${communityCards.length} cartes en communauté. Prizm, Hoops, Select et bien plus.`

  return {
    title,
    description: desc,
    openGraph: { title, description: desc },
    twitter: { card: 'summary', title, description: desc },
  }
}

const ACCENT = '#003DA6'

export default async function JoueurPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const { playerName, sets, communityCards, rcYear, headshot } = await fetchPlayer(slug)

  const sports = [...new Set(sets.map((s: any) => s.sport as string))]

  if (sets.length === 0 && communityCards.length === 0) {
    return (
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '80px 16px', textAlign: 'center', fontFamily: 'Inter, sans-serif' }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, color: '#111', marginBottom: 12 }}>{playerName}</h1>
        <p style={{ color: '#999', fontSize: 15, marginBottom: 24 }}>Aucune carte trouvée pour ce joueur dans notre base.</p>
        <Link href="/setlist" style={{ color: ACCENT, fontWeight: 700, textDecoration: 'none' }}>← Voir le Setlist</Link>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '32px 16px', fontFamily: 'Inter, sans-serif' }}>
      {/* Header */}
      <div style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        {headshot && (
          <img
            src={headshot}
            alt={playerName}
            style={{ width: 110, height: 110, borderRadius: '50%', objectFit: 'cover', objectPosition: 'top', border: '3px solid #f0f0f0', flexShrink: 0 }}
          />
        )}
        <div>
          <div style={{ fontSize: 11, color: ACCENT, fontWeight: 700, textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.08em' }}>
            {sports.map(s => s.toUpperCase()).join(' · ')}
          </div>
          <h1 style={{ fontSize: 36, fontWeight: 900, margin: '0 0 12px', color: '#111' }}>{playerName}</h1>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {rcYear && (
              <span style={{ fontSize: 12, background: '#e67e22', color: 'white', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
                RC {rcYear}
              </span>
            )}
            <span style={{ fontSize: 12, background: '#f0f4ff', color: ACCENT, padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
              {sets.length} set{sets.length > 1 ? 's' : ''}
            </span>
            {communityCards.length > 0 && (
              <span style={{ fontSize: 12, background: '#f0f0f0', color: '#555', padding: '3px 10px', borderRadius: 4, fontWeight: 700 }}>
                {communityCards.length} carte{communityCards.length > 1 ? 's' : ''} en communauté
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Cartes de la communauté */}
      {communityCards.length > 0 && (
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: '#111' }}>
            Dans les collections ({communityCards.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
            {communityCards.map((card: any) => (
              <Link key={card.id} href={`/galerie/${card.user_id}`} style={{ textDecoration: 'none' }}>
                <div style={{ borderRadius: 10, overflow: 'hidden', background: 'white', border: '1px solid #eee', transition: '0.15s' }}>
                  <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', position: 'relative' }}>
                    <img
                      src={card.img}
                      alt={card.nom}
                      style={card.is_horizontal ? {
                        position: 'absolute', width: '140%', height: '71.43%',
                        left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover',
                      } : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                    />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.nom}</div>
                    <div style={{ fontSize: 10, color: '#999', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {card.annee} {card.marque}
                    </div>
                    <div style={{ fontSize: 10, color: '#bbb', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                      <img
                        src={card.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.display_name || 'U')}&background=003DA6&color=fff&size=20`}
                        style={{ width: 12, height: 12, borderRadius: '50%' }} alt="" />
                      {card.display_name}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sets */}
      {sets.length > 0 && (
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 800, marginBottom: 16, color: '#111' }}>
            Sets ({sets.length})
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 8 }}>
            {sets.map((set: any) => (
              <Link key={set.id} href={`/setlist/${set.id}`} style={{ textDecoration: 'none' }}>
                <div style={{ background: 'white', borderRadius: 10, padding: '12px 16px', border: '1px solid #eee', transition: '0.15s' }}>
                  <div style={{ fontWeight: 800, fontSize: 13, color: '#111', marginBottom: 3 }}>{set.name}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>
                    {set.year ? seasonLabel(set.year, set.sport) : ''}{set.brand ? ` · ${set.brand}` : ''} · {(set.sport || '').toUpperCase()}
                  </div>
                  <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                    {set.isRc && <span style={{ fontSize: 9, background: '#e67e22', color: 'white', padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>RC</span>}
                    {set.variations.filter((v: string) => v !== 'Base').slice(0, 3).map((v: string) => (
                      <span key={v} style={{ fontSize: 9, background: '#f0f4ff', color: ACCENT, padding: '2px 6px', borderRadius: 3, fontWeight: 700 }}>{v}</span>
                    ))}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
