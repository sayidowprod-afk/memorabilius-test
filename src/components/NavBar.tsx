'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useTheme } from '@/lib/ThemeContext'
import { useLang } from '@/lib/LangContext'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [unread, setUnread] = useState(0)
  const [notifs, setNotifs] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { dark, toggle } = useTheme()
  const { lang, setLang, t } = useLang()

  const LangToggle = () => (
    <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} style={{
      background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`,
      borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
      fontSize: 12, fontWeight: 700, color: dark ? '#ddd' : '#666',
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      {lang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR'}
    </button>
  )

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null)
      if (data.user) { loadUnread(data.user.id); loadNotifs(data.user.id); updateLastSeen(data.user.id) }
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
      if (session?.user) { loadUnread(session.user.id); loadNotifs(session.user.id) }
      else { setUnread(0); setNotifs(0) }
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (user) { loadUnread(user.id); loadNotifs(user.id); updateLastSeen(user.id) }
    setMenuOpen(false)
  }, [pathname])

  const updateLastSeen = async (uid: string) => {
    await supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', uid)
  }

  const loadUnread = async (uid: string) => {
    const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_user_id', uid).eq('lu', false)
    setUnread(count || 0)
  }

  const loadNotifs = async (uid: string) => {
    const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('lu', false)
    setNotifs(count || 0)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const ls = { color: dark ? '#ddd' : '#444', fontWeight: 600 as const, fontSize: 15, padding: '12px 0', display: 'flex' as const, alignItems: 'center' as const, gap: 6, textDecoration: 'none', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}`, width: '100%' }

  const Badge = ({ count }: { count: number }) => count > 0 ? (
    <span style={{ background: '#e74c3c', color: 'white', borderRadius: '50%', minWidth: 18, height: 18, fontSize: 10, fontWeight: 900, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
      {count > 9 ? '9+' : count}
    </span>
  ) : null

  return (
    <>
      <nav style={{ background: dark ? '#1a1a1a' : 'white', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#eee'}`, padding: '0 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, position: 'sticky', top: 0, zIndex: 200 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', background: dark ? 'white' : 'transparent', borderRadius: dark ? 8 : 0, padding: dark ? '3px 8px' : 0, transition: 'all 0.2s' }}>
          <img src="/memorabilius-logo.png" alt="Memorabilius" width={150} height={30} style={{ height: 30, width: 'auto' }} />
        </Link>

        {/* Desktop */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }} className="nav-desktop">
          <Link href="/annuaire" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>{t('nav_annuaire')}</Link>
          <Link href="/teams" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>{t('nav_teams')}</Link>
          <Link href="/trades" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>{t('nav_trades')}</Link>
          <Link href="/recherche" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>{t('nav_recherche')}</Link>
          <Link href="/tuto" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>{t('nav_tuto')}</Link>
          <Link href="/setlist" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>Setlist</Link>
          <Link href="/evenements" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>Events</Link>
          {user === undefined ? (
            <div style={{ visibility: 'hidden', display: 'flex', gap: 20, alignItems: 'center' }}>
              <span style={{ fontWeight: 600 }}>Ma galerie</span>
              <span style={{ fontWeight: 600 }}>Messages</span>
              <span style={{ fontWeight: 600 }}>Profil</span>
              <button className="btn-main btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>Connexion</button>
            </div>
          ) : user ? (
            <>
              <Link href={`/galerie/${user.id}`} style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>{t('nav_galerie')}</Link>
              <Link href="/messages" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                {t('nav_messages')} <Badge count={unread} />
              </Link>
              <Link href="/notifications" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                🔔 <Badge count={notifs} />
              </Link>
              <Link href="/profil" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>{t('nav_profil')}</Link>
              <LangToggle />
              <button onClick={toggle} style={{ background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 14 }}>{dark ? '☀️' : '🌙'}</button>
              <button onClick={handleLogout} className="btn-main btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>{t('nav_deconnexion')}</button>
            </>
          ) : (
            <>
              <Link href="/connexion" style={{ color: dark ? '#ddd' : '#444', fontWeight: 600 }}>{t('nav_connexion')}</Link>
              <LangToggle />
              <button onClick={toggle} style={{ background: 'none', border: `1px solid ${dark ? '#555' : '#ddd'}`, borderRadius: 20, padding: '4px 12px', cursor: 'pointer', fontSize: 14 }}>{dark ? '☀️' : '🌙'}</button>
              <Link href="/sinscrire" className="btn-main btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>{t('nav_inscription')}</Link>
            </>
          )}
        </div>

        {/* Hamburger */}
        <button className="nav-hamburger" onClick={() => setMenuOpen(!menuOpen)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ display: 'block', width: 25, height: 2.5, background: dark ? '#ddd' : '#333', borderRadius: 2, transition: '0.3s', transform: menuOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
          <span style={{ display: 'block', width: 25, height: 2.5, background: dark ? '#ddd' : '#333', borderRadius: 2, transition: '0.3s', opacity: menuOpen ? 0 : 1 }} />
          <span style={{ display: 'block', width: 25, height: 2.5, background: dark ? '#ddd' : '#333', borderRadius: 2, transition: '0.3s', transform: menuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
        </button>
      </nav>

      {/* Menu mobile */}
      {menuOpen && (
        <div style={{ position: 'fixed', top: 60, left: 0, right: 0, bottom: 0, background: dark ? '#1a1a1a' : 'white', zIndex: 199, padding: '16px 24px', display: 'flex', flexDirection: 'column', overflowY: 'auto' }} className="nav-mobile-menu">
          <Link href="/annuaire" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_annuaire')}</Link>
          <Link href="/teams" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_teams')}</Link>
          <Link href="/trades" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_trades')}</Link>
          <Link href="/recherche" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_recherche')}</Link>
          <Link href="/tuto" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_tuto')}</Link>
          <Link href="/setlist" style={ls} onClick={() => setMenuOpen(false)}>Setlist</Link>
          <Link href="/evenements" style={ls} onClick={() => setMenuOpen(false)}>Events</Link>
          {user ? (
            <>
              <Link href={`/galerie/${user.id}`} style={ls} onClick={() => setMenuOpen(false)}>{t('nav_galerie')}</Link>
              <Link href="/messages" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_messages')} <Badge count={unread} /></Link>
              <Link href="/notifications" style={ls} onClick={() => setMenuOpen(false)}>Notifications <Badge count={notifs} /></Link>
              <Link href="/profil" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_profil')}</Link>
              <div style={{ padding: '12px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}`, display: 'flex', gap: 8 }}>
                <button onClick={toggle} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 600 }}>{dark ? '☀️' : '🌙'}</button>
                <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 700 }}>{lang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR'}</button>
              </div>
              <div style={{ padding: '16px 0' }}>
                <button onClick={handleLogout} style={{ width: '100%', background: '#003DA6', color: 'white', border: 'none', borderRadius: 8, padding: '12px', fontWeight: 700, cursor: 'pointer', fontSize: 15 }}>{t('nav_deconnexion')}</button>
              </div>
            </>
          ) : (
            <>
              <Link href="/connexion" style={ls} onClick={() => setMenuOpen(false)}>{t('nav_connexion')}</Link>
              <div style={{ padding: '12px 0', borderBottom: `1px solid ${dark ? '#2a2a2a' : '#f5f5f5'}`, display: 'flex', gap: 8 }}>
                <button onClick={toggle} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 600 }}>{dark ? '☀️' : '🌙'}</button>
                <button onClick={() => setLang(lang === 'fr' ? 'en' : 'fr')} style={{ flex: 1, background: dark ? '#2a2a2a' : '#f5f5f5', border: 'none', borderRadius: 8, padding: '10px', cursor: 'pointer', fontSize: 14, color: dark ? '#ddd' : '#333', fontWeight: 700 }}>{lang === 'fr' ? '🇬🇧 EN' : '🇫🇷 FR'}</button>
              </div>
              <div style={{ padding: '16px 0' }}>
                <Link href="/sinscrire" style={{ display: 'block', background: '#003DA6', color: 'white', borderRadius: 8, padding: '12px', fontWeight: 700, fontSize: 15, textAlign: 'center', textDecoration: 'none' }} onClick={() => setMenuOpen(false)}>{t('nav_inscription')}</Link>
              </div>
            </>
          )}
        </div>
      )}
    </>
  )
}