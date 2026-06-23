import { supabase } from '@/lib/supabase'
import PepitesSection from '@/components/PepitesSection'
import HomeHero from '@/components/HomeHero'
import PodiumSection from '@/components/PodiumSection'
import PWAInstall from '@/components/PWAInstall'

export const dynamic = 'force-dynamic'

interface Card {
  img: string; name: string; variant: string; year: string
  brand: string; rc: boolean; auto: boolean; patch: boolean
  num: string; collector: string; userId: string
}

async function fetchPepites(profiles: { id: string; display_name: string; lien_csv: string | null }[]): Promise<Card[]> {
  const profileMap = new Map(profiles.map(p => [p.id, p.display_name]))
  const all: Card[] = []

  // Cartes manuelles récentes (toutes les collections)
  const { data: manuelles } = await supabase
    .from('cartes_manuelles')
    .select('image_recto, nom, variation, annee, marque, rc, auto, patch, num, user_id, created_at')
    .not('image_recto', 'is', null)
    .order('created_at', { ascending: false })
    .limit(20)

  ;(manuelles || []).forEach(m => {
    const collector = profileMap.get(m.user_id)
    if (!collector) return
    all.push({
      img: m.image_recto,
      name: m.nom || '',
      variant: m.variation || '',
      year: m.annee || '',
      brand: m.marque || '',
      rc: m.rc || false,
      auto: m.auto || false,
      patch: m.patch || false,
      num: m.num || '',
      collector,
      userId: m.user_id,
    })
  })

  // Cartes CSV récentes
  await Promise.all(profiles.filter(p => p.lien_csv).map(async p => {
    try {
      const r = await fetch(p.lien_csv!, { signal: AbortSignal.timeout(5000) })
      if (!r.ok) return
      const text = await r.text()
      const rows = text.split(/\r?\n/).filter(row => row.includes('http'))
      rows.slice(-4).forEach(row => {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        if (!c[0]?.includes('http')) return
        all.push({
          img: c[0]?.trim(),
          name: c[2] || '',
          variant: c[7] || '',
          year: c[4] || '',
          brand: c[5] || '',
          rc: c[10]?.toLowerCase().includes('oui') || false,
          auto: c[9]?.toLowerCase().includes('oui') || false,
          patch: c[11]?.toLowerCase().includes('oui') || false,
          num: c[8] || '',
          collector: p.display_name,
          userId: p.id,
        })
      })
    } catch { }
  }))

  // Déduplique par image, garde les plus récentes en premier, max 2 par personne, 6 au total
  const seen = new Set<string>()
  const perUser = new Map<string, number>()
  const result: Card[] = []
  for (const card of all) {
    if (seen.has(card.img)) continue
    const count = perUser.get(card.userId) ?? 0
    if (count >= 1) continue
    seen.add(card.img)
    perUser.set(card.userId, count + 1)
    result.push(card)
    if (result.length >= 6) break
  }
  return result
}

async function fetchPodium() {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const { data } = await supabase
    .from('cartes_manuelles')
    .select('user_id, profiles(display_name, avatar_url)')
    .gte('created_at', startOfMonth)

  if (!data || data.length === 0) return []

  const counts = new Map<string, { displayName: string; avatarUrl: string | null; count: number }>()
  for (const row of data) {
    const uid = row.user_id
    const profile = row.profiles as any
    if (!profile?.display_name) continue
    if (!counts.has(uid)) {
      counts.set(uid, { displayName: profile.display_name, avatarUrl: profile.avatar_url || null, count: 0 })
    }
    counts.get(uid)!.count++
  }

  return [...counts.entries()]
    .map(([userId, v]) => ({ userId, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
}

export default async function Home() {
  const [
    { count },
    { data: statsData },
    { count: manuellesCount },
    { data: profiles },
    podium,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('stats_total').gt('stats_total', 0),
    Promise.resolve({ count: 0 }),
    supabase.from('profiles').select('id, display_name, lien_csv').order('updated_at', { ascending: false }).limit(20),
    fetchPodium(),
  ])

  const total = count ?? 0
  const totalCartes = statsData?.reduce((acc, p) => acc + (p.stats_total || 0), 0) ?? 0
  const cards = await fetchPepites(profiles || [])

  return (
    <div>
      <HomeHero total={total} totalCartes={totalCartes} />
      <PepitesSection cards={cards} />
      <PodiumSection entries={podium} />
      <PWAInstall />
    </div>
  )
}
