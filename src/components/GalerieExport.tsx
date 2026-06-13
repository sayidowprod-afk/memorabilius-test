'use client'
import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'

interface Card {
  f: string; n: string; v: string; y: string; br: string; s: string; t: string
  rc: boolean; auto: boolean; patch: boolean; num: string; g: string
}
interface Props {
  cards: Card[]
  profileName: string
  avatarUrl: string
  accent: string
  lang: string
}

const FORMATS = {
  a4:     { label: 'A4',    w: 1240, h: 1754 },
  a3:     { label: 'A3',    w: 1754, h: 2480 },
  square: { label: 'Carré', w: 1080, h: 1080 },
  story:  { label: 'Story', w: 1080, h: 1920 },
} as const
type FormatKey = keyof typeof FORMATS

interface Options {
  format: FormatKey
  bgType: 'white' | 'black' | 'custom'
  bgColor: string
  showName: boolean
  showInfo: boolean
  showVariation: boolean
  showBadges: boolean
}

const CARD_RATIO = 3.5 / 2.5
const HEADER_H = 90
const FOOTER_H = 34
const PAD = 22
const GAP = 10
const NAME_AREA = 62  // badges + nom + variation + info
const SCALE = 2       // résolution 2× pour la qualité

const PLACEHOLDER = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="420"><rect width="300" height="420" fill="%23ddd"/><text x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23aaa" font-size="40">?</text></svg>'

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => { const fb = new Image(); fb.onload = () => resolve(fb); fb.src = PLACEHOLDER }
    img.src = src + (src.includes('?') ? '&' : '?') + '_e=1'
  })
}

function bestCols(n: number, availW: number, availH: number, textBelow: boolean): number {
  const nameH = textBelow ? NAME_AREA : 0
  let bestC = 1, bestCardW = 0
  for (let c = 1; c <= Math.min(n, 12); c++) {
    const r = Math.ceil(n / c)
    const cardWfromW = (availW - GAP * (c - 1)) / c
    const cardHfromH = (availH - GAP * (r - 1) - nameH * r) / r
    if (cardHfromH <= 0) continue // pas assez de hauteur
    const cardW = Math.min(cardWfromW, cardHfromH / CARD_RATIO)
    if (cardW > bestCardW) { bestCardW = cardW; bestC = c }
  }
  return bestC
}

async function loadFont() {
  try {
    const f = new FontFace('Inter', "url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2)")
    await f.load()
    document.fonts.add(f)
  } catch {}
}

function trunc(ctx: CanvasRenderingContext2D, text: string, maxW: number): string {
  if (ctx.measureText(text).width <= maxW) return text
  let t = text
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1)
  return t + '…'
}

