'use client'
import { useEffect, useRef, useState } from 'react'

type Pt = { x: number; y: number }
type Status = 'detecting' | 'found' | 'notfound'

interface Props {
  src: string
  onResult: (blob: Blob) => void
  onFallback: () => void
  onClose: () => void
}

// ── Détection pure JS (sans dépendance) ───────────────────────────────────
// Tourne en <50ms sur une image 400px, sans bloquer l'UI

function toGray(d: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = d[i * 4] * 0.299 + d[i * 4 + 1] * 0.587 + d[i * 4 + 2] * 0.114
  return g
}

function gaussBlur(g: Float32Array, w: number, h: number): Float32Array {
  const k = [1, 4, 6, 4, 1]
  const out = new Float32Array(w * h)
  const tmp = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0
      for (let d = -2; d <= 2; d++) { const xx = x + d; if (xx >= 0 && xx < w) { s += g[y * w + xx] * k[d + 2]; n += k[d + 2] } }
      tmp[y * w + x] = s / n
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0
      for (let d = -2; d <= 2; d++) { const yy = y + d; if (yy >= 0 && yy < h) { s += tmp[yy * w + x] * k[d + 2]; n += k[d + 2] } }
      out[y * w + x] = s / n
    }
  return out
}

function canny(g: Float32Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let y = 1; y < h - 1; y++)
    for (let x = 1; x < w - 1; x++) {
      const gx = -g[(y-1)*w+x-1] + g[(y-1)*w+x+1] - 2*g[y*w+x-1] + 2*g[y*w+x+1] - g[(y+1)*w+x-1] + g[(y+1)*w+x+1]
      const gy = -g[(y-1)*w+x-1] - 2*g[(y-1)*w+x] - g[(y-1)*w+x+1] + g[(y+1)*w+x-1] + 2*g[(y+1)*w+x] + g[(y+1)*w+x+1]
      out[y * w + x] = Math.sqrt(gx * gx + gy * gy) > 30 ? 255 : 0
    }
  return out
}

function detectCorners(edges: Uint8Array, w: number, h: number): Pt[] | null {
  // Pour chaque quadrant, cherche le point le plus proche du coin de l'image
  // parmi les pixels de bord — heuristique robuste pour les cartes isolées
  const quads = [
    { cx: 0,   cy: 0   },  // TL
    { cx: w-1, cy: 0   },  // TR
    { cx: w-1, cy: h-1 },  // BR
    { cx: 0,   cy: h-1 },  // BL
  ]

  const result: Pt[] = []
  for (const { cx, cy } of quads) {
    let bestD = Infinity, bestPt: Pt | null = null
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        if (!edges[y * w + x]) continue
        const d = Math.hypot(x - cx, y - cy)
        if (d < bestD) { bestD = d; bestPt = { x, y } }
      }
    if (!bestPt) return null
    result.push(bestPt)
  }

  // Validation : les 4 coins doivent former un quad raisonnable
  const [tl, tr, br, bl] = result
  const areaApprox = Math.abs((tr.x-tl.x)*(bl.y-tl.y) - (bl.x-tl.x)*(tr.y-tl.y)) / 2
  if (areaApprox < w * h * 0.05) return null
  return result
}

async function detectCard(img: HTMLImageElement): Promise<Pt[] | null> {
  const MAX = 400
  const scale = Math.min(MAX / img.naturalWidth, MAX / img.naturalHeight, 1)
  const W = Math.round(img.naturalWidth * scale)
  const H = Math.round(img.naturalHeight * scale)

  const c = document.createElement('canvas')
  c.width = W; c.height = H
  c.getContext('2d')!.drawImage(img, 0, 0, W, H)
  const data = c.getContext('2d')!.getImageData(0, 0, W, H).data

  await new Promise(r => setTimeout(r, 0)) // yield
  const gray  = toGray(data, W, H)
  const blur  = gaussBlur(gray, W, H)
  const edges = canny(blur, W, H)

  const corners = detectCorners(edges, W, H)
  if (!corners) return null
  return corners.map(p => ({ x: p.x / scale, y: p.y / scale }))
}

// ── Perspective warp pure JS (homographie) ────────────────────────────────

function computeHomography(src: Pt[], dst: Pt[]): number[] {
  // Résolution du système linéaire 8x8 → matrice 3×3
  const A: number[][] = []
  const b: number[]   = []
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i]
    const { x: X, y: Y } = dst[i]
    A.push([x, y, 1, 0, 0, 0, -X*x, -X*y]); b.push(X)
    A.push([0, 0, 0, x, y, 1, -Y*x, -Y*y]); b.push(Y)
  }
  const h = gaussElim(A, b)
  return [...h, 1]
}

