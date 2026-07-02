'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { subscribePush } from '@/components/PWAInstall'

export default function Notifications() {
  const router = useRouter()
  const { t } = useLang()
  const [notifs, setNotifs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [pushPerm, setPushPerm] = useState<NotificationPermission | null>(null)
  const [pushLoading, setPushLoading] = useState(false)

  useEffect(() => {
    if ('Notification' in window) setPushPerm(Notification.permission)
  }, [])

  const handleEnablePush = async () => {
    setPushLoading(true)
    try {
      // PWAInstall (qui enregistre normalement le SW) n'est monté que sur
      // l'accueil — on force l'enregistrement ici sinon subscribePush() reste
      // bloqué sur navigator.serviceWorker.ready si le SW n'existe pas encore
      await navigator.serviceWorker.register('/sw.js')
      const perm = await Notification.requestPermission()
      setPushPerm(perm)
      if (perm === 'granted') await subscribePush()
    } finally {
      setPushLoading(false)
    }
  }

  const handleDisablePush = async () => {
    setPushLoading(true)
    try {
      await navigator.serviceWorker.register('/sw.js')
      const sw = await navigator.serviceWorker.ready
      const sub = await sw.pushManager.getSubscription()
      if (sub) {
        const { data: { session } } = await supabase.auth.getSession()
        await fetch('/api/push-subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
        await sub.unsubscribe()
        setPushPerm(Notification.permission)
      }
    } finally {
      setPushLoading(false)
    }
  }

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
      team_join: '👥', team_candidature: '📋', message: '💬', trade: '🔄', system: '🔔', wishlist_match: '🎯', comment: '💬', badge: '🏆', like: '❤️'
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>{t('notif_title')}</h1>
        {'Notification' in window && pushPerm === 'denied' && (
          <span style={{ fontSize: 12, color: '#e74c3c', fontWeight: 700 }}>🔕 Notifications bloquées dans le navigateur</span>
        )}
        {'Notification' in window && pushPerm !== 'granted' && pushPerm !== 'denied' && pushPerm !== null && (
          <button onClick={handleEnablePush} disabled={pushLoading}
            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px', background: '#003DA6', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
          >
            {pushLoading ? '...' : '🔔 Activer les notifications push'}
          </button>
        )}
        {pushPerm === 'granted' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, color: '#2ecc71', fontWeight: 700 }}>🔔 Notifications activées</span>
            <button onClick={handleDisablePush} disabled={pushLoading} style={{ padding: '6px 12px', background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
              {pushLoading ? '...' : 'Désactiver'}
            </button>
          </div>
        )}
      </div>

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
