'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

export default function Notifications() {
  const router = useRouter()
  const { t } = useLang()
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      const { data: n } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', data.user.id)
        .order('created_at', { ascending: false })
        .limit(50)
      setNotifs(n || [])
      // Tout marquer comme lu
      await supabase.from('notifications').update({ lu: true }).eq('user_id', data.user.id).eq('lu', false)
      setLoading(false)
    })
  }, [])

  const getIcon = (type: string) => {
    const icons: Record<string, string> = {
      team_join: '👥', team_candidature: '📋', message: '💬', trade: '🔄', system: '🔔'
    }
    return icons[type] || '🔔'
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'À l\'instant'
    if (mins < 60) return `Il y a ${mins}min`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `Il y a ${hours}h`
    const days = Math.floor(hours / 24)
    return `Il y a ${days}j`
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60 }}>Chargement...</p>

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', fontFamily: 'Inter, sans-serif' }}>
      <h1 style={{ fontWeight: 900, fontSize: 28, marginBottom: 24 }}>{t('notif_title')}</h1>

      {notifs.length === 0 ? (
        <div style={{ background: 'white', borderRadius: 16, padding: 60, textAlign: 'center', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔔</div>
          <p style={{ color: '#bbb', fontSize: 16 }}>{t('notif_none')}</p>
        </div>
      ) : (
        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          {notifs.map((n, i) => (
            <div key={n.id} onClick={() => n.lien && router.push(n.lien)} style={{
              padding: '16px 20px', borderBottom: i < notifs.length - 1 ? '1px solid #f5f5f5' : 'none',
              display: 'flex', alignItems: 'center', gap: 16,
              background: n.lu ? 'white' : '#f0f4ff',
              cursor: n.lien ? 'pointer' : 'default',
              transition: '0.2s',
            }}
              onMouseEnter={e => { if (n.lien) e.currentTarget.style.background = '#e8eeff' }}
              onMouseLeave={e => e.currentTarget.style.background = n.lu ? 'white' : '#f0f4ff'}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}>{getIcon(n.type)}</span>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: n.lu ? 400 : 700, color: '#121212' }}>{n.message}</p>
                <p style={{ margin: '3px 0 0', fontSize: 12, color: '#999' }}>{timeAgo(n.created_at)}</p>
              </div>
              {!n.lu && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#003DA6', flexShrink: 0 }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
