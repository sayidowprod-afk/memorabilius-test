import { supabase } from '@/lib/supabase'
import PepitesSection from '@/components/PepitesSection'
import HomeHero from '@/components/HomeHero'
import PodiumSection from '@/components/PodiumSection'
import PWAInstall from '@/components/PWAInstall'

// ISR : rebuild en arrière-plan toutes les 5 min, instantané pour les visiteurs
export const revalidate = 300

interface Card {
  img: string; name: string; variant: string; year: string
  brand: string; rc: boolean; auto: boolean; patch: boolean
  num: string; collector: string; userId: string
}

async function fetchPepites(): Promise<Card[]> {
  const [{ data: manuelles }, { data: profiles }] = await Promise.all([
    supabase
      .from('cartes_manuelles')
      .select('image_recto, nom, variation, annee, marque, rc, auto, patch, num, user_id')
      .not('image_recto', 'is', null)
      .order('created_at', { ascending: false })
      .limit(40),
    supabase.from('profiles').select('id, display_name'),
  ])

  const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name]))

  const seen = new Set<string>()
  const perUser = new Map<string, number>()
  const result: Card[] = []

  for (const m of (manuelles || [])) {
    const collector = profileMap.get(m.user_id)
    if (!collector || !m.image_recto) continue
    if (seen.has(m.image_recto)) continue
    const count = perUser.get(m.user_id) ?? 0
    if (count >= 1) continue
    seen.add(m.image_recto)
    perUser.set(m.user_id, count + 1)
    result.push({
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
    if (result.length >= 6) break
  }
  return result
}

async function fetchPodium() {
  const month = new Date().toISOString().slice(0, 7)

  const { data } = await supabase
    .from('monthly_additions')
    .select('user_id, count, profiles(display_name, avatar_url)')
    .eq('month', month)
    .order('count', { ascending: false })
    .limit(10)

  if (!data?.length) return []

  return data
    .map((row: any) => ({
      userId: row.user_id,
      displayName: row.profiles?.display_name || '',
      avatarUrl: row.profiles?.avatar_url || null,
      count: row.count,
    }))
    .filter(e => e.displayName)
}

export default async function Home() {
  const [
    { count },
    { data: statsData },
    cards,
    podium,
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('stats_total').gt('stats_total', 0),
    fetchPepites(),
    fetchPodium(),
  ])

  const total = count ?? 0
  const totalCartes = statsData?.reduce((acc, p) => acc + (p.stats_total || 0), 0) ?? 0

  return (
    <div>
      <HomeHero total={total} totalCartes={totalCartes} />
      <PepitesSection cards={cards} />
      <PodiumSection entries={podium} />
      <PWAInstall />
    </div>
  )
}
