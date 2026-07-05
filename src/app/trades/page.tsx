'use client'
import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

function ImageZoom({ src, alt }: { src: string; alt: string }) {
  const [zoomed, setZoomed] = useState(false)
  const [pos, setPos] = useState({ x: 50, y: 50 })

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!zoomed) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = ((e.clientX - rect.left) / rect.width) * 100
    const y = ((e.clientY - rect.top) / rect.height) * 100
    setPos({ x, y })
  }

  return (
    <div
      onClick={() => setZoomed(!zoomed)}
      onMouseMove={handleMove}
      onMouseLeave={() => setZoomed(false)}
      style={{
        width: '100%', height: '100%', minHeight: 400,
        cursor: zoomed ? 'zoom-out' : 'zoom-in',
        overflow: 'hidden', position: 'relative',
      }}
      title={zoomed ? 'Cliquer pour dézoomer' : 'Cliquer pour zoomer'}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          display: 'block',
          transition: zoomed ? 'none' : 'transform 0.3s ease',
          transform: zoomed ? `scale(2.5)` : 'scale(1)',
          transformOrigin: zoomed ? `${pos.x}% ${pos.y}%` : 'center center',
          userSelect: 'none',
        }}
      />
      {!zoomed && (
        <div style={{
          position: 'absolute', bottom: 10, right: 10,
          background: 'rgba(0,0,0,0.5)', color: 'white',
          fontSize: 11, padding: '4px 8px', borderRadius: 6, fontWeight: 700,
          pointerEvents: 'none',
        }}>🔍 Zoom</div>
      )}
    </div>
  )
}

