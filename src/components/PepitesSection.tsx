'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

interface Profile { id: string; display_name: string; lien_csv: string }
interface Card {
  img: string; name: string; variant: string; year: string
  brand: string; rc: boolean; auto: boolean; patch: boolean
  num: string; collector: string; userId: string
}

export default function PepitesSection({ profiles }: { profiles: Profile[] }) {
  const { t } = useLang()
  const [cards, setCards] = useState<Card[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const all: Card[] = []
      await Promise.all(profiles.map(async p => {
        try {
          const r = await fetch(p.lien_csv)
          if (!r.ok) return
          const text = await r.text()
          const rows = text.split(/\r?\n/).filter(row => row.includes('http'))
          const last = rows.slice(-4)
          last.forEach(row => {
            const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
            if (!c[0]?.includes('http')) return
            all.push({
              img: c[0]?.trim(),
              name: c[2] || '',
              variant: c[7] || '',
              year: c[4] || '',
              brand: c[5] || '',
              rc: c[10]?.toLowerCase().includes('oui') || false,
              auto: c[9]?.toLowerCase().includes('oui') || false,
              patch: c[11]?.toLowerCase().includes('oui') || false,
              num: c[8] || '',
              collector: p.display_name,
              userId: p.id,
            })
          })
        } catch { }
      }))
      // Trier par ordre inverse et prendre 6
      setCards(all.reverse().slice(0, 6))
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20, marginBottom: 60 }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{ background: '#f0f0f0', borderRadius: 12, aspectRatio: '2.5/3.5', animation: 'pulse 1.5s infinite' }} />
      ))}
    </div>
  )

  if (cards.length === 0) return null

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20, marginBottom: 60 }}>
      {cards.map((card, i) => (
        <Link key={i} href={`/galerie/${card.userId}`} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee', textDecoration: 'none', display: 'block', transition: '0.3s' }}>
          <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden' }}>
            <img src={card.img} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {card.rc && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#e67e22', color: 'white' }}>RC</span>}
              {card.auto && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#2e7d32', color: 'white' }}>AUTO</span>}
              {card.num && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>/{card.num}</span>}
              {card.patch && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: 'white' }}>PATCH</span>}
            </div>
            <p style={{ fontWeight: 800, fontSize: 13, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#121212' }}>{card.name}</p>
            {card.variant && <p style={{ fontSize: 10, color: '#003DA6', fontWeight: 700, margin: '2px 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.variant}</p>}
            <p style={{ fontSize: 10, color: '#999', margin: '2px 0 4px' }}>{card.year} {card.brand}</p>
            <p style={{ fontSize: 10, color: '#bbb', margin: 0 }}>Par {card.collector}</p>
          </div>
        </Link>
      ))}
    </section>
  )
}