async function generate(cards: Card[], profileName: string, avatarUrl: string, accent: string, lang: string, opts: Options): Promise<Blob> {
  await loadFont()

  const { w, h } = FORMATS[opts.format]
  const canvas = document.createElement('canvas')
  // Résolution 2× pour la qualité
  canvas.width = w * SCALE; canvas.height = h * SCALE
  const ctx = canvas.getContext('2d')!
  ctx.scale(SCALE, SCALE)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  const bg = opts.bgType === 'white' ? '#ffffff' : opts.bgType === 'black' ? '#111111' : opts.bgColor
  const isDark = opts.bgType === 'black' || (opts.bgType === 'custom' && parseInt(opts.bgColor.replace('#', ''), 16) < 0x999999 * 3)
  const textColor = isDark ? '#ffffff' : '#111111'
  const subColor = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.38)'
  const FONT = 'Inter, Arial, sans-serif'

  const hasText = opts.showName || opts.showInfo || opts.showVariation
  const hasBelow = hasText || opts.showBadges
  const availW = w - PAD * 2
  const availH = h - HEADER_H - FOOTER_H - PAD * 2
  const cols = bestCols(cards.length, availW, availH, hasBelow)
  const rows = Math.ceil(cards.length / cols)
  const nameH = hasBelow ? NAME_AREA : 0
  const cardWfromW = (availW - GAP * (cols - 1)) / cols
  const cardHfromH = (availH - GAP * (rows - 1) - nameH * rows) / rows
  const cardW = Math.floor(Math.min(cardWfromW, cardHfromH / CARD_RATIO))
  const cardH = Math.floor(cardW * CARD_RATIO)

  const gridW = cols * cardW + GAP * (cols - 1)
  const gridH = rows * (cardH + nameH) + GAP * (rows - 1)
  const gridX = PAD + (availW - gridW) / 2
  const gridY = HEADER_H + PAD + (availH - gridH) / 2

  // Fond
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)

  // Header
  ctx.fillStyle = accent; ctx.fillRect(0, 0, w, HEADER_H)
  const avS = Math.round(HEADER_H * 0.62)
  const avX = PAD + avS / 2, avY = HEADER_H / 2
  try {
    const av = await loadImg(avatarUrl)
    ctx.save(); ctx.beginPath(); ctx.arc(avX, avY, avS / 2, 0, Math.PI * 2); ctx.clip()
    ctx.drawImage(av, PAD, avY - avS / 2, avS, avS); ctx.restore()
  } catch {}
  const tx = PAD + avS + 12
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#fff'; ctx.font = `700 ${Math.round(HEADER_H * 0.27)}px ${FONT}`
  ctx.fillText(profileName, tx, avY - HEADER_H * 0.1)
  ctx.fillStyle = 'rgba(255,255,255,0.68)'; ctx.font = `400 ${Math.round(HEADER_H * 0.16)}px ${FONT}`
  ctx.fillText(`${cards.length} carte${cards.length > 1 ? 's' : ''} · memorabilius.fr`, tx, avY + HEADER_H * 0.18)
  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `400 ${Math.round(HEADER_H * 0.14)}px ${FONT}`
  ctx.fillText(new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'), w - PAD, avY)
  ctx.textAlign = 'left'

  const images = await Promise.all(cards.map(c => loadImg(c.f)))

  // Tailles de texte proportionnelles à la carte, plafonnées
  const tagH   = Math.min(14, Math.max(9,  Math.round(cardW * 0.075)))
  const tagFont = Math.round(tagH * 0.7)
  const nameFs = Math.min(13, Math.max(8,  Math.round(cardW * 0.085)))
  const varFs  = Math.min(11, Math.max(7,  Math.round(cardW * 0.072)))
  const infoFs = Math.min(10, Math.max(6,  Math.round(cardW * 0.062)))

  cards.forEach((card, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const x = Math.round(gridX + col * (cardW + GAP))
    const y = Math.round(gridY + row * (cardH + nameH + GAP))

    // Image carte
    ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 2
    ctx.drawImage(images[i], x, y, cardW, cardH)
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

    if (!hasBelow) return

    // Zone sous la carte
    let lineY = y + cardH + 4
    ctx.textBaseline = 'top'

    // Badges (sous la carte, comme la galerie)
    if (opts.showBadges) {
      const tags: { label: string; color: string }[] = []
      if (card.rc)   tags.push({ label: 'RC',    color: '#e67e22' })
      if (card.auto) tags.push({ label: 'AUTO',  color: '#2e7d32' })
      if (card.num)  tags.push({ label: card.num, color: '#7b1fa2' })
      if (card.patch) tags.push({ label: 'PATCH', color: '#1976d2' })
      if (card.g && card.g !== 'Raw') tags.push({ label: card.g, color: accent })
      if (tags.length) {
        ctx.font = `700 ${tagFont}px ${FONT}`
        ctx.textBaseline = 'middle'
        let tagX = x + 2
        tags.slice(0, 5).forEach(tag => {
          const tw = ctx.measureText(tag.label).width + tagFont + 2
          ctx.fillStyle = tag.color
          ctx.beginPath(); ctx.roundRect(tagX, lineY, tw, tagH, 3); ctx.fill()
          ctx.fillStyle = '#fff'
          ctx.fillText(tag.label, tagX + (tagFont + 2) / 2, lineY + tagH / 2)
          tagX += tw + 3
        })
        ctx.textBaseline = 'top'
        lineY += tagH + 4
      }
    }

    if (opts.showName && card.n) {
      ctx.fillStyle = textColor; ctx.font = `700 ${nameFs}px ${FONT}`
      ctx.fillText(trunc(ctx, card.n, cardW - 4), x + 2, lineY)
      lineY += nameFs + 2
    }
    if (opts.showVariation && card.v) {
      ctx.fillStyle = accent; ctx.font = `400 ${varFs}px ${FONT}`
      ctx.fillText(trunc(ctx, card.v, cardW - 4), x + 2, lineY)
      lineY += varFs + 2
    }
    if (opts.showInfo && (card.y || card.br)) {
      ctx.fillStyle = subColor; ctx.font = `400 ${infoFs}px ${FONT}`
      ctx.fillText(trunc(ctx, [card.y, card.br].filter(Boolean).join(' · '), cardW - 4), x + 2, lineY)
    }
  })

  // Footer
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  ctx.fillRect(0, h - FOOTER_H, w, FOOTER_H)
  ctx.fillStyle = isDark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.22)'
  ctx.font = `400 ${Math.round(FOOTER_H * 0.38)}px ${FONT}`
  ctx.textBaseline = 'middle'; ctx.textAlign = 'center'
  ctx.fillText('memorabilius.fr', w / 2, h - FOOTER_H / 2); ctx.textAlign = 'left'

  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(), 'image/png'))
}