export default function Trades() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [trades, setTrades] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [filter, setFilter] = useState<'tous' | 'offre' | 'recherche'>('tous')
  const [search, setSearch] = useState('')
  const [fEquipe, setFEquipe] = useState('')
  const [fSport, setFSport] = useState('')
  const [fTags, setFTags] = useState({ rc: false, auto: false, num: false, patch: false })
  const [popup, setPopup] = useState<any | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/connexion'); return }
      setUserId(data.user.id)
      loadTrades()
    })
  }, [])

  // Fermer avec Échap
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPopup(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const loadTrades = async () => {
    const { data } = await supabase
      .from('trades')
      .select('*, profiles(id, display_name, avatar_url, instagram, twitter, discord)')
      .eq('statut', 'actif')
      .is('team_id', null)
      .order('created_at', { ascending: false })
    setTrades(data || [])
    setLoading(false)
  }

  const SPORTS: Record<string, string> = { basket: '🏀', foot: '⚽', football_us: '🏈', baseball: '⚾', hockey: '🏒', pokemon: '🟡', tcg: '🃏' }

  const filtered = trades.filter(t => {
    if (filter !== 'tous' && t.type !== filter) return false
    if (search && !t.titre.toLowerCase().includes(search.toLowerCase()) && !t.joueur?.toLowerCase().includes(search.toLowerCase())) return false
    if (fEquipe && !t.equipe?.toLowerCase().includes(fEquipe.toLowerCase())) return false
    if (fSport && t.sport !== fSport) return false
    if (fTags.rc && !t.rc) return false
    if (fTags.auto && !t.auto) return false
    if (fTags.num && !t.num) return false
    if (fTags.patch && !t.patch) return false
    return true
  })

  const closeTrade = async (id: number) => {
    await supabase.from('trades').update({ statut: 'clos' }).eq('id', id)
    setTrades(prev => prev.filter(t => t.id !== id))
    setPopup(null)
  }

  const SocialBadges = ({ profile }: { profile: any }) => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {profile?.instagram && (
        <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 700, color: '#E1306C', background: '#fce4ec', padding: '4px 10px', borderRadius: 20, textDecoration: 'none' }}>
          📸 {profile.instagram.startsWith('@') ? profile.instagram : `@${profile.instagram}`}
        </a>
      )}
      {profile?.twitter && (
        <a href={`https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 700, color: '#121212', background: '#f0f0f0', padding: '4px 10px', borderRadius: 20, textDecoration: 'none' }}>
          𝕏 {profile.twitter.startsWith('@') ? profile.twitter : `@${profile.twitter}`}
        </a>
      )}
      {profile?.discord && (
        <span style={{ fontSize: 12, fontWeight: 700, color: '#5865F2', background: '#eef0ff', padding: '4px 10px', borderRadius: 20 }}>
          🎮 {profile.discord}
        </span>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>{t('trades_title')}</h1>
        <Link href="/trades/nouveau" className="btn-main btn-primary" style={{ padding: '10px 24px', fontSize: 14 }}>
          {t('trades_post')}
        </Link>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('trades_search')} style={{ flex: 1, minWidth: 200 }} />
          <input value={fEquipe} onChange={e => setFEquipe(e.target.value)} placeholder={lang === 'fr' ? 'Filtrer par équipe...' : 'Filter by team...'} style={{ width: 180 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            {(['tous', 'offre', 'recherche'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)} style={{
                padding: '8px 18px', border: 'none', borderRadius: 8, cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                background: filter === f ? '#003DA6' : '#f0f0f0',
                color: filter === f ? 'white' : '#333',
              }}>{f === 'tous' ? t('trades_all') : f === 'offre' ? t('trades_offers') : t('trades_searches')}</button>
            ))}
          </div>
        </div>
        {/* Ligne 2 : sports + tags */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Sport :</span>
          {Object.entries(SPORTS).map(([key, emoji]) => {
            const labels: Record<string, string> = { basket: 'Basket', foot: 'Football', football_us: 'Football US', baseball: 'Baseball', hockey: 'Hockey', pokemon: 'Pokémon', tcg: 'TCG' }
            return (
              <button key={key} onClick={() => setFSport(fSport === key ? '' : key)} title={labels[key]} style={{
                padding: '5px 12px', border: 'none', borderRadius: 20, cursor: 'pointer',
                fontWeight: 700, fontSize: 13,
                background: fSport === key ? '#003DA6' : '#f0f0f0',
                color: fSport === key ? 'white' : '#333',
              }}>{emoji}</button>
            )
          })}
          <span style={{ fontSize: 12, fontWeight: 700, color: '#888', marginLeft: 8 }}>Tags :</span>
          {(['rc', 'auto', 'num', 'patch'] as const).map(k => (
            <button key={k} onClick={() => setFTags(prev => ({ ...prev, [k]: !prev[k] }))} style={{
              padding: '5px 12px', border: 'none', borderRadius: 20, cursor: 'pointer',
              fontWeight: 900, fontSize: 12, textTransform: 'uppercase',
              background: fTags[k] ? '#003DA6' : '#f0f0f0',
              color: fTags[k] ? 'white' : '#333',
            }}>{k === 'num' ? '# NUM' : k.toUpperCase()}</button>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
            {filtered.map(trade => (
              <div key={trade.id} onClick={() => setPopup(trade)} style={{
                background: 'white', borderRadius: 16, overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.06)', border: '1px solid #eee',
                cursor: 'pointer', transition: '0.2s',
              }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
              >
                {/* Badge */}
                <div style={{ padding: '8px 16px', background: trade.type === 'offre' ? '#e8f5e9' : '#e3f2fd', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 900, color: trade.type === 'offre' ? '#2e7d32' : '#1976d2' }}>
                    {trade.type === 'offre' ? '📤 Offre' : '📥 Recherche'}
                  </span>
                  <span style={{ fontSize: 11, color: '#999' }}>{new Date(trade.created_at).toLocaleDateString('fr-FR')}</span>
                </div>
                {/* Image */}
                {trade.image_url ? (
                  <div style={{ height: 200, overflow: 'hidden' }}>
                    <img src={trade.image_url} alt={trade.titre} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ height: 80, background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>
                    🃏
                  </div>
                )}
                {/* Info */}
                <div style={{ padding: '14px 16px' }}>
                  <h3 style={{ fontWeight: 900, fontSize: 15, margin: '0 0 6px' }}>{trade.titre}</h3>
                  {trade.joueur && <p style={{ fontSize: 12, color: '#003DA6', fontWeight: 700, margin: '0 0 8px' }}>{SPORTS[trade.sport] || '🏀'} {trade.joueur}{trade.equipe ? ` · ${trade.equipe}` : ''}</p>}
                  {/* Tags */}
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {trade.rc && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#e67e22', color: 'white' }}>RC</span>}
                    {trade.auto && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#2e7d32', color: 'white' }}>AUTO</span>}
                    {trade.num && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}># NUM</span>}
                    {trade.patch && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: 'white' }}>PATCH</span>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingTop: 10, borderTop: '1px solid #f0f0f0' }}>
                    <img src={trade.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(trade.profiles?.display_name || 'U')}&background=003DA6&color=fff`}
                      style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#444' }}>{trade.profiles?.display_name}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* Popup — rendu via portal dans document.body : évite que le "contain:
          layout" (optimisation LCP sur main > *:first-child, voir globals.css)
          ne redéfinisse le containing block du position:fixed et ne colle la
          popup en haut de la page au lieu de la centrer plein écran */}
      {popup && createPortal(
        <div onClick={() => setPopup(null)} style={{
          position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.6)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: 'white', borderRadius: 20, overflow: 'hidden',
            maxWidth: 800, width: '100%', maxHeight: '90vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <style>{`
              @media (min-width: 600px) {
                .trade-popup-inner { flex-direction: row !important; }
                .trade-popup-img { flex: 1 !important; min-height: 400px !important; }
                .trade-popup-info { flex: 0 0 360px !important; max-width: 360px !important; }
              }
              @media (max-width: 599px) {
                .trade-popup-img { height: 320px !important; min-height: unset !important; }
              }
            `}</style>
            <div className="trade-popup-inner" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', flex: 1, minHeight: 0 }}>
            {/* Image */}
            <div className="trade-popup-img" style={{ background: '#f8f8f8', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
              {popup.image_url ? (
                <ImageZoom src={popup.image_url} alt={popup.titre} />
              ) : (
                <span style={{ fontSize: 80 }}>🃏</span>
              )}
              <div style={{ position: 'absolute', top: 12, left: 12, background: popup.type === 'offre' ? '#2e7d32' : '#1976d2', color: 'white', padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 900 }}>
                {popup.type === 'offre' ? '📤 Offre' : '📥 Recherche'}
              </div>
            </div>

            {/* Infos */}
            <div className="trade-popup-info" style={{ padding: 24, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14, flex: 1 }}>
              {/* Fermer */}
              <button onClick={() => setPopup(null)} style={{
                alignSelf: 'flex-end', background: '#f0f0f0', border: 'none', width: 32, height: 32,
                borderRadius: '50%', fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>

              {/* Titre */}
              <h2 style={{ fontWeight: 900, fontSize: 22, margin: 0 }}>{popup.titre}</h2>

              {/* Détails carte */}
              {(popup.joueur || popup.annee || popup.marque || popup.equipe) && (
                <div style={{ background: '#f8f8f8', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {popup.joueur && <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{SPORTS[popup.sport] || '🏀'} {popup.joueur}</p>}
                  {popup.equipe && <p style={{ margin: 0, fontSize: 13, color: '#666' }}>🏟️ {popup.equipe}</p>}
                  {popup.annee && <p style={{ margin: 0, fontSize: 13, color: '#666' }}>📅 {popup.annee}</p>}
                  {popup.marque && <p style={{ margin: 0, fontSize: 13, color: '#666' }}>🏷️ {popup.marque}</p>}
                  {/* Tags */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                    {popup.rc && <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 4, background: '#e67e22', color: 'white' }}>RC</span>}
                    {popup.auto && <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 4, background: '#2e7d32', color: 'white' }}>AUTO</span>}
                    {popup.num && <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}># NUM</span>}
                    {popup.patch && <span style={{ fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 4, background: '#1976d2', color: 'white' }}>PATCH</span>}
                  </div>
                </div>
              )}

              {/* Description */}
              {popup.description && (
                <p style={{ fontSize: 14, color: '#555', lineHeight: 1.6, margin: 0 }}>{popup.description}</p>
              )}

              {/* Profil */}
              <div style={{ borderTop: '1px solid #eee', paddingTop: 16 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', margin: '0 0 10px' }}>Proposé par</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <img src={popup.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(popup.profiles?.display_name || 'U')}&background=003DA6&color=fff`}
                    style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover', border: '2px solid #eee' }} alt="" />
                  <Link href={`/galerie/${popup.profiles?.id}`} onClick={() => setPopup(null)} style={{ fontWeight: 800, fontSize: 15, color: '#121212', textDecoration: 'none' }}>
                    {popup.profiles?.display_name}
                  </Link>
                </div>
                <SocialBadges profile={popup.profiles} />
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 'auto' }}>
                {userId && userId !== popup.user_id && (
                  <Link href={`/messages?to=${popup.profiles?.id}&trade=${popup.id}`} onClick={() => setPopup(null)} style={{
                    background: '#003DA6', color: 'white', padding: '12px',
                    borderRadius: 10, fontWeight: 700, fontSize: 14, textAlign: 'center', textDecoration: 'none',
                  }}>
                    💬 Envoyer un message
                  </Link>
                )}
                {userId === popup.user_id && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Link href={`/trades/${popup.id}`} onClick={() => setPopup(null)} style={{
                      background: '#f0f0f0', color: '#333', padding: '12px',
                      borderRadius: 10, fontWeight: 700, fontSize: 14, textAlign: 'center', textDecoration: 'none',
                    }}>
                      ✏️ Modifier l'annonce
                    </Link>
                    <button onClick={() => closeTrade(popup.id)} style={{
                      background: '#fff5f5', color: '#e67e22', padding: '12px',
                      border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}>
                      ✓ Marquer comme conclu
                    </button>
                    <button onClick={async () => {
                      if (!confirm('Supprimer définitivement cette annonce ?')) return
                      await supabase.from('trades').delete().eq('id', popup.id)
                      setTrades(prev => prev.filter(t => t.id !== popup.id))
                      setPopup(null)
                    }} style={{
                      background: '#fff5f5', color: '#e74c3c', padding: '12px',
                      border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
                    }}>
                      🗑️ Supprimer l'annonce
                    </button>
                  </div>
                )}
                <p style={{ fontSize: 11, color: '#bbb', textAlign: 'center', margin: 0 }}>
                  Publié le {new Date(popup.created_at).toLocaleDateString('fr-FR')}
                </p>
              </div>
            </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
