'use client'
import { useEffect, useRef, useState } from 'react'
import type { CardValueResponse } from '@/app/api/card-value/route'

interface Props {
  cardName: string
  set: string
  year: string
  num: string
  variant?: string
  rc?: boolean
  auto?: boolean
  patch?: boolean
  accent: string
}

export default function CardValueModule({ cardName, set, year, num, variant, rc, auto, patch, accent }: Props) {
  const [data, setData] = useState<CardValueResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)

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

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15000)

    fetch(`/api/ebay-sold?${params}`, { signal: controller.signal })
      .then(r => r.json())
      .then((json) => {
        clearTimeout(timeout)
        if (json.error) { setErrorMsg(json.error); setLoading(false); return }
        const { items } = json
        if (!items || items.length < 2) { setLoading(false); return }
        const sorted = [...items].sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
        const prices = sorted.map((i: any) => i.price)
        setData({
          sales: sorted.map((i: any) => ({ price: Math.round(i.price * 100) / 100, date: i.date.slice(0, 10) })),
          current: Math.round(prices[prices.length - 1] * 100) / 100,
          min: Math.round(Math.min(...prices) * 100) / 100,
          max: Math.round(Math.max(...prices) * 100) / 100,
          currency: '€',
          source: 'ebay',
        } as any)
        setLoading(false)
      })
      .catch((err) => { clearTimeout(timeout); setErrorMsg(err?.name === 'AbortError' ? 'timeout' : 'erreur réseau'); setLoading(false) })

    return () => { clearTimeout(timeout); controller.abort() }
  }, [cardName, set, year, num, variant, rc, auto, patch])

  const ar = parseInt(accent.slice(1, 3), 16)
  const ag = parseInt(accent.slice(3, 5), 16)
  const ab = parseInt(accent.slice(5, 7), 16)

  if (loading) return null

  if (errorMsg) {
    const printRun = num?.match(/\/\d+/) ? num.match(/\/\d+/)![0] : num
    const ebayUrl = `https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent([cardName, variant, set, year, printRun, rc && 'RC', auto && 'AUTO', patch && 'PATCH'].filter(Boolean).join(' '))}&LH_Sold=1&LH_Complete=1`
    return (
      <div style={{ borderTop: '1px solid #eee', paddingTop: 10, marginTop: 10 }}>
        <a href={ebayUrl} target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 12, fontWeight: 700, color: '#999', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 6 }}>
          🔍 Voir les ventes eBay ↗
        </a>
      </div>
    )
  }

  if (!data || data.sales.length === 0) return null

  const { sales, current, min, max, currency, source } = data
  const prices = sales.map(s => s.price)
  const minP = Math.min(...prices)
  const maxP = Math.max(...prices)
  const range = maxP - minP || 1

  const W = 200, H = 52, PAD_X = 4, PAD_Y = 8
  const pts = sales.map((s, i) => ({
    x: PAD_X + (i / (sales.length - 1)) * (W - PAD_X * 2),
    y: PAD_Y + (1 - (s.price - minP) / range) * (H - PAD_Y * 2),
  }))

  // Courbe lissée via bezier cubique
  const smooth = (pts: {x:number,y:number}[]) => {
    if (pts.length < 2) return ''
    let d = `M ${pts[0].x} ${pts[0].y}`
    for (let i = 1; i < pts.length; i++) {
      const prev = pts[i - 1], cur = pts[i]
      const cpx = (prev.x + cur.x) / 2
      d += ` C ${cpx} ${prev.y} ${cpx} ${cur.y} ${cur.x} ${cur.y}`
    }
    return d
  }

  const linePath = smooth(pts)
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${H + 2} L ${pts[0].x} ${H + 2} Z`

  const trend = prices[prices.length - 1] - prices[0]
  const trendColor = trend >= 0 ? '#2e7d32' : '#c62828'
  const trendSign = trend >= 0 ? '+' : ''

  const hoveredSale = hovered !== null ? sales[hovered] : null
  const hoveredPt   = hovered !== null ? pts[hovered]   : null

  // Trouve l'index le plus proche de la position X de la souris dans le SVG
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current
    if (!svg) return
    const rect = svg.getBoundingClientRect()
    const xRatio = (e.clientX - rect.left) / rect.width
    const xSvg = xRatio * W
    let closest = 0, minDist = Infinity
    pts.forEach((p, i) => {
      const d = Math.abs(p.x - xSvg)
      if (d < minDist) { minDist = d; closest = i }
    })
    setHovered(closest)
  }

  // Formate la date "2024-11-03" → "3 nov. 2024"
  const fmtDate = (d: string) => {
    const date = new Date(d)
    return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // Tooltip : afficher à gauche si on est dans la 2ème moitié du graphique
  const tooltipLeft = hovered !== null && hovered > sales.length / 2

  return (
    <div style={{ borderTop: '1px solid #eee', paddingTop: 14, marginTop: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#999', textTransform: 'uppercase', letterSpacing: 1 }}>Valeur estimée</span>
        {(source as any) === 'ebay' && <span style={{ fontSize: 9, color: '#ccc', fontWeight: 600 }}>— ventes eBay</span>}
        <a
          href={`https://www.ebay.fr/sch/i.html?_nkw=${encodeURIComponent([cardName, variant, set, year, num ? (num.match(/\/\d+/) ? num.match(/\/\d+/)![0] : num) : '', rc && 'RC', auto && 'AUTO', patch && 'PATCH'].filter(Boolean).join(' '))}&LH_Sold=1&LH_Complete=1`}
          target="_blank" rel="noopener noreferrer"
          style={{ fontSize: 9, fontWeight: 700, color: '#999', textDecoration: 'none', border: '1px solid #e0e0e0', borderRadius: 20, padding: '2px 8px', whiteSpace: 'nowrap', transition: '0.15s' }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#999' }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e0e0e0' }}
        >
          eBay ↗
        </a>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: trendColor }}>
          {trendSign}{Math.round(trend * 100) / 100}{currency} sur 4 mois
        </span>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
        {/* Graphique */}
        <div style={{ flex: 1, minWidth: 0, position: 'relative' }}>
          <svg
            ref={svgRef}
            viewBox={`0 0 ${W} ${H}`}
            style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible', cursor: 'crosshair' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              <linearGradient id="cvm-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={accent} stopOpacity="0.18" />
                <stop offset="100%" stopColor={accent} stopOpacity="0" />
              </linearGradient>
            </defs>

            <path d={areaPath} fill="url(#cvm-area)" />
            <path d={linePath} fill="none" stroke={accent} strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />

            {/* Ligne verticale fine au hover */}
            {hoveredPt && (
              <line x1={hoveredPt.x} y1={PAD_Y - 4} x2={hoveredPt.x} y2={H}
                stroke={accent} strokeWidth="0.8" strokeOpacity="0.35" />
            )}

            {/* Point hover uniquement */}
            {hovered !== null && hoveredPt && (
              <circle cx={hoveredPt.x} cy={hoveredPt.y} r="3" fill={accent} />
            )}

            {/* Tooltip SVG au hover */}
            {hoveredPt && hoveredSale && (() => {
              const tx = tooltipLeft ? hoveredPt.x - 5 : hoveredPt.x + 5
              const anchor = tooltipLeft ? 'end' : 'start'
              const ty = Math.max(PAD_Y + 10, hoveredPt.y - 4)
              return (
                <g>
                  <text x={tx} y={ty - 8} textAnchor={anchor}
                    fontSize="6.5" fontWeight="600" fill="#666">
                    {hoveredSale.price}{currency}
                  </text>
                  <text x={tx} y={ty - 0.5} textAnchor={anchor}
                    fontSize="5.5" fill="#ccc">
                    {fmtDate(hoveredSale.date)}
                  </text>
                </g>
              )
            })()}

            {/* Point final discret (repos) */}
            {hovered === null && (
              <circle cx={pts[pts.length - 1].x} cy={pts[pts.length - 1].y} r="2.5" fill={accent} />
            )}
          </svg>
        </div>

        {/* Valeurs */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 72, textAlign: 'right' }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', marginBottom: 2 }}>
              {hoveredSale ? fmtDate(hoveredSale.date) : 'Actuel'}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: `rgb(${ar},${ag},${ab})`, lineHeight: 1, transition: '0.1s' }}>
              {hoveredSale ? hoveredSale.price : current}{currency}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase' }}>Min</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#555' }}>{min}{currency}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: '#bbb', textTransform: 'uppercase' }}>Max</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#555' }}>{max}{currency}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