// ─── Toggle ────────────────────────────────────────────────────────────────────
function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#333' }}>
      <div onClick={() => onChange(!on)} style={{ width: 36, height: 20, borderRadius: 10, background: on ? '#003DA6' : '#ddd', position: 'relative', transition: '0.2s', flexShrink: 0 }}>
        <div style={{ position: 'absolute', top: 2, left: on ? 18 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: '0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
      </div>
      {label}
    </label>
  )
}

const SL: React.CSSProperties = { fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#888', marginBottom: 8, display: 'block' }

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function GalerieExport({ cards, profileName, avatarUrl, accent, lang }: Props) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [mounted, setMounted] = useState(false)

  const [opts, setOpts] = useState<Options>({ format: 'a4', bgType: 'white', bgColor: '#1a1a2e', showName: true, showInfo: true, showVariation: true, showBadges: true })

  // Filtres internes au popup
  const [search, setSearch] = useState('')
  const [fTeam, setFTeam] = useState('')
  const [fBrand, setFBrand] = useState('')
  const [fYear, setFYear] = useState('')
  const [fRc, setFRc] = useState(false)
  const [fAuto, setFAuto] = useState(false)
  const [fPatch, setFPatch] = useState(false)
  const [fNum, setFNum] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const teams = useMemo(() => [...new Set(cards.map(c => c.t).filter(Boolean))].sort(), [cards])
  const brands = useMemo(() => [...new Set(cards.map(c => c.s).filter(Boolean))].sort(), [cards])
  const years = useMemo(() => [...new Set(cards.map(c => c.y).filter(Boolean))].sort(), [cards])

  const filtered = useMemo(() => cards.filter(c =>
    c.n.toLowerCase().includes(search.toLowerCase()) &&
    (!fTeam || c.t === fTeam) &&
    (!fBrand || c.s === fBrand) &&
    (!fYear || c.y === fYear) &&
    (!fRc || c.rc) && (!fAuto || c.auto) && (!fPatch || c.patch) && (!fNum || c.num !== '')
  ), [cards, search, fTeam, fBrand, fYear, fRc, fAuto, fPatch, fNum])

  const set = <K extends keyof Options>(k: K, v: Options[K]) => setOpts(o => ({ ...o, [k]: v }))

  const handleExport = async () => {
    if (!filtered.length) return
    setExporting(true)
    try {
      const blob = await generate(filtered, profileName, avatarUrl, accent, lang, opts)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${profileName.replace(/\s+/g, '_')}_${opts.format}.png`; a.click()
      URL.revokeObjectURL(url)
    } finally { setExporting(false) }
  }

  const activeFilters = [fRc, fAuto, fPatch, fNum].filter(Boolean).length + [search, fTeam, fBrand, fYear].filter(Boolean).length

  const modal = open && mounted ? createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => { if (e.target === e.currentTarget) setOpen(false) }}>
      <div style={{ background: '#fff', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <span style={{ fontWeight: 800, fontSize: 16 }}>📸 {lang === 'fr' ? 'Exporter la galerie' : 'Export gallery'}</span>
          <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#bbb', lineHeight: 1 }}>×</button>
        </div>

        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Filtres */}
          <div>
            <span style={SL}>{lang === 'fr' ? `Sélection de cartes${activeFilters ? ` · ${activeFilters} filtre${activeFilters > 1 ? 's' : ''}` : ''}` : `Card selection${activeFilters ? ` · ${activeFilters} filter${activeFilters > 1 ? 's' : ''}` : ''}`}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder={lang === 'fr' ? 'Joueur...' : 'Player...'}
                style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 13, outline: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                <select value={fTeam} onChange={e => setFTeam(e.target.value)} style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, outline: 'none' }}>
                  <option value="">{lang === 'fr' ? 'Équipe' : 'Team'}</option>
                  {teams.map(t => <option key={t}>{t}</option>)}
                </select>
                <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, outline: 'none' }}>
                  <option value="">{lang === 'fr' ? 'Collection' : 'Brand'}</option>
                  {brands.map(b => <option key={b}>{b}</option>)}
                </select>
                <select value={fYear} onChange={e => setFYear(e.target.value)} style={{ padding: '7px 8px', borderRadius: 8, border: '1px solid #e0e0e0', fontSize: 12, outline: 'none' }}>
                  <option value="">{lang === 'fr' ? 'Année' : 'Year'}</option>
                  {years.map(y => <option key={y}>{y}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
                {([['RC', fRc, setFRc, '#e67e22'], ['AUTO', fAuto, setFAuto, '#2e7d32'], ['PATCH', fPatch, setFPatch, '#1976d2'], ['# NUM', fNum, setFNum, '#7b1fa2']] as const).map(([label, val, setter, color]) => (
                  <button key={label} onClick={() => (setter as any)(!val)}
                    style={{ padding: '7px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', background: val ? color : '#f0f0f0', color: val ? 'white' : '#555', transition: '0.15s' }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 12, color: '#999', margin: '8px 0 0', textAlign: 'center' }}>
              {filtered.length} / {cards.length} carte{filtered.length > 1 ? 's' : ''} {lang === 'fr' ? 'sélectionnée' : 'selected'}{filtered.length > 1 ? 's' : ''}
            </p>
          </div>

          <div style={{ height: 1, background: '#f0f0f0' }} />

          {/* Format */}
          <div>
            <span style={SL}>Format</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
              {(Object.entries(FORMATS) as [FormatKey, { label: string }][]).map(([key, f]) => (
                <button key={key} onClick={() => set('format', key)}
                  style={{ padding: '8px 4px', border: `2px solid ${opts.format === key ? '#003DA6' : '#eee'}`, borderRadius: 8, background: opts.format === key ? '#f0f4ff' : '#fafafa', fontWeight: 700, fontSize: 12, color: opts.format === key ? '#003DA6' : '#555', cursor: 'pointer', transition: '0.15s' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Fond */}
          <div>
            <span style={SL}>{lang === 'fr' ? 'Fond' : 'Background'}</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {(['white', 'black'] as const).map(t => (
                <button key={t} onClick={() => set('bgType', t)}
                  style={{ flex: 1, padding: '8px', border: `2px solid ${opts.bgType === t ? '#003DA6' : '#eee'}`, borderRadius: 8, background: t === 'white' ? '#fff' : '#111', color: t === 'white' ? '#333' : '#fff', fontWeight: 700, fontSize: 12, cursor: 'pointer', transition: '0.15s' }}>
                  {t === 'white' ? '⬜ Blanc' : '⬛ Noir'}
                </button>
              ))}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button onClick={() => set('bgType', 'custom')}
                  style={{ width: 42, height: 38, border: `2px solid ${opts.bgType === 'custom' ? '#003DA6' : '#eee'}`, borderRadius: 8, background: opts.bgColor, cursor: 'pointer' }}
                  title="Couleur personnalisée">🎨</button>
                {opts.bgType === 'custom' && (
                  <input type="color" value={opts.bgColor} onChange={e => set('bgColor', e.target.value)}
                    style={{ position: 'absolute', bottom: -2, right: -2, width: 22, height: 22, border: 'none', cursor: 'pointer', borderRadius: 4, padding: 0 }} />
                )}
              </div>
            </div>
          </div>

          {/* Infos */}
          <div>
            <span style={SL}>{lang === 'fr' ? 'Informations à afficher' : 'Display options'}</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Toggle on={opts.showName} onChange={v => set('showName', v)} label={lang === 'fr' ? 'Nom du joueur' : 'Player name'} />
              <Toggle on={opts.showVariation} onChange={v => set('showVariation', v)} label={lang === 'fr' ? 'Variation / Parallèle' : 'Variation'} />
              <Toggle on={opts.showInfo} onChange={v => set('showInfo', v)} label={lang === 'fr' ? 'Année & Collection' : 'Year & Brand'} />
              <Toggle on={opts.showBadges} onChange={v => set('showBadges', v)} label="RC · AUTO · PATCH · Grade" />
            </div>
          </div>

          {/* CTA */}
          <button onClick={handleExport} disabled={exporting || filtered.length === 0}
            style={{ background: exporting || !filtered.length ? '#ccc' : '#003DA6', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontWeight: 800, fontSize: 15, cursor: exporting || !filtered.length ? 'not-allowed' : 'pointer', width: '100%', transition: '0.2s' }}>
            {exporting ? (lang === 'fr' ? '⏳ Génération...' : '⏳ Generating...') : `⬇️ ${lang === 'fr' ? `Télécharger (${filtered.length} cartes)` : `Download (${filtered.length} cards)`}`}
          </button>
        </div>
      </div>
    </div>,
    document.body
  ) : null

  return (
    <>
      <button onClick={() => setOpen(true)} disabled={!cards.length}
        style={{ background: '#f0f0f0', color: '#333', border: 'none', borderRadius: 8, padding: '10px 16px', fontWeight: 700, fontSize: 13, cursor: !cards.length ? 'not-allowed' : 'pointer', flex: '1 1 auto', textAlign: 'center', minWidth: 100 }}>
        📸 {lang === 'fr' ? 'Exporter' : 'Export'}
      </button>
      {modal}
    </>
  )
}
