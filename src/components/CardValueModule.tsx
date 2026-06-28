'use client'
import { useEffect, useRef, useState } from 'react'

interface ActiveListing { price: number; title: string; url: string; img: string }
interface SoldListing   { price: number; title: string; url: string; img: string; soldDate: string }

interface Props {
  cardName: string
  set: string
  year: string
  num: string
  variant?: string
  rc?: boolean
  auto?: boolean
  patch?: boolean
  grade?: string
  accent: string
  img?: string
}

function medianOf(prices: number[]) {
  if (!prices.length) return 0
  const s = [...prices].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m]
}

function fmtDate(iso: string) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function CardValueModule({ cardName, set, year, num, variant, rc, auto, patch, grade, accent, img }: Props) {
  const [active, setActive]   = useState<ActiveListing[]>([])
  const [sold, setSold]       = useState<SoldListing[]>([])
  const [loading, setLoading] = useState(true)

  const printRun = num?.match(/\/\d+/) ? num.match(/\/\d+/)![0] : num
  const ebaySearchUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent([cardName, variant, set, year, printRun, rc && 'RC', auto && 'AUTO', patch && 'PATCH', grade].filter(Boolean).join(' '))}&LH_Sold=1&LH_Complete=1`

  useEffect(() => {
    if (!cardName) { setLoading(false); return }

    const params = new URLSearchParams({ name: cardName })
    if (set)     params.set('set', set)
    if (year)    params.set('year', year)
    if (num)     params.set('num', num)
    if (variant) params.set('variant', variant)
    if (rc)      params.set('rc', 'true')
    if (auto)    params.set('auto', 'true')
    if (patch)   params.set('patch', 'true')
    if (grade)   params.set('grade', grade)
    if (img)     params.set('img', img)

    let cancelled = false
    const controller = new AbortController()

    // Annonces actives — chemin critique, même logique qu'avant
    fetch(`/api/ebay-sold?${params.toString()}`, { signal: controller.signal })
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        setActive((json.items || []).map((i: any) => ({
          price: Math.round(i.price * 100) / 100,
          title: i.title || '',
          url: i.url || '',
          img: i.img || '',
        })))
        setLoading(false)
      })
      .catch(() => { if (!cancelled) setLoading(false) })

    // Ventes conclues — endpoint séparé, ne bloque pas l'affichage actif
    fetch(`/api/ebay-completed?${params.toString()}`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        setSold((json.sold || []).map((i: any) => ({
          price: Math.round(i.price * 100) / 100,
          title: i.title || '',
          url: i.url || '',
          img: i.img || '',
          soldDate: i.soldDate || '',
        })))
      })
      .catch(() => {})

    return () => { cancelled = true; controller.abort() }
  }, [cardName, set, year, num, variant, rc, auto, patch, grade, img])

  const soldMedian   = Math.round(medianOf(sold.map(i => i.price)) * 100) / 100
  const activeMedian = Math.round(medianOf(active.map(i => i.price)) * 100) / 100

  const ebayLink = (
    <a href={ebaySearchUrl} target="_blank" rel="noopener noreferrer"
      style={{ fontSize: 10, fontWeight: 700, color: '#999', textDecoration: 'none',
        display: 'inline-flex', alignItems: 'center', gap: 3,
        border: '1px solid #e8e8e8', borderRadius: 20, padding: '3px 9px', transition: '0.15s' }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = '#bbb')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
    >
      eBay ↗
    </a>
  )

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
      {/* Header avec stats médiane */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1 }}>Marché</span>
        {!loading && soldMedian > 0 && (
          <span style={{ fontSize: 13, fontWeight: 900, color: '#2e7d32' }}>{soldMedian}€ <span style={{ fontSize: 9, fontWeight: 700, color: '#aaa' }}>vendu (méd.)</span></span>
        )}
        {!loading && activeMedian > 0 && (
          <span style={{ fontSize: 13, fontWeight: 900, color: accent }}>{activeMedian}€ <span style={{ fontSize: 9, fontWeight: 700, color: '#aaa' }}>demandé (méd.)</span></span>
        )}
        <span style={{ marginLeft: 'auto' }}>{ebayLink}</span>
      </div>

      {loading && (
        <div style={{ height: 4, background: '#f0f0f0', borderRadius: 2, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', background: `linear-gradient(90deg,${accent}33,${accent},${accent}33)`,
            backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
        </div>
      )}

      {!loading && sold.length === 0 && active.length === 0 && (
        <p style={{ fontSize: 11, color: '#ccc', margin: 0 }}>Aucune annonce trouvée</p>
      )}

      {/* Ventes conclues */}
      {sold.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            Ventes conclues ({sold.length})
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {sold.map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none', flexShrink: 0, width: 70 }}>
                <div style={{ borderRadius: 6, overflow: 'hidden', border: '1.5px solid #e8e8e8',
                  background: 'white', transition: '0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#2e7d32')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e8e8e8')}
                >
                  {item.img
                    ? <img src={item.img} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: '#f5f5f5' }} />
                    : <div style={{ width: '100%', aspectRatio: '1', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🃏</div>
                  }
                  <div style={{ padding: '4px 5px 5px' }}>
                    <div style={{ fontWeight: 900, fontSize: 12, color: '#2e7d32', lineHeight: 1.1 }}>{item.price}€</div>
                    <div style={{ fontSize: 9, color: '#aaa', marginTop: 1 }}>{fmtDate(item.soldDate)}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Annonces actives */}
      {active.length > 0 && (
        <div>
          <div style={{ fontSize: 9, fontWeight: 800, color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
            En vente ({active.length})
          </div>
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
            {active.map((item, i) => (
              <a key={i} href={item.url} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none', flexShrink: 0, width: 70 }}>
                <div style={{ borderRadius: 6, overflow: 'hidden', border: `1.5px solid ${accent}44`,
                  background: 'white', transition: '0.15s' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = accent)}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = `${accent}44`)}
                >
                  {item.img
                    ? <img src={item.img} alt="" style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block', background: '#f5f5f5' }} />
                    : <div style={{ width: '100%', aspectRatio: '1', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🃏</div>
                  }
                  <div style={{ padding: '4px 5px 5px' }}>
                    <div style={{ fontWeight: 900, fontSize: 12, color: accent, lineHeight: 1.1 }}>{item.price}€</div>
                    <div style={{ fontSize: 9, color: '#aaa', marginTop: 1 }}>En vente</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