function gaussElim(A: number[][], b: number[]): number[] {
  const n = b.length
  for (let i = 0; i < n; i++) {
    let max = i
    for (let j = i + 1; j < n; j++) if (Math.abs(A[j][i]) > Math.abs(A[max][i])) max = j
    ;[A[i], A[max]] = [A[max], A[i]];[b[i], b[max]] = [b[max], b[i]]
    for (let j = i + 1; j < n; j++) {
      const f = A[j][i] / A[i][i]
      for (let k = i; k < n; k++) A[j][k] -= f * A[i][k]
      b[j] -= f * b[i]
    }
  }
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    x[i] = b[i]
    for (let j = i + 1; j < n; j++) x[i] -= A[i][j] * x[j]
    x[i] /= A[i][i]
  }
  return x
}

async function warpCard(img: HTMLImageElement, corners: Pt[]): Promise<Blob> {
  // Source limitée à 1200px pour éviter le crash mémoire
  const SRC_MAX = 1200
  const sScale  = Math.min(SRC_MAX / img.naturalWidth, SRC_MAX / img.naturalHeight, 1)
  const sW = Math.round(img.naturalWidth  * sScale)
  const sH = Math.round(img.naturalHeight * sScale)

  const srcC = document.createElement('canvas')
  srcC.width = sW; srcC.height = sH
  srcC.getContext('2d')!.drawImage(img, 0, 0, sW, sH)
  const srcData = srcC.getContext('2d')!.getImageData(0, 0, sW, sH)

  const OUT_W = 600, OUT_H = 840
  const scaledCorners = corners.map(p => ({ x: p.x * sScale, y: p.y * sScale }))

  // Homographie : dst → src (mapping inverse pour chaque pixel de sortie)
  const dstPts = [{ x:0,y:0 }, { x:OUT_W,y:0 }, { x:OUT_W,y:OUT_H }, { x:0,y:OUT_H }]
  const H = computeHomography(dstPts, scaledCorners)

  await new Promise(r => setTimeout(r, 0)) // yield avant le warp

  const outData = new Uint8ClampedArray(OUT_W * OUT_H * 4)
  const [h0,h1,h2,h3,h4,h5,h6,h7,h8] = H
  const srcD = srcData.data

  for (let oy = 0; oy < OUT_H; oy++) {
    for (let ox = 0; ox < OUT_W; ox++) {
      const w_ = h6*ox + h7*oy + h8
      const sx  = (h0*ox + h1*oy + h2) / w_
      const sy  = (h3*ox + h4*oy + h5) / w_
      const ix = Math.floor(sx), iy = Math.floor(sy)
      if (ix < 0 || ix >= sW - 1 || iy < 0 || iy >= sH - 1) continue
      const fx = sx - ix, fy = sy - iy
      const i00 = (iy * sW + ix) * 4
      const i10 = i00 + 4
      const i01 = i00 + sW * 4
      const i11 = i01 + 4
      const oi  = (oy * OUT_W + ox) * 4
      for (let c = 0; c < 3; c++) {
        outData[oi+c] = srcD[i00+c]*(1-fx)*(1-fy) + srcD[i10+c]*fx*(1-fy)
                      + srcD[i01+c]*(1-fx)*fy      + srcD[i11+c]*fx*fy
      }
      outData[oi+3] = 255
    }
    // yield toutes les 100 lignes pour ne pas bloquer l'UI
    if (oy % 100 === 99) await new Promise(r => setTimeout(r, 0))
  }

  const outC = document.createElement('canvas')
  outC.width = OUT_W; outC.height = OUT_H
  outC.getContext('2d')!.putImageData(new ImageData(outData, OUT_W, OUT_H), 0, 0)
  return new Promise(res => outC.toBlob(b => res(b!), 'image/jpeg', 0.88))
}

// ── Composant ────────────────────────────────────────────────────────────

const HANDLE_COLORS = ['#ff5252', '#ffeb3b', '#69f0ae', '#40c4ff']
const HANDLE_R = 18

