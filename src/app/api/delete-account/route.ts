import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function DELETE(req: NextRequest) {
  try {
    const { userId } = await req.json()
    if (!userId) return NextResponse.json({ error: 'Missing userId' }, { status: 400 })

    // Vérifier que l'appelant est bien le propriétaire du compte
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user || user.id !== userId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    // Supprimer toutes les données
    await supabaseAdmin.from('messages').delete().eq('from_user_id', userId)
    await supabaseAdmin.from('messages').delete().eq('to_user_id', userId)
    await supabaseAdmin.from('team_members').delete().eq('user_id', userId)
    await supabaseAdmin.from('team_candidatures').delete().eq('user_id', userId)
    await supabaseAdmin.from('cartes_privees').delete().eq('user_id', userId)
    await supabaseAdmin.from('trades').update({ statut: 'clos' }).eq('user_id', userId)
    await supabaseAdmin.from('profiles').delete().eq('id', userId)
    await supabaseAdmin.auth.admin.deleteUser(userId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
