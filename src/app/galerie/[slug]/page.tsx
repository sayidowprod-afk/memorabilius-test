import { redirect } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export default async function GalerieSlug({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  // Si c'est déjà un UUID valide, rediriger directement
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (uuidRegex.test(slug)) {
    redirect(`/galerie/${slug}`)
  }

  // Chercher par slug
  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('slug', slug)
    .single()

  if (profile) redirect(`/galerie/${profile.id}`)

  redirect('/annuaire')
}
