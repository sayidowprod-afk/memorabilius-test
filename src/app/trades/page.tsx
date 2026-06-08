'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function Trades() {
  const router = useRouter()
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'tous' | 'offre' | 'recherche'>('tous')
  const [search, setSearch] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
      loadTrades()
    })
  }, [])

  const loadTrades = async () => {
    const { data } = await supabase
      .from('trades')
      .select('*, profiles(id, display_name, avatar_url, instagram, twitter, discord)')
      .eq('statut', 'actif')
      .order('created_at', { ascending: false })
    setTrades(data || [])
    setLoading(false)
  }

  const filtered = trades.filter(t => {
    if (filter !== 'tous' && t.type !== filter) return false
    if (search && !t.titre.toLowerCase().includes(search.toLowerCase()) && !t.joueur?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const closeTrade = async (id: number) => {
    await supabase.from('trades').update({ statut: 'clos' }).eq('id', id)
    setTrades(prev => prev.filter(t => t.id !== id))
  }

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>Trades</h1>
        <Link href="/trades/nouveau" className="btn-main btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>
          + Poster une annonce
        </Link>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un joueur, une carte..." style={{ flex: 1, minWidth: 200 }} />
        <div style={{ display: 'flex', gap: 8 }}>
          {(['tous', 'offre', 'recherche'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} style={{
              padding: '8px 18px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontWeight: 700, fontSize: 13, textTransform: 'capitalize',
              background: filter === f ? '#003DA6' : '#f0f0f0',
              color: filter === f ? 'white' : '#333',
            }}>{f === 'tous' ? 'Tous' : f === 'offre' ? '📤 Offres' : '📥 Recherches'}</button>
          ))}
        </div>
      </div>

      {loading ? <p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement...</p> : (
        filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>
            <p style={{ fontSize: 18, marginBottom: 12 }}>Aucune annonce pour l'instant</p>
            <Link href="/trades/nouveau" className="btn-main btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>Être le premier à poster</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {filtered.map(trade => (
              <div key={trade.id} style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #eee', display: 'flex', flexDirection: 'column' }}>
                {/* Badge type */}
                <div style={{ padding: '8px 16px', background: trade.type === 'offre' ? '#e8f5e9' : '#e3f2fd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: trade.type === 'offre' ? '#2e7d32' : '#1976d2', textTransform: 'uppercase' }}>
                    {trade.type === 'offre' ? '📤 Offre' : '📥 Recherche'}
                  </span>
                  <span style={{ fontSize: 11, color: '#999' }}>{new Date(trade.created_at).toLocaleDateString('fr-FR')}</span>
                </div>

                {/* Image */}
                {trade.image_url && (
                  <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', maxHeight: 200 }}>
                    <img src={trade.image_url} alt={trade.titre} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                )}

                {/* Contenu */}
                <div style={{ padding: 20, flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <h3 style={{ fontWeight: 900, fontSize: 16, margin: 0 }}>{trade.titre}</h3>
                  {trade.joueur && <p style={{ fontSize: 12, color: '#003DA6', fontWeight: 700, margin: 0 }}>🏀 {trade.joueur} {trade.annee && `· ${trade.annee}`} {trade.marque && `· ${trade.marque}`}</p>}
                  {trade.description && <p style={{ fontSize: 13, color: '#666', margin: 0, lineHeight: 1.5 }}>{trade.description}</p>}

                  {/* Profil */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, paddingTop: 12, borderTop: '1px solid #f0f0f0' }}>
                    <img src={trade.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(trade.profiles?.display_name || 'U')}&background=003DA6&color=fff`}
                      style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                    <Link href={`/galerie/${trade.profiles?.id}`} style={{ fontSize: 13, fontWeight: 700, color: '#121212' }}>
                      {trade.profiles?.display_name}
                    </Link>
                  </div>
                  {/* Réseaux sociaux */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                    {trade.profiles?.instagram && (
                      <a href={`https://instagram.com/${trade.profiles.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, fontWeight: 700, color: '#E1306C', background: '#fce4ec', padding: '3px 8px', borderRadius: 20, textDecoration: 'none' }}>
                        📸 {trade.profiles.instagram.startsWith('@') ? trade.profiles.instagram : `@${trade.profiles.instagram}`}
                      </a>
                    )}
                    {trade.profiles?.twitter && (
                      <a href={`https://x.com/${trade.profiles.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                        style={{ fontSize: 11, fontWeight: 700, color: '#121212', background: '#f0f0f0', padding: '3px 8px', borderRadius: 20, textDecoration: 'none' }}>
                        𝕏 {trade.profiles.twitter.startsWith('@') ? trade.profiles.twitter : `@${trade.profiles.twitter}`}
                      </a>
                    )}
                    {trade.profiles?.discord && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#5865F2', background: '#eef0ff', padding: '3px 8px', borderRadius: 20 }}>
                        🎮 {trade.profiles.discord}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    {userId && userId !== trade.user_id && (
                      <Link href={`/messages?to=${trade.profiles?.id}&trade=${trade.id}`} style={{
                        flex: 1, background: '#003DA6', color: 'white', padding: '8px 12px',
                        borderRadius: 8, fontWeight: 700, fontSize: 12, textAlign: 'center', textDecoration: 'none'
                      }}>
                        💬 Contacter
                      </Link>
                    )}
                    {userId === trade.user_id && (
                      <button onClick={() => closeTrade(trade.id)} style={{
                        flex: 1, background: '#f0f0f0', color: '#666', padding: '8px 12px',
                        border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer'
                      }}>
                        ✓ Marquer comme conclu
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  )
}
