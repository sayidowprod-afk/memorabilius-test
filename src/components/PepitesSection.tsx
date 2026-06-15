'use client'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'

interface Card {
  img: string; name: string; variant: string; year: string
  brand: string; rc: boolean; auto: boolean; patch: boolean
  num: string; collector: string; userId: string
}

export default function PepitesSection({ cards }: { cards: Card[] }) {
  const { t } = useLang()

  if (cards.length === 0) return null

  return (
    <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 20, marginBottom: 60 }}>
      {cards.map((card, i) => (
        <Link key={i} href={`/galerie/${card.userId}`} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee', textDecoration: 'none', display: 'block', transition: '0.3s' }}>
          <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden' }}>
            <img src={card.img} alt={card.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading={i === 0 ? 'eager' : 'lazy'} fetchPriority={i === 0 ? 'high' : 'auto'} />
          </div>
          <div style={{ padding: '10px 12px' }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {card.rc && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#e67e22', color: 'white' }}>RC</span>}
              {card.auto && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#2e7d32', color: 'white' }}>AUTO</span>}
              {(() => {
                const m = card.num?.trim().match(/\/(\d+)$/)
                const v = m ? parseInt(m[1]) : null
                if (!card.num) return null
                if (v === 1) return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b)', color: '#3d2800', textShadow: '0 1px 0 rgba(255,255,255,0.4)', display: 'inline-block', animation: 'oon-anim 1.8s ease-in-out infinite', willChange: 'transform' }}>{card.num}</span>
                if (v !== null && v <= 10) return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#555,#c0c0c0,#fff,#c0c0c0,#555)', color: '#111', display: 'inline-block', animation: 'low-anim 2.2s ease-in-out infinite', willChange: 'transform' }}>{card.num}</span>
                if (v !== null && v <= 25) return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#6d3a00,#cd7f32,#f5cba7,#cd7f32,#6d3a00)', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.6)', display: 'inline-block', animation: 'bro-anim 2.6s ease-in-out infinite', willChange: 'transform' }}>{card.num}</span>
                return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>{card.num}</span>
              })()}
              {card.patch && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: 'white' }}>PATCH</span>}
            </div>
            <p style={{ fontWeight: 800, fontSize: 13, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#121212' }}>{card.name}</p>
            {card.variant && <p style={{ fontSize: 10, color: '#003DA6', fontWeight: 700, margin: '2px 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.variant}</p>}
            <p style={{ fontSize: 10, color: '#999', margin: '2px 0 4px' }}>{card.year} {card.brand}</p>
            <p style={{ fontSize: 10, color: '#bbb', margin: 0 }}>{t('by_label')} {card.collector}</p>
          </div>
        </Link>
      ))}
    </section>
  )
}
