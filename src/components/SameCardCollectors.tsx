'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Collector {
  id: string; slug: string; display_name: string
  avatar_url: string; accent: string; cardImg?: string
}

export default function SameCardCollectors({ cardName, year, brand, set, excludeUserId, accent }: {
  cardName: string
  year?: string
  brand?: string
  set?: string
  excludeUserId?: string
  accent: string
}) {
  const [collectors, setCollectors] = useState<Collector[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!cardName) return
    const params = new URLSearchParams({ name: cardName })
    if (year) params.set('year', year)
    if (brand) params.set('brand', brand)
    if (set) params.set('set', set)
    if (excludeUserId) params.set('exclude', excludeUserId)
    fetch(`/api/same-card?${params}`)
      .then(r => r.json())
      .then(d => { setCollectors(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [cardName, year, brand, set, excludeUserId])

  if (loading || collectors.length === 0) return null

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
      <div style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>
        {collectors.length} autre{collectors.length > 1 ? 's' : ''} collectionneur{collectors.length > 1 ? 's' : ''} avec cette carte
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {collectors.map(c => (
          <Link key={c.id} href={`/galerie/${c.id}`} style={{ textDecoration: 'none' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: '#f8f8f8', border: `1.5px solid ${c.accent}20`,
              borderRadius: 50, padding: '4px 12px 4px 4px',
              transition: '0.15s', cursor: 'pointer',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = `${c.accent}12`; e.currentTarget.style.borderColor = c.accent }}
              onMouseLeave={e => { e.currentTarget.style.background = '#f8f8f8'; e.currentTarget.style.borderColor = `${c.accent}20` }}
            >
              <img
                src={c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.display_name || 'U')}&background=003DA6&color=fff&size=64`}
                style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', border: `1.5px solid ${c.accent}` }}
                alt={c.display_name}
              />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#333' }}>{c.display_name}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
