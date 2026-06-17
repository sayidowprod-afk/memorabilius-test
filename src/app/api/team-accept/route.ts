import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  const { candidatureId, teamId, userId, action } = await req.json()
  if (!candidatureId || !teamId || !userId) return NextResponse.json({ error: 'missing params' }, { status: 400 })

  if (action === 'accept') {
    await supabase.from('team_candidatures').update({ statut: 'accepte' }).eq('id', candidatureId)
    const { error } = await supabase.from('team_members').insert({ team_id: teamId, user_id: userId })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Notification au candidat
    await supabase.from('notifications').insert({
      user_id: userId, type: 'team_join', lu: false,
      message: 'Votre candidature a été acceptée ! Vous êtes maintenant membre de la team.',
      lien: `/teams/${teamId}`,
    })
  } else {
    await supabase.from('team_candidatures').update({ statut: 'refuse' }).eq('id', candidatureId)
    await supabase.from('notifications').insert({
      user_id: userId, type: 'system', lu: false,
      message: 'Votre candidature à la team n\'a pas été retenue.',
      lien: `/teams`,
    })
  }

  return NextResponse.json({ ok: true })
}
