import { supabase } from '@/lib/supabase'
import PepitesSection from '@/components/PepitesSection'
import HomeHero from '@/components/HomeHero'

export const revalidate = 300

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
      const r = await fetch(p.lien_csv!, { next: { revalidate: 300 } })
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

  // Mélange et limite à 8
  return all.sort(() => Math.random() - 0.5).slice(0, 8)
}

export default async function Home() {
  const [
    { count },
    { data: statsData },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('stats_total').not('lien_csv', 'is', null).neq('lien_csv', '').gt('stats_total', 0),
    supabase.from('profiles').select('id, display_name, lien_csv').order('updated_at', { ascending: false }).limit(20),
  ])

  const total = count ?? 0
  const totalCartes = statsData?.reduce((acc, p) => acc + (p.stats_total || 0), 0) ?? 0
  const cards = await fetchPepites(profiles || [])

  return (
    <div>
      <HomeHero total={total} totalCartes={totalCartes} />
      <PepitesSection cards={cards} />
    </div>
  )
}
