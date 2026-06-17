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
  cardValues?: Map<string, number>
  isOwner?: boolean
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
    img.onerror = () => {
      const img2 = new Image()
      img2.onload = () => resolve(img2)
      img2.onerror = () => { const fb = new Image(); fb.onload = () => resolve(fb); fb.src = PLACEHOLDER }
      img2.src = src
    }
    img.src = src
  })
}

async function loadImgs(srcs: string[], limit = 20): Promise<HTMLImageElement[]> {
  const out: HTMLImageElement[] = new Array(srcs.length)
  let i = 0
  async function worker() {
    while (i < srcs.length) { const idx = i++; out[idx] = await loadImg(srcs[idx]) }
  }
  await Promise.all(Array.from({ length: Math.min(limit, srcs.length) }, worker))
  return out
}

// Trouve le nb de colonnes qui maximise la taille des cartes tout en remplissant la hauteur.
// Les solutions width-constrained (hauteur non remplie) sont pénalisées par leur taux de remplissage.
function bestCols(n: number, availW: number, availH: number, textBelow: boolean): number {
  let bestC = 1, bestScore = 0
  for (let c = 1; c <= n; c++) {
    const r = Math.ceil(n / c)
    const cardWest = (availW - GAP * (c - 1)) / c
    const nameH = textBelow ? Math.min(NAME_AREA, Math.max(20, Math.round(cardWest * 0.45))) : 0
    const cardHfromH = (availH - GAP * (r - 1) - nameH * r) / r
    if (cardHfromH <= 0) continue
    const cardW = Math.min(cardWest, cardHfromH / CARD_RATIO)
    const cardH = cardW * CARD_RATIO
    const gridH = r * (cardH + nameH) + GAP * (r - 1)
    // Solutions qui remplissent la hauteur scorent plein ; les autres sont pénalisées
    const fillRatio = Math.min(1, gridH / availH)
    const score = cardHfromH / CARD_RATIO <= cardWest ? cardW : cardW * fillRatio
    if (score > bestScore) { bestScore = score; bestC = c }
  }
  return bestC
}

