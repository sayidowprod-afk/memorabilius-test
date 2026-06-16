import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name')?.trim()
  const year = req.nextUrl.searchParams.get('year')?.trim() || ''
  const brand = req.nextUrl.searchParams.get('brand')?.trim() || ''
  const set = req.nextUrl.searchParams.get('set')?.trim() || ''
  const excludeUserId = req.nextUrl.searchParams.get('exclude') || ''
  if (!name || name.length < 2) return NextResponse.json([])

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

  // Cartes manuelles
  const { data: manuelles } = await supabase
    .from('cartes_manuelles')
    .select('user_id, nom, image_recto, annee, marque, collection')
    .neq('user_id', excludeUserId)

  const matchIds = new Set<string>()
  const cardsByUser = new Map<string, any>()

  ;(manuelles || []).forEach(m => {
    const sameName = normalize(m.nom || '') === normalize(name)
    const sameYear = !year || normalize(m.annee || '') === normalize(year)
    const sameBrand = !brand || normalize(m.marque || '') === normalize(brand)
    const sameSet = !set || normalize(m.collection || '') === normalize(set)
    if (sameName && sameYear && sameBrand && sameSet) {
      matchIds.add(m.user_id)
      if (!cardsByUser.has(m.user_id)) cardsByUser.set(m.user_id, m)
    }
  })

  if (matchIds.size === 0) return NextResponse.json([])

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url, couleur_bordure, slug')
    .in('id', [...matchIds])

  const results = (profiles || []).map(p => ({
    id: p.id,
    slug: p.slug || p.id,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    accent: p.couleur_bordure || '#003DA6',
    cardImg: cardsByUser.get(p.id)?.image_recto,
  }))

  return NextResponse.json(results)
}
