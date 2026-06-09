import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

export async function GET(
  request: Request,
  context: { params: Promise<{ userId: string }> | { userId: string } }
) {
  // Résolution propre des paramètres dynamiques pour éviter les erreurs de build Next.js
  const resolvedParams = 'then' in context.params ? await context.params : context.params
  const userId = resolvedParams.userId

  try {
    // 1. Récupérer l'utilisateur connecté via le client Supabase standard
    const { data: { user } } = await supabase.auth.getUser()
    const currentUserId = user?.id || null
    const isOwner = currentUserId === userId

    // 2. Récupérer le profil pour avoir le lien CSV
    const { data: profile } = await supabase
      .from('profiles')
      .select('lien_csv')
      .eq('id', userId)
      .single()

    if (!profile || !profile.lien_csv) {
      return NextResponse.json({ cards: [] })
    }

    // 3. Récupérer les clés des cartes privées
    const { data: privateData } = await supabase
      .from('cartes_privees')
      .select('card_key')
      .eq('user_id', userId)

    const privateKeys = new Set(privateData?.map((d) => d.card_key) || [])

    // 4. Charger et parser le CSV
    const r = await fetch(profile.lien_csv + '&t=' + Date.now())
    const t = await r.text()
    const rows = t.split(/\r?\n/).slice(4)

    const parsed: Card[] = rows
      .map((row) => {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        if (!c[0] || !c[0].includes('http')) return null
        return {
          f: c[0]?.trim(), b: c[1]?.trim() || c[0]?.trim(),
          n: c[2] || '', t: c[3] || '', y: c[4] || '',
          br: c[5] || '', s: c[6] || '', v: c[7] || '',
          num: c[8] || '', auto: c[9]?.toLowerCase().includes('oui') || false,
          rc: c[10]?.toLowerCase().includes('oui') || false,
          patch: c[11]?.toLowerCase().includes('oui') || false,
          g: c[12] || 'Raw',
        }
      })
      .filter(Boolean) as Card[]

    // 5. Filtrage de sécurité strict côté serveur
    const filteredCards = parsed.filter((card) => {
      if (!isOwner && privateKeys.has(card.f)) {
        return false 
      }
      return true
    })

    return NextResponse.json({ cards: filteredCards })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 })
  }
}