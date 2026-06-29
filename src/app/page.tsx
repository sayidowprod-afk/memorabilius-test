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
  num: string; collector: string; userId: string; isHorizontal: boolean
}

async function fetchPepites(): Promise<Card[]> {
  const [{ data: manuelles }, { data: profiles }] = await Promise.all([
    supabase
      .from('cartes_manuelles')
      .select('image_recto, nom, variation, annee, marque, rc, auto, patch, num, user_id, is_horizontal')
      .not('image_recto', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase.from('profiles').select('id, display_name'),
  ])

  const profileMap = new Map((profiles || []).map(p => [p.id, p.display_name]))

  // Dédupliquer par image et ne garder que les cartes avec un profil connu
  const seen = new Set<string>()
  const items = (manuelles || []).filter(m => {
    if (!m.image_recto || !profileMap.get(m.user_id)) return false
    if (seen.has(m.image_recto)) return false
    seen.add(m.image_recto)
    return true
  }).map(m => ({
    img: m.image_recto as string,
    name: m.nom || '',
    variant: m.variation || '',
    year: m.annee || '',
    brand: m.marque || '',
    rc: m.rc || false,
    auto: m.auto || false,
    patch: m.patch || false,
    num: m.num || '',
    collector: profileMap.get(m.user_id) as string,
    userId: m.user_id,
    isHorizontal: m.is_horizontal || false,
  }))

  // Passe 1 : max 1 carte par utilisateur pour la diversité
  const perUser = new Map<string, number>()
  const result: Card[] = []
  for (const item of items) {
    if ((perUser.get(item.userId) ?? 0) >= 1) continue
    perUser.set(item.userId, 1)
    result.push(item)
    if (result.length >= 6) break
  }

  // Passe 2 : compléter jusqu'à 6 en acceptant plusieurs cartes du même user
  if (result.length < 6) {
    const inResult = new Set(result.map(r => r.img))
    for (const item of items) {
      if (inResult.has(item.img)) continue
      result.push(item)
      if (result.length >= 6) break
    }
  }

  return result
}

async function fetchPodium() {
  const now = new Date()
  const month = now.toISOString().slice(0, 7)
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

  const counts = new Map<string, { displayName: string; avatarUrl: string | null; count: number }>()

  // Source 1 : monthly_additions — tenu à jour en temps réel (synchro CSV + ajouts manuels via /api/card-added)
  try {
    const { data } = await supabase
      .from('monthly_additions')
      .select('user_id, count, profiles(display_name, avatar_url)')
      .eq('month', month)
    for (const row of (data || []) as any[]) {
      if (!row.profiles?.display_name) continue
      counts.set(row.user_id, { displayName: row.profiles.display_name, avatarUrl: row.profiles.avatar_url || null, count: row.count })
    }
  } catch {}

  // Source 2 : cartes_manuelles pour les users absents de monthly_additions
  // (cards ajoutées avant le déploiement du système temps-réel, ou sans synchro)
  // On pagine par 1000 pour éviter la troncature sur les grosses collections
  let manualPage = 0
  const manualCounts = new Map<string, { displayName: string; avatarUrl: string | null; count: number }>()
  while (true) {
    const { data: manual } = await supabase
      .from('cartes_manuelles')
      .select('user_id, profiles(display_name, avatar_url)')
      .gte('created_at', startOfMonth)
      .range(manualPage * 1000, manualPage * 1000 + 999)
    if (!manual || manual.length === 0) break
    for (const row of manual as any[]) {
      if (!row.profiles?.display_name) continue
      const e = manualCounts.get(row.user_id)
      if (!e) manualCounts.set(row.user_id, { displayName: row.profiles.display_name, avatarUrl: row.profiles.avatar_url || null, count: 1 })
      else e.count++
    }
    if (manual.length < 1000) break
    manualPage++
  }

  // Fusionner : monthly_additions est prioritaire (inclut CSV + manuelles syncées).
  // Pour les users non encore dans monthly_additions ce mois, utiliser cartes_manuelles.
  for (const [uid, v] of manualCounts) {
    const existing = counts.get(uid)
    if (!existing) counts.set(uid, v)
    else if (v.count > existing.count) existing.count = v.count
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