export default function CardScanner({ src, onResult, onFallback, onClose }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const imgRef      = useRef<HTMLImageElement | null>(null)
  const scaleRef    = useRef(1)
  const [status, setStatus]     = useState<Status>('detecting')
  const [corners, setCorners]   = useState<Pt[]>([])
  const [dragging, setDragging] = useState<number | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    const img = new Image()
    img.onload = async () => {
      imgRef.current = img
      const canvas = canvasRef.current
      if (!canvas) return

      const maxW = Math.min(window.innerWidth - 32, 500)
      const maxH = Math.round(window.innerHeight * 0.56)
      const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
      scaleRef.current = scale
      canvas.width  = Math.round(img.naturalWidth  * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)

      // Détection en pur JS — non bloquante
      const naturalCorners = await detectCard(img)
      const display = naturalCorners
        ? naturalCorners.map(p => ({ x: p.x * scale, y: p.y * scale }))
        : defaultCorners(canvas)
      setCorners(display)
      setStatus(naturalCorners ? 'found' : 'notfound')
    }
    img.src = src
  }, [src])

  const defaultCorners = (canvas: HTMLCanvasElement): Pt[] => {
    const p = Math.round(Math.min(canvas.width, canvas.height) * 0.07)
    return [
      { x: p, y: p },
      { x: canvas.width - p, y: p },
      { x: canvas.width - p, y: canvas.height - p },
      { x: p, y: canvas.height - p },
    ]
  }

  // Dessin overlay
  useEffect(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || corners.length < 4) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    corners.forEach(c => ctx.lineTo(c.x, c.y))
    ctx.closePath()
    ctx.fillStyle   = 'rgba(0,229,255,0.10)'
    ctx.fill()
    ctx.strokeStyle = '#00e5ff'
    ctx.lineWidth   = 2.5
    ctx.stroke()

    corners.forEach((c, i) => {
      ctx.beginPath()
      ctx.arc(c.x, c.y, HANDLE_R, 0, Math.PI * 2)
      ctx.fillStyle   = HANDLE_COLORS[i]
      ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'
      ctx.lineWidth   = 2
      ctx.stroke()
    })
  }, [corners])

  const canvasPt = (e: React.MouseEvent | React.TouchEvent): Pt => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const sx = canvas.width  / rect.width
    const sy = canvas.height / rect.height
    const t  = 'touches' in e ? (e.touches[0] ?? (e as React.TouchEvent).changedTouches[0]) : (e as React.MouseEvent)
    return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }
  }

  const nearestCorner = (pos: Pt) => {
    let best = -1, bd = Infinity
    corners.forEach((c, i) => { const d = Math.hypot(c.x - pos.x, c.y - pos.y); if (d < bd) { bd = d; best = i } })
    return bd < HANDLE_R * 2.5 ? best : -1
  }

  const onDown = (e: React.MouseEvent | React.TouchEvent) => {
    const idx = nearestCorner(canvasPt(e))
    if (idx >= 0) { e.preventDefault(); setDragging(idx) }
  }
  const onMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (dragging === null) return
    e.preventDefault()
    const pos = canvasPt(e)
    const canvas = canvasRef.current!
    setCorners(prev => {
      const next = [...prev]
      next[dragging] = { x: Math.max(0, Math.min(canvas.width, pos.x)), y: Math.max(0, Math.min(canvas.height, pos.y)) }
      return next
    })
  }
  const onUp = () => setDragging(null)

  const applyWarp = async () => {
    const img = imgRef.current
    if (!img || corners.length < 4 || applying) return
    setApplying(true)
    const s = scaleRef.current
    const naturalCorners = corners.map(c => ({ x: c.x / s, y: c.y / s }))
    try {
      const blob = await warpCard(img, naturalCorners)
      onResult(blob)
    } catch {
      setApplying(false)
      onFallback()
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '16px 16px 24px' }}>
      <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, marginBottom: 10, textAlign: 'center', minHeight: 20 }}>
        {status === 'detecting' && 'Détection en cours…'}
        {status === 'found'     && 'Carte détectée — ajustez les coins si besoin'}
        {status === 'notfound'  && 'Non détectée — placez les coins sur la carte'}
        {applying               && 'Recadrage…'}
      </p>

      <canvas
        ref={canvasRef}
        style={{ maxWidth: '100%', maxHeight: '56vh', borderRadius: 8, touchAction: 'none', cursor: dragging !== null ? 'grabbing' : 'crosshair', display: 'block' }}
        onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={onUp}
        onTouchStart={onDown} onTouchMove={onMove} onTouchEnd={onUp}
      />

      {corners.length === 4 && (
        <div style={{ display: 'flex', gap: 12, marginTop: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Haut-gauche','Haut-droit','Bas-droit','Bas-gauche'].map((label, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: HANDLE_COLORS[i], display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 16, width: '100%', maxWidth: 420, boxSizing: 'border-box' }}>
        <button onClick={onClose} disabled={applying}
          style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          Annuler
        </button>
        <button onClick={onFallback} disabled={applying}
          style={{ flex: 1, padding: '13px 0', background: 'rgba(255,255,255,0.14)', border: 'none', borderRadius: 12, color: 'white', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
          Manuel
        </button>
        <button onClick={applyWarp} disabled={corners.length < 4 || applying}
          style={{ flex: 2, padding: '13px 0', background: applying ? '#666' : 'white', color: '#111', border: 'none', borderRadius: 12, fontWeight: 800, cursor: applying ? 'wait' : 'pointer', fontSize: 14 }}>
          {applying ? 'Traitement…' : 'Utiliser'}
        </button>
      </div>
    </div>
  )
}