let fontPromise: Promise<void> | null = null
async function loadFont() {
  if (!fontPromise) fontPromise = (async () => {
    try {
      const f = new FontFace('Inter', "url(https://fonts.gstatic.com/s/inter/v13/UcCO3FwrK3iLTeHuS_fvQtMwCp50KnMw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.woff2)")
      await f.load(); document.fonts.add(f)
    } catch {}
  })()
  return fontPromise
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
  // nameH proportionnel à la largeur de carte (même formule que bestCols)
  const cardWfromW = (availW - GAP * (cols - 1)) / cols
  const nameH = hasBelow ? Math.min(NAME_AREA, Math.max(20, Math.round(cardWfromW * 0.45))) : 0
  // Taille des cartes : contrainte la plus restrictive entre largeur et hauteur
  const cardHfromH = (availH - GAP * (rows - 1) - nameH * rows) / rows
  const cardW = Math.floor(Math.min(cardWfromW, cardHfromH / CARD_RATIO))
  const cardH = Math.floor(cardW * CARD_RATIO)
  // Grille centrée dans les deux dimensions
  const gridW = cols * cardW + GAP * (cols - 1)
  const gridH = rows * (cardH + nameH) + GAP * (rows - 1)
  const gridX = PAD + Math.round((availW - gridW) / 2)
  const gridY = HEADER_H + PAD + Math.round((availH - gridH) / 2)
  const vGap = GAP

  // Fond
  ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h)

  // Fond texturé : grille de points subtils
  if (true) {
    const dotColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'
    const spacing = 18
    ctx.fillStyle = dotColor
    for (let dy = spacing; dy < h; dy += spacing)
      for (let dx = spacing; dx < w; dx += spacing)
        ctx.fillRect(dx, dy, 1.5, 1.5)
  }

  // Header gradient
  const grad = ctx.createLinearGradient(0, 0, w, HEADER_H)
  const accentDark = accent + 'cc' // version plus sombre via opacité
  grad.addColorStop(0, accent)
  grad.addColorStop(1, accentDark)
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, HEADER_H)
  // Légère ligne de séparation en bas du header
  ctx.fillStyle = 'rgba(0,0,0,0.15)'; ctx.fillRect(0, HEADER_H - 2, w, 2)

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
  ctx.fillText(profileName, tx, avY - HEADER_H * 0.12)

  // Stats RC / AUTO / PATCH
  const rcCount = cards.filter(c => c.rc).length
  const autoCount = cards.filter(c => c.auto).length
  const patchCount = cards.filter(c => c.patch).length
  const numCount = cards.filter(c => c.num).length
  const statParts = [
    `${cards.length} carte${cards.length > 1 ? 's' : ''}`,
    rcCount ? `${rcCount} RC` : '',
    autoCount ? `${autoCount} AUTO` : '',
    patchCount ? `${patchCount} PATCH` : '',
    numCount ? `${numCount} #NUM` : '',
  ].filter(Boolean).join(' · ')
  ctx.fillStyle = 'rgba(255,255,255,0.72)'; ctx.font = `400 ${Math.round(HEADER_H * 0.155)}px ${FONT}`
  ctx.fillText(statParts, tx, avY + HEADER_H * 0.16)

  ctx.textAlign = 'right'; ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.font = `400 ${Math.round(HEADER_H * 0.14)}px ${FONT}`
  ctx.fillText(new Date().toLocaleDateString(lang === 'fr' ? 'fr-FR' : 'en-US'), w - PAD, avY)
  ctx.textAlign = 'left'

  const images = await loadImgs(cards.map(c => c.f))

  // Tailles de texte proportionnelles à la carte, plafonnées
  const tagH   = Math.min(14, Math.max(9,  Math.round(cardW * 0.075)))
  const tagFont = Math.round(tagH * 0.7)
  const nameFs = Math.min(13, Math.max(8,  Math.round(cardW * 0.085)))
  const varFs  = Math.min(11, Math.max(7,  Math.round(cardW * 0.072)))
  const infoFs = Math.min(10, Math.max(6,  Math.round(cardW * 0.062)))

  const lastRowCount = cards.length % cols || cols
  const lastRowOffset = lastRowCount < cols ? ((cols - lastRowCount) * (cardW + GAP)) / 2 : 0

  cards.forEach((card, i) => {
    const col = i % cols, row = Math.floor(i / cols)
    const isLastRow = row === rows - 1
    const x = Math.round(gridX + col * (cardW + GAP) + (isLastRow ? lastRowOffset : 0))
    const y = Math.round(gridY + row * (cardH + nameH + vGap))

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

  return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(), 'image/jpeg', 0.95))
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
export default function GalerieExport({ cards, profileName, avatarUrl, accent, lang, cardValues = new Map(), isOwner = false }: Props) {
  const [open, setOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [tableWithPhotos, setTableWithPhotos] = useState(false)

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

  // ── Export CSV ─────────────────────────────────────────────────────────────
  const exportCSV = () => {
    const hasValues = filtered.some(c => cardValues.has(c.f))
    const headers = ['Joueur','Équipe','Année','Collection','Variation','Numérotation','Grade','RC','Auto','Patch', ...(hasValues ? ['Valeur (€)'] : [])]
    const rows = filtered.map(c => [
      c.n, c.t, c.y, c.s, c.v, c.num, c.g,
      c.rc ? 'Oui' : 'Non',
      c.auto ? 'Oui' : 'Non',
      c.patch ? 'Oui' : 'Non',
      ...(hasValues ? [cardValues.has(c.f) ? String(cardValues.get(c.f)) : ''] : []),
    ])
    const csv = '﻿' + [headers, ...rows]
      .map(r => r.map(cell => `"${(cell || '').replace(/"/g, '""')}"`).join(','))
      .join('\r\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `${profileName.replace(/\s+/g, '_')}_collection.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  // ── Export PDF tableau (jsPDF, téléchargement direct) ─────────────────────
  const [exportingPdf, setExportingPdf] = useState(false)

  const exportPdfTable = async (withPhotos: boolean) => {
    if (!filtered.length) return
    setExportingPdf(true)
    try {
      const { default: jsPDF } = await import('jspdf')

      // A4 paysage : 297 × 210 mm (plus large = plus de place par colonne)
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
      const PW = 297, PH = 210
      const ML = 10, MR = 10

      const hasPdfValues = filtered.some(c => cardValues.has(c.f))
      const totalValue = hasPdfValues
        ? filtered.reduce((s, c) => s + (cardValues.get(c.f) ?? 0), 0)
        : 0

      // Colonnes (mm)
      type Col = { header: string; key: keyof Card | '_photo' | '_valeur'; w: number; align?: 'center' | 'right' }
      const cols: Col[] = [
        ...(withPhotos ? [{ header: '', key: '_photo' as const, w: 22 }] : []),
        { header: 'Joueur',     key: 'n',     w: 42 },
        { header: 'Équipe',    key: 't',     w: 28 },
        { header: 'Année',     key: 'y',     w: 16 },
        { header: 'Collection', key: 's',    w: 48 },
        { header: 'Variation',  key: 'v',    w: 44 },
        { header: 'Num.',       key: 'num',  w: 18 },
        { header: 'Grade',      key: 'g',    w: 16 },
        { header: 'RC',         key: 'rc',   w: 9,  align: 'center' },
        { header: 'Auto',       key: 'auto', w: 9,  align: 'center' },
        { header: 'Patch',      key: 'patch',w: 9,  align: 'center' },
        ...(hasPdfValues ? [{ header: 'Valeur €', key: '_valeur' as const, w: 20, align: 'right' as const }] : []),
      ]
      const usableW = PW - ML - MR
      // Étirer la dernière colonne texte pour remplir (ou réduire si débordement)
      let totalW = cols.reduce((s, c) => s + c.w, 0)
      if (totalW > usableW) {
        const scale = usableW / totalW
        cols.forEach(c => { c.w = Math.floor(c.w * scale) })
        totalW = cols.reduce((s, c) => s + c.w, 0)
      }
      cols[cols.length - 1].w += usableW - totalW

      // Charger les images si besoin (recto + verso)
      let cardImgs: (HTMLImageElement | null)[] = []
      let cardImgsVerso: (HTMLImageElement | null)[] = []
      if (withPhotos) {
        ;[cardImgs, cardImgsVerso] = await Promise.all([
          loadImgs(filtered.map(c => c.f)),
          loadImgs(filtered.map(c => c.b).filter(Boolean)),
        ])
      }

      const toDataUrl = (img: HTMLImageElement, w = 60, h = 84): string => {
        const cv = document.createElement('canvas'); cv.width = w; cv.height = h
        cv.getContext('2d')!.drawImage(img, 0, 0, w, h)
        return cv.toDataURL('image/jpeg', 0.8)
      }

      const FONT     = 'helvetica'
      const FS       = 7       // font-size pt
      const LINE_H   = 3.8    // mm entre lignes de texte
      const ROW_PAD  = 1.6    // mm padding haut/bas dans chaque ligne
      const COL_H    = 7      // hauteur entête colonnes
      const HEADER_H = 14

      // Pré-calcul des lignes wrappées et hauteurs de ligne
      doc.setFont(FONT, 'normal'); doc.setFontSize(FS)
      type RowMeta = { wrapped: string[][]; h: number }
      const SKIP = new Set(['_photo', '_valeur', 'rc', 'auto', 'patch'])
      const rowMeta: RowMeta[] = filtered.map(card => {
        const wrapped = cols.map(col => {
          if (SKIP.has(col.key)) return []
          const raw = card[col.key as keyof Card]
          const txt = typeof raw === 'boolean' ? '' : (raw || '')
          return txt ? doc.splitTextToSize(txt, col.w - 3) as string[] : []
        })
        const maxLines = Math.max(1, ...wrapped.map(l => l.length))
        const h = withPhotos
          ? Math.max(18, maxLines * LINE_H + ROW_PAD * 2)
          : maxLines * LINE_H + ROW_PAD * 2
        return { wrapped, h }
      })

      let pageNum = 0, y = 0

      const newPage = () => {
        if (pageNum > 0) doc.addPage()
        pageNum++; y = 8

        if (pageNum === 1) {
          doc.setFont(FONT, 'bold'); doc.setFontSize(13); doc.setTextColor(20, 20, 20)
          doc.text(`${profileName} — Collection (${filtered.length} carte${filtered.length > 1 ? 's' : ''})`, ML, y + 5)
          doc.setFont(FONT, 'normal'); doc.setFontSize(7); doc.setTextColor(150)
          const sub = [`Exporté le ${new Date().toLocaleDateString('fr-FR')} · memorabilius.fr`,
            hasPdfValues ? `Valeur totale : ${totalValue.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €` : '']
            .filter(Boolean).join('   ·   ')
          doc.text(sub, ML, y + 10)
          y += HEADER_H
        }

        // En-tête colonnes
        doc.setFillColor(0, 61, 166)
        doc.rect(ML, y, usableW, COL_H, 'F')
        doc.setFont(FONT, 'bold'); doc.setFontSize(7); doc.setTextColor(255, 255, 255)
        let cx = ML
        cols.forEach(col => {
          if (col.header) {
            const tx = col.align === 'center' ? cx + col.w / 2 : col.align === 'right' ? cx + col.w - 1.5 : cx + 1.5
            doc.text(col.header, tx, y + COL_H / 2 + 2.2, { align: col.align ?? 'left' })
          }
          cx += col.w
        })
        y += COL_H
      }

      newPage()
      doc.setFont(FONT, 'normal'); doc.setFontSize(FS)

      filtered.forEach((card, i) => {
        const { wrapped, h: rowH } = rowMeta[i]
        if (y + rowH > PH - 8) newPage()

        // Fond alterné
        if (i % 2 === 1) { doc.setFillColor(247, 249, 252); doc.rect(ML, y, usableW, rowH, 'F') }

        doc.setFont(FONT, 'normal'); doc.setTextColor(30, 30, 30)
        const midY = y + rowH / 2 + 2      // centre vertical (cellules courtes)
        const topY = y + ROW_PAD + FS * 0.35  // baseline 1ère ligne (cellules multi-lignes)
        let cx = ML

        cols.forEach((col, ci) => {
          if (col.key === '_photo') {
            const imgH = rowH - 1.5
            const imgW = imgH * (2.5 / 3.5)
            const recto = cardImgs[i]
            if (recto) {
              try { doc.addImage(toDataUrl(recto), 'JPEG', cx + 0.5, y + 0.8, imgW, imgH) } catch {}
            }
            const verso = cardImgsVerso[i]
            if (verso) {
              try { doc.addImage(toDataUrl(verso), 'JPEG', cx + imgW + 1.5, y + 0.8, imgW, imgH) } catch {}
            }
          } else if (col.key === 'rc' || col.key === 'auto' || col.key === 'patch') {
            if (card[col.key as 'rc' | 'auto' | 'patch']) {
              const [r, g, b] = col.key === 'rc' ? [180, 80, 10] : col.key === 'auto' ? [30, 130, 30] : [20, 90, 190]
              doc.setTextColor(r, g, b); doc.setFont(FONT, 'bold')
              doc.text('✓', cx + col.w / 2, midY, { align: 'center' })
              doc.setFont(FONT, 'normal'); doc.setTextColor(30, 30, 30)
            }
          } else if (col.key === '_valeur') {
            const v = cardValues.get(card.f)
            if (v !== undefined) {
              doc.setFont(FONT, 'bold')
              doc.text(v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €',
                cx + col.w - 1.5, midY, { align: 'right' })
              doc.setFont(FONT, 'normal')
            }
          } else {
            // Texte avec retour à la ligne — aucune troncature
            const lines = wrapped[ci]
            lines.forEach((line, li) => {
              doc.text(line, cx + 1.5, topY + li * LINE_H)
            })
          }
          cx += col.w
        })

        doc.setDrawColor(220, 220, 220); doc.setLineWidth(0.2)
        doc.line(ML, y + rowH, ML + usableW, y + rowH)
        y += rowH
      })

      // Numéros de page
      const totalPages = doc.getNumberOfPages()
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p)
        doc.setFont(FONT, 'normal'); doc.setFontSize(7); doc.setTextColor(180)
        doc.text(`${p} / ${totalPages}`, PW - MR, PH - 5, { align: 'right' })
      }

      doc.save(`${profileName.replace(/\s+/g, '_')}_collection.pdf`)
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExport = async () => {
    if (!filtered.length) return
    setExporting(true)
    try {
      const blob = await generate(filtered, profileName, avatarUrl, accent, lang, opts)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = `${profileName.replace(/\s+/g, '_')}_${opts.format}.jpg`; a.click()
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

          {/* CTA galerie image */}
          <button onClick={handleExport} disabled={exporting || filtered.length === 0}
            style={{ background: exporting || !filtered.length ? '#ccc' : '#003DA6', color: '#fff', border: 'none', borderRadius: 10, padding: '14px', fontWeight: 800, fontSize: 15, cursor: exporting || !filtered.length ? 'not-allowed' : 'pointer', width: '100%', transition: '0.2s' }}>
            {exporting ? (lang === 'fr' ? '⏳ Génération...' : '⏳ Generating...') : `⬇️ ${lang === 'fr' ? `Télécharger image (${filtered.length} cartes)` : `Download image (${filtered.length} cards)`}`}
          </button>

          {isOwner && <div style={{ height: 1, background: '#f0f0f0' }} />}

          {/* Export tableur — visible uniquement par le propriétaire */}
          {isOwner && <div>
            <span style={SL}>{lang === 'fr' ? 'Export tableur / liste' : 'Spreadsheet / list export'}</span>
            <Toggle on={tableWithPhotos} onChange={setTableWithPhotos}
              label={lang === 'fr' ? 'Inclure les photos (PDF uniquement)' : 'Include photos (PDF only)'} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
              <button onClick={exportCSV} disabled={!filtered.length}
                style={{ padding: '12px 8px', border: '2px solid #ddd', borderRadius: 10, background: '#fafafa', color: '#333', fontWeight: 700, fontSize: 13, cursor: filtered.length ? 'pointer' : 'not-allowed', transition: '0.15s', opacity: filtered.length ? 1 : 0.5 }}>
                📊 CSV / Excel
              </button>
              <button onClick={() => exportPdfTable(tableWithPhotos)} disabled={!filtered.length || exportingPdf}
                style={{ padding: '12px 8px', border: '2px solid #003DA6', borderRadius: 10, background: exportingPdf ? '#e8eeff' : '#f0f4ff', color: '#003DA6', fontWeight: 700, fontSize: 13, cursor: filtered.length && !exportingPdf ? 'pointer' : 'not-allowed', transition: '0.15s', opacity: filtered.length ? 1 : 0.5 }}>
                {exportingPdf ? '⏳ PDF…' : '⬇️ PDF tableau'}
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#aaa', marginTop: 8, lineHeight: 1.5 }}>
              {lang === 'fr'
                ? 'CSV s\'ouvre dans Excel / Google Sheets · PDF se télécharge directement'
                : 'CSV opens in Excel / Google Sheets · PDF downloads directly'}
            </p>
          </div>}
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
