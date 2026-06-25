import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { set_id, player_name, team, variation, card_number, user_id } = await req.json()
    if (!set_id || !player_name || !user_id) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 })
    }

    // Créer l'entrée dans card_set_entries
    const { data: entry, error: entryError } = await supabaseAdmin
      .from('card_set_entries')
      .insert({
        set_id,
        player_name,
        team: team || null,
        variation: variation || null,
        card_number: card_number || null,
      })
      .select('id')
      .single()

    if (entryError) return NextResponse.json({ error: entryError.message }, { status: 500 })

    // Placer la carte dans user_set_completion
    const { error: compError } = await supabaseAdmin
      .from('user_set_completion')
      .upsert({ user_id, entry_id: entry.id, manually_checked: true }, { onConflict: 'user_id,entry_id' })

    if (compError) return NextResponse.json({ error: compError.message }, { status: 500 })

    return NextResponse.json({ entry_id: entry.id })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
