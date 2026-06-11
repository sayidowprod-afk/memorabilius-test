import { supabase } from '@/lib/supabase'
import PepitesSection from '@/components/PepitesSection'
import HomeHero from '@/components/HomeHero'

export const revalidate = 300

export default async function Home() {
  const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const total = count ?? 0

  const { data: statsData } = await supabase
    .from('profiles')
    .select('stats_total')
    .not('lien_csv', 'is', null)
    .neq('lien_csv', '')
    .gt('stats_total', 0)
  const totalCartes = statsData?.reduce((acc, p) => acc + (p.stats_total || 0), 0) ?? 0

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, lien_csv')
    .not('lien_csv', 'is', null)
    .neq('lien_csv', '')
    .order('updated_at', { ascending: false })
    .limit(4)

  return (
    <div>
      <HomeHero total={total} totalCartes={totalCartes} />
      <PepitesSection profiles={profiles || []} />
    </div>
  )
}
