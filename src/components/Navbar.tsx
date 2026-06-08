'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null>(null)
  const [unread, setUnread] = useState(0)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user)
      if (data.user) loadUnread(data.user.id)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadUnread(session.user.id)
      else setUnread(0)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  // Recharger les non lus quand on change de page
  useEffect(() => {
    if (user) loadUnread(user.id)
  }, [pathname])

  const loadUnread = async (uid: string) => {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user_id', uid)
      .eq('lu', false)
    setUnread(count || 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <nav style={{
      background: 'white', borderBottom: '1px solid #eee',
      padding: '0 20px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', height: 60,
      position: 'sticky', top: 0, zIndex: 100,
    }}>
      <Link href="/" style={{ fontWeight: 900, fontSize: 20, color: '#003DA6', letterSpacing: '-0.5px' }}>
        Memorabilius
      </Link>
      <div style={{ display: 'flex', gap: 24, alignItems: 'center', fontSize: 14, fontWeight: 600 }}>
        <Link href="/annuaire" style={{ color: '#444' }}>Annuaire</Link>
        <Link href="/teams" style={{ color: '#444' }}>Teams</Link>
        <Link href="/trades" style={{ color: '#444' }}>Trades</Link>
        <Link href="/tuto" style={{ color: '#444' }}>Tutoriel</Link>
        {user ? (
          <>
            <Link href={`/galerie/${user.id}`} style={{ color: '#444' }}>Ma galerie</Link>
            {/* Messages avec badge */}
            <Link href="/messages" style={{ color: '#444', position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              Messages
              {unread > 0 && (
                <span style={{
                  background: '#e74c3c', color: 'white',
                  borderRadius: '50%', minWidth: 18, height: 18,
                  fontSize: 10, fontWeight: 900,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 4px',
                }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </Link>
            <Link href="/profil" style={{ color: '#444' }}>Profil</Link>
            <button onClick={handleLogout} className="btn-main btn-secondary" style={{ padding: '8px 20px', fontSize: 13 }}>
              Déconnexion
            </button>
          </>
        ) : (
          <>
            <Link href="/connexion" style={{ color: '#444' }}>Connexion</Link>
            <Link href="/sinscrire" className="btn-main btn-primary" style={{ padding: '8px 20px', fontSize: 13 }}>
              S'inscrire
            </Link>
          </>
        )}
      </div>
    </nav>
  )
}
