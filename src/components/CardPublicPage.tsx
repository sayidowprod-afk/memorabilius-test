'use client'
import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import CardValueModule from './CardValueModule'
import SameCardCollectors from './SameCardCollectors'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface Props {
  userId: string
  cardSlug: string
  src?: string
}

export default function CardPublicPage({ userId, cardSlug, src }: Props) {
  const [profile, setProfile] = useState<any>(null)
  const [card, setCard] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const cardRef = useRef<HTMLDivElement>(null)

  const accent = profile?.couleur_bordure || '#003DA6'

  useEffect(() => {
    const load = async () => {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', userId).single()
      setProfile(p)

      // Cherche dans cartes_manuelles via l'URL image
      if (src) {
        const { data: m } = await supabase
          .from('cartes_manuelles')
          .select('*')
          .eq('user_id', userId)
          .eq('image_recto', src)
          .maybeSingle()
        if (m) {
          setCard({
            f: m.image_recto, b: m.image_verso || m.image_recto,
            n: m.nom, t: m.equipe, y: m.annee,
            br: m.marque, s: m.collection, v: m.variation,
            num: m.num, auto: m.auto, rc: m.rc, patch: m.patch, g: m.grade || 'Raw',
          })
        } else {
          // Carte CSV : reconstituer depuis le slug
          setCard({ f: src, b: src, n: slugToName(cardSlug), t: '', y: '', br: '', s: '', v: '', num: '', auto: false, rc: false, patch: false, g: 'Raw' })
        }
      }
      setLoading(false)
    }
    load()
  }, [userId, src, cardSlug])

  // Tilt 3D au survol
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = cardRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    el.style.transform = `perspective(800px) rotateY(${x * 16}deg) rotateX(${-y * 12}deg) scale(1.02)`
  }
  const handleMouseLeave = () => {
    if (cardRef.current) cardRef.current.style.transform = 'perspective(800px) rotateY(0deg) rotateX(0deg) scale(1)'
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '70vh' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #eee', borderTopColor: '#003DA6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )

  if (!card) return (
    <div style={{ textAlign: 'center', padding: 80, color: '#bbb' }}>
      <p style={{ fontSize: 18, fontWeight: 700 }}>Carte introuvable</p>
      {profile && <Link href={`/galerie/${userId}`} style={{ color: accent, fontWeight: 700 }}>Voir la galerie de {profile.display_name}</Link>}
    </div>
  )

  const tags = []
  if (card.rc) tags.push({ label: 'RC', bg: '#e67e22' })
  if (card.auto) tags.push({ label: 'AUTO', bg: '#2e7d32' })
  if (card.patch) tags.push({ label: 'PATCH', bg: '#1976d2' })
  if (card.num) tags.push({ label: card.num, bg: '#7b1fa2' })

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '30px 16px', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        .card-page-layout { display: flex; gap: 48px; align-items: flex-start; }
        .card-page-image { flex: 0 0 340px; }
        .card-page-info { flex: 1; min-width: 0; }
        @media (max-width: 700px) {
          .card-page-layout { flex-direction: column; gap: 24px; }
          .card-page-image { flex: none; width: 100%; max-width: 280px; margin: 0 auto; }
        }
      `}</style>

      {/* Breadcrumb */}
      <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#999' }}>
        <Link href="/annuaire" style={{ color: '#999', textDecoration: 'none' }}>Annuaire</Link>
        <span>›</span>
        {profile && <Link href={`/galerie/${userId}`} style={{ color: accent, textDecoration: 'none', fontWeight: 700 }}>{profile.display_name}</Link>}
        <span>›</span>
        <span style={{ color: '#333', fontWeight: 600 }}>{card.n}</span>
      </div>

      <div className="card-page-layout">
        {/* Image */}
        <div className="card-page-image">
          <div
            ref={cardRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{
              width: '100%', aspectRatio: '2.5/3.5',
              borderRadius: 12, overflow: 'hidden',
              boxShadow: `0 20px 60px ${accent}33, 0 4px 20px rgba(0,0,0,0.15)`,
              transition: 'transform 0.15s ease',
              cursor: 'default',
              border: `3px solid ${accent}22`,
            }}
          >
            <img src={card.f} alt={card.n} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          </div>

          {/* Collectionneur */}
          {profile && (
            <Link href={`/galerie/${userId}`} style={{ textDecoration: 'none', display: 'block', marginTop: 20 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: '#f8f8f8', borderRadius: 12, padding: '12px 16px',
                border: `1.5px solid ${accent}22`, transition: '0.15s',
              }}
                onMouseEnter={e => { e.currentTarget.style.background = `${accent}10`; e.currentTarget.style.borderColor = accent }}
                onMouseLeave={e => { e.currentTarget.style.background = '#f8f8f8'; e.currentTarget.style.borderColor = `${accent}22` }}
              >
                <img
                  src={profile.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.display_name || 'U')}&background=003DA6&color=fff&size=64`}
                  style={{ width: 40, height: 40, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${accent}` }}
                  alt={profile.display_name}
                />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', marginBottom: 2 }}>Collectionneur</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#121212' }}>{profile.display_name}</div>
                </div>
                <span style={{ marginLeft: 'auto', fontSize: 12, color: accent, fontWeight: 700 }}>Voir galerie →</span>
              </div>
            </Link>
          )}
        </div>

        {/* Infos */}
        <div className="card-page-info">
          {card.t && <div style={{ color: accent, fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{card.t}</div>}
          <h1 style={{ fontSize: 32, fontWeight: 900, margin: '0 0 6px', lineHeight: 1.1 }}>{card.n}</h1>
          {card.v && <div style={{ fontSize: 15, color: accent, fontWeight: 700, fontStyle: 'italic', marginBottom: 14 }}>{card.v}</div>}

          {/* Tags */}
          {tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
              {tags.map(tag => (
                <span key={tag.label} style={{ fontSize: 11, fontWeight: 900, padding: '5px 10px', borderRadius: 6, background: tag.bg, color: 'white' }}>{tag.label}</span>
              ))}
            </div>
          )}

          {/* Grille infos */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, padding: '20px', background: '#f8f8f8', borderRadius: 12, marginBottom: 20 }}>
            {[
              ['Année', card.y],
              ['Numérotation', card.num || 'N/A'],
              ['Grade', card.g],
              ['Collection', `${card.br} ${card.s}`.trim() || 'N/A'],
            ].map(([label, value]) => (
              <div key={label}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#121212' }}>{value}</div>
              </div>
            ))}
          </div>

          {/* Valeur estimée */}
          <CardValueModule
            cardName={card.n}
            set={`${card.br} ${card.s}`.trim()}
            year={card.y}
            num={card.num}
            accent={accent}
          />

          {/* Autres collectionneurs */}
          {card.n && (
            <SameCardCollectors cardName={card.n} excludeUserId={userId} accent={accent} />
          )}
        </div>
      </div>
    </div>
  )
}

function slugToName(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
