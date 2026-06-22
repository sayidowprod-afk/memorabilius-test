'use client'
import { useEffect, useRef, useState } from 'react'

type Pt = { x: number; y: number }
type Status = 'detecting' | 'found' | 'notfound'

interface FrameRect { x: number; y: number; w: number; h: number }

interface Props {
  src: string
  onResult: (blob: Blob) => void
  onFallback: () => void
  onClose: () => void
  frameRect?: FrameRect // zone cadre caméra → détection IA ciblée
}

// ── Chargement OpenCV.js (WASM) ───────────────────────────────────────────

let _cvPromise: Promise<any> | null = null

function loadOpenCV(): Promise<any> {
  if (_cvPromise) return _cvPromise
  const w = window as any
  if (w.cv?.imread) return Promise.resolve(w.cv)
  _cvPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js'
    script.async = true
    script.onload = () => {
      const check = setInterval(() => {
        if ((window as any).cv?.imread) { clearInterval(check); resolve((window as any).cv) }
      }, 50)
      setTimeout(() => { clearInterval(check); _cvPromise = null; reject('timeout') }, 20000)
    }
    script.onerror = () => { _cvPromise = null; reject('load error') }
    document.head.appendChild(script)
  })
  return _cvPromise
}

// Ratio largeur/hauteur d'un quadrilatère
function quadRatio(pts: Pt[]): number {
  const [tl, tr, br, bl] = pts
  const w = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2
  const h = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2
  return w / (h || 1)
}

// Vérifie que les coins ne sont pas collés aux bords de l'image (= image entière détectée)
function cornersInsideImage(pts: Pt[], W: number, H: number): boolean {
  const MARGIN = 0.05 // 5% de marge min depuis chaque bord
  return pts.every(p =>
    p.x > W * MARGIN && p.x < W * (1 - MARGIN) &&
    p.y > H * MARGIN && p.y < H * (1 - MARGIN)
  )
}

async function detectCardOpenCV(img: HTMLImageElement, cv: any): Promise<Pt[] | null> {
  const MAX = 800
  const scale = Math.min(MAX / img.naturalWidth, MAX / img.naturalHeight, 1)
  const W = Math.round(img.naturalWidth * scale)
  const H = Math.round(img.naturalHeight * scale)

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  canvas.getContext('2d')!.drawImage(img, 0, 0, W, H)

  const src  = cv.imread(canvas)
  const gray = new cv.Mat()
  const blur = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  cv.GaussianBlur(gray, blur, new cv.Size(7, 7), 0)

  const CARD_RATIO_P = 2.5 / 3.5
  const CARD_RATIO_L = 3.5 / 2.5
  const RATIO_TOL    = 0.30
  const isCardRatio = (r: number) =>
    Math.abs(r - CARD_RATIO_P) < RATIO_TOL || Math.abs(r - CARD_RATIO_L) < RATIO_TOL
  const ratioScore = (r: number) =>
    Math.min(Math.abs(r - CARD_RATIO_P), Math.abs(r - CARD_RATIO_L))

  // ── Étape 1 : estimer la couleur du fond depuis la bordure de l'image ────
  const BORDER = Math.max(8, Math.round(Math.min(W, H) * 0.05))
  const gData  = blur.data as Uint8Array
  let bgSum = 0, bgCount = 0
  for (let x = 0; x < W; x++) {
    for (let b = 0; b < BORDER; b++) {
      bgSum += gData[b * W + x]
      bgSum += gData[(H - 1 - b) * W + x]
      bgCount += 2
    }
  }
  for (let y = BORDER; y < H - BORDER; y++) {
    for (let b = 0; b < BORDER; b++) {
      bgSum += gData[y * W + b]
      bgSum += gData[y * W + (W - 1 - b)]
      bgCount += 2
    }
  }
  const bgVal = Math.round(bgSum / bgCount)

  const extractQuads = (binary: any): Pt[] | null => {
    const contours  = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)
    let best: Pt[] | null = null
    let bestScore = Infinity
    for (let i = 0; i < contours.size(); i++) {
      const cnt  = contours.get(i)
      const area = cv.contourArea(cnt)
      // Rejette trop petit ou presque toute l'image
      if (area < W * H * 0.04 || area > W * H * 0.90) { cnt.delete(); continue }
      const peri   = cv.arcLength(cnt, true)
      const approx = new cv.Mat()
      cv.approxPolyDP(cnt, approx, 0.03 * peri, true)
      if (approx.rows === 4) {
        const pts: Pt[] = []
        for (let j = 0; j < 4; j++)
          pts.push({ x: approx.data32S[j * 2] / scale, y: approx.data32S[j * 2 + 1] / scale })
        const ordered = orderCorners(pts)
        const ratio   = quadRatio(ordered)
        if (isCardRatio(ratio)) {
          const score = ratioScore(ratio)
          if (score < bestScore) { bestScore = score; best = ordered }
        }
      }
      approx.delete(); cnt.delete()
    }
    contours.delete(); hierarchy.delete()
    return best
  }

  let best: Pt[] | null = null

  // ── Méthode A : seuillage par couleur de fond ─────────────────────────
  // Plus robuste que Canny sur fond uniforme (table, bureau…)
  for (const tol of [20, 35, 55]) {
    const diff   = new cv.Mat()
    const thresh = new cv.Mat()
    const closed = new cv.Mat()
    const bgMat  = new cv.Mat(H, W, cv.CV_8UC1, new cv.Scalar(bgVal))
    cv.absdiff(blur, bgMat, diff)
    bgMat.delete()
    cv.threshold(diff, thresh, tol, 255, cv.THRESH_BINARY)
    // Fermeture pour boucher les trous internes (hologrammes, etc.)
    const kSz    = Math.max(3, Math.round(Math.min(W, H) * 0.04) * 2 + 1)
    const kernel = cv.Mat.ones(kSz, kSz, cv.CV_8U)
    cv.morphologyEx(thresh, closed, cv.MORPH_CLOSE, kernel)
    kernel.delete()
    best = extractQuads(closed)
    diff.delete(); thresh.delete(); closed.delete()
    if (best) break
  }

  // ── Méthode B : Canny (fallback sur fond contrasté) ───────────────────
  if (!best) {
    for (const [lo, hi] of [[30, 90], [50, 150], [80, 200]]) {
      const edges   = new cv.Mat()
      const dilated = new cv.Mat()
      cv.Canny(blur, edges, lo, hi)
      const kernel = cv.Mat.ones(5, 5, cv.CV_8U)
      cv.dilate(edges, dilated, kernel)
      kernel.delete()
      best = extractQuads(dilated)
      edges.delete(); dilated.delete()
      if (best) break
    }
  }

  src.delete(); gray.delete(); blur.delete()
  return best
}

// ── Détection par transformée de Hough (fallback) ────────────────────────

// Ordre: TL, TR, BR, BL
function orderCorners(pts: Pt[]): Pt[] {
  const bySum  = [...pts].sort((a, b) => (a.x+a.y) - (b.x+b.y))
  const byDiff = [...pts].sort((a, b) => (a.x-a.y) - (b.x-b.y))
  return [bySum[0], byDiff[byDiff.length-1], bySum[bySum.length-1], byDiff[0]]
}

function toGray(d: Uint8ClampedArray, w: number, h: number): Float32Array {
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = d[i*4]*0.299 + d[i*4+1]*0.587 + d[i*4+2]*0.114
  return g
}

// Étirement de l'histogramme : améliore le contraste avant détection de bords
function normalize(g: Float32Array): Float32Array {
  let min = 255, max = 0
  for (let i = 0; i < g.length; i++) { if (g[i] < min) min = g[i]; if (g[i] > max) max = g[i] }
  const range = max - min || 1
  const out = new Float32Array(g.length)
  for (let i = 0; i < g.length; i++) out[i] = (g[i] - min) / range * 255
  return out
}

function gaussBlur(g: Float32Array, w: number, h: number): Float32Array {
  const k = [1, 4, 6, 4, 1]
  const tmp = new Float32Array(w * h)
  const out = new Float32Array(w * h)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0
      for (let d = -2; d <= 2; d++) { const xx = x+d; if (xx>=0 && xx<w) { s += g[y*w+xx]*k[d+2]; n += k[d+2] } }
      tmp[y*w+x] = s/n
    }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let s = 0, n = 0
      for (let d = -2; d <= 2; d++) { const yy = y+d; if (yy>=0 && yy<h) { s += tmp[yy*w+x]*k[d+2]; n += k[d+2] } }
      out[y*w+x] = s/n
    }
  return out
}

function sobel(g: Float32Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let y = 1; y < h-1; y++)
    for (let x = 1; x < w-1; x++) {
      const gx = -g[(y-1)*w+x-1] + g[(y-1)*w+x+1] - 2*g[y*w+x-1] + 2*g[y*w+x+1] - g[(y+1)*w+x-1] + g[(y+1)*w+x+1]
      const gy = -g[(y-1)*w+x-1] - 2*g[(y-1)*w+x] - g[(y-1)*w+x+1] + g[(y+1)*w+x-1] + 2*g[(y+1)*w+x] + g[(y+1)*w+x+1]
      out[y*w+x] = Math.sqrt(gx*gx + gy*gy) > 25 ? 255 : 0
    }
  return out
}

type HLine = { r: number; t: number; v: number }

function houghLines(edges: Uint8Array, w: number, h: number): HLine[] {
  const diag   = Math.ceil(Math.sqrt(w*w + h*h))
  const NRHO   = diag * 2 + 1
  const NTHETA = 180
  const acc    = new Int32Array(NRHO * NTHETA)
  const cosA   = new Float32Array(NTHETA)
  const sinA   = new Float32Array(NTHETA)
  for (let t = 0; t < NTHETA; t++) {
    const a = t * Math.PI / NTHETA; cosA[t] = Math.cos(a); sinA[t] = Math.sin(a)
  }
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!edges[y*w+x]) continue
      for (let t = 0; t < NTHETA; t++) {
        const r = Math.round(x*cosA[t] + y*sinA[t]) + diag
        if (r >= 0 && r < NRHO) acc[r*NTHETA+t]++
      }
    }

  // Greedy peak picking : top N avec distance minimale
  const minVotes = Math.max(w, h) * 0.08
  const candidates: HLine[] = []
  for (let r = 0; r < NRHO; r++)
    for (let t = 0; t < NTHETA; t++) {
      const v = acc[r*NTHETA+t]
      if (v >= minVotes) candidates.push({ r: r-diag, t, v })
    }
  candidates.sort((a, b) => b.v - a.v)

  const peaks: HLine[] = []
  for (const c of candidates) {
    const tooClose = peaks.some(p =>
      Math.abs(p.r - c.r) < 20 &&
      Math.min(Math.abs(p.t - c.t), NTHETA - Math.abs(p.t - c.t)) < 15
    )
    if (!tooClose) { peaks.push(c); if (peaks.length >= 30) break }
  }
  return peaks
}

function lineIntersect(l1: HLine, l2: HLine, NTHETA: number): Pt | null {
  const t1 = l1.t * Math.PI / NTHETA, t2 = l2.t * Math.PI / NTHETA
  const det = Math.cos(t1)*Math.sin(t2) - Math.sin(t1)*Math.cos(t2)
  if (Math.abs(det) < 0.02) return null
  return {
    x: (l1.r*Math.sin(t2) - l2.r*Math.sin(t1)) / det,
    y: (l2.r*Math.cos(t1) - l1.r*Math.cos(t2)) / det,
  }
}

function detectCornersHough(edges: Uint8Array, w: number, h: number): Pt[] | null {
  const NTHETA = 180
  const peaks  = houghLines(edges, w, h)
  if (peaks.length < 4) return null

  // Groupe 1 : angle dominant (ligne la plus votée)
  // Groupe 2 : angle perpendiculaire (±90°)
  const dominant = peaks[0]
  const perpT    = (dominant.t + NTHETA / 2) % NTHETA
  const TOL      = 25

  const angDiff = (a: number, b: number) => Math.min(Math.abs(a-b), NTHETA - Math.abs(a-b))

  const g1 = peaks.filter(l => angDiff(l.t, dominant.t) < TOL)
  const g2 = peaks.filter(l => angDiff(l.t, perpT)      < TOL)
  if (g1.length < 2 || g2.length < 2) return null

  // Dans chaque groupe, trouve la paire la plus écartée (bords opposés de la carte)
  const bestPair = (lines: HLine[]): [HLine, HLine] | null => {
    let best: [HLine, HLine] | null = null, bestD = 0
    for (let i = 0; i < lines.length; i++)
      for (let j = i+1; j < lines.length; j++) {
        const d = Math.abs(lines[i].r - lines[j].r)
        if (d > bestD && d > Math.min(w, h) * 0.15) { bestD = d; best = [lines[i], lines[j]] }
      }
    return best
  }

  const pair1 = bestPair(g1)
  const pair2 = bestPair(g2)
  if (!pair1 || !pair2) return null

  // Calcule les 4 intersections
  const corners: Pt[] = []
  for (const l1 of pair1)
    for (const l2 of pair2) {
      const pt = lineIntersect(l1, l2, NTHETA)
      // Accepte les coins légèrement hors image (carte coupée par le cadre)
      if (pt && pt.x >= -w*0.25 && pt.x <= w*1.25 && pt.y >= -h*0.25 && pt.y <= h*1.25)
        corners.push(pt)
    }

  if (corners.length !== 4) return null

  // Validation : surface minimale (la carte doit occuper >10% de l'image)
  const [tl, tr, br, bl] = orderCorners(corners)
  const area = Math.abs((tr.x-tl.x)*(bl.y-tl.y) - (bl.x-tl.x)*(tr.y-tl.y)) / 2
  if (area < w * h * 0.10) return null

  return orderCorners(corners)
}

// ── Méthode 1 : seuillage Otsu + plus grand blob ─────────────────────────
// Idéale quand la carte contraste avec le fond (fond sombre ou clair uniforme)

function otsuThreshold(gray: Float32Array): number {
  const hist = new Float32Array(256)
  for (let i = 0; i < gray.length; i++) hist[Math.round(gray[i])]++
  const total = gray.length
  let sum = 0
  for (let i = 0; i < 256; i++) sum += i * hist[i]
  let sumB = 0, wB = 0, max = 0, thresh = 128
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue
    const wF = total - wB; if (!wF) break
    sumB += t * hist[t]
    const between = wB * wF * ((sumB/wB) - ((sum-sumB)/wF)) ** 2
    if (between > max) { max = between; thresh = t }
  }
  return thresh
}

function largestBlobCorners(binary: Uint8Array, w: number, h: number): Pt[] | null {
  // BFS pour trouver le plus grand composant connexe
  const visited = new Uint8Array(w * h)
  let best: { tl:Pt; tr:Pt; br:Pt; bl:Pt; size:number } | null = null

  for (let start = 0; start < w * h; start++) {
    if (!binary[start] || visited[start]) continue
    let tlV=Infinity,trV=-Infinity,brV=-Infinity,blV=Infinity
    let tlP={x:0,y:0},trP={x:0,y:0},brP={x:0,y:0},blP={x:0,y:0}
    const queue = [start]; visited[start] = 1; let qi = 0, size = 0
    while (qi < queue.length) {
      const idx = queue[qi++]; size++
      const x = idx % w, y = Math.floor(idx / w)
      if (x+y < tlV) { tlV=x+y; tlP={x,y} }
      if (x-y > trV) { trV=x-y; trP={x,y} }
      if (x+y > brV) { brV=x+y; brP={x,y} }
      if (x-y < blV) { blV=x-y; blP={x,y} }
      for (const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx=x+dx,ny=y+dy
        if (nx<0||nx>=w||ny<0||ny>=h) continue
        const ni=ny*w+nx
        if (binary[ni] && !visited[ni]) { visited[ni]=1; queue.push(ni) }
      }
    }
    if (!best || size > best.size) best = { tl:tlP,tr:trP,br:brP,bl:blP,size }
  }
  if (!best) return null
  const corners = [best.tl, best.tr, best.br, best.bl]
  const [tl,tr,,bl] = corners
  const area = Math.abs((tr.x-tl.x)*(bl.y-tl.y)-(bl.x-tl.x)*(tr.y-tl.y))/2
  if (area < w * h * 0.06) return null
  return corners
}

// Ratio largeur/hauteur des 4 coins d'un quadrilatère
function quadAspectRatio(corners: Pt[]): number {
  const [tl, tr, br, bl] = corners
  const w = (Math.hypot(tr.x-tl.x, tr.y-tl.y) + Math.hypot(br.x-bl.x, br.y-bl.y)) / 2
  const h = (Math.hypot(bl.x-tl.x, bl.y-tl.y) + Math.hypot(br.x-tr.x, br.y-tr.y)) / 2
  return w / (h || 1)
}

function detectByThreshold(data: Uint8ClampedArray, w: number, h: number): Pt[] | null {
  const rawGray  = toGray(data, w, h)
  const normGray = normalize(rawGray)
  // Ratio carte standard ~0.714 (2.5/3.5), ou paysage ~1.4
  const CARD_RATIO = 2.5 / 3.5

  let best: Pt[] | null = null, bestScore = Infinity

  // 4 combinaisons : gris brut/normalisé × fond sombre/fond clair
  for (const gray of [rawGray, normGray]) {
    const thresh = otsuThreshold(gray)
    for (const invert of [false, true]) {
      const binary = new Uint8Array(w * h)
      for (let i = 0; i < w * h; i++) binary[i] = (gray[i] > thresh) !== invert ? 1 : 0
      const corners = largestBlobCorners(binary, w, h)
      if (!corners) continue
      const r = quadAspectRatio(corners)
      // Score : distance au ratio carte portrait ou paysage (le plus proche gagne)
      const score = Math.min(Math.abs(r - CARD_RATIO), Math.abs(r - 1 / CARD_RATIO))
      if (score < bestScore) { bestScore = score; best = corners }
    }
  }

  // Rejeter si le ratio est trop éloigné d'une carte (ex: fond qui occupe tout l'image)
  return best && bestScore < 0.55 ? best : null
}

// Garde seulement les bords dans la zone périphérique de l'image (≈40% extérieur).
// Élimine les motifs internes des cartes holographiques/prismatiques qui polluent Hough.
function peripheralMask(edges: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!edges[y*w+x]) continue
      const dx = Math.min(x, w-1-x) / (w * 0.5)  // 0=bord image, 1=centre image
      const dy = Math.min(y, h-1-y) / (h * 0.5)
      if (Math.min(dx, dy) < 0.40) out[y*w+x] = 255
    }
  }
  return out
}

// ── Détection dans un crop Roboflow (carte déjà localisée) ───────────────
// Utilise minAreaRect pour trouver le rectangle orienté de la carte (même inclinée)

async function detectCardInCrop(cropImg: HTMLImageElement, cv: any): Promise<Pt[] | null> {
  const W = cropImg.naturalWidth
  const H = cropImg.naturalHeight

  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  canvas.getContext('2d')!.drawImage(cropImg, 0, 0, W, H)

  const src  = cv.imread(canvas)
  const gray = new cv.Mat()
  const blur = new cv.Mat()
  cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
  cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0)

  // Couleur du fond depuis les bordures du crop
  const BORDER = Math.max(5, Math.round(Math.min(W, H) * 0.08))
  const gData  = blur.data as Uint8Array
  let bgSum = 0, bgCount = 0
  for (let x = 0; x < W; x++) {
    for (let b = 0; b < BORDER; b++) {
      bgSum += gData[b * W + x]
      bgSum += gData[(H - 1 - b) * W + x]
      bgCount += 2
    }
  }
  const bgVal = Math.round(bgSum / bgCount)

  let best: Pt[] | null = null

  for (const tol of [25, 40, 60]) {
    const diff   = new cv.Mat()
    const thresh = new cv.Mat()
    const closed = new cv.Mat()
    const bgMat  = new cv.Mat(H, W, cv.CV_8UC1, new cv.Scalar(bgVal))
    cv.absdiff(blur, bgMat, diff)
    bgMat.delete()
    cv.threshold(diff, thresh, tol, 255, cv.THRESH_BINARY)
    const kSz    = Math.max(3, Math.round(Math.min(W, H) * 0.05) * 2 + 1)
    const kernel = cv.Mat.ones(kSz, kSz, cv.CV_8U)
    cv.morphologyEx(thresh, closed, cv.MORPH_CLOSE, kernel)
    kernel.delete()

    const contours  = new cv.MatVector()
    const hierarchy = new cv.Mat()
    cv.findContours(closed, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE)

    let largestCnt: any = null, largestArea = 0
    for (let i = 0; i < contours.size(); i++) {
      const cnt  = contours.get(i)
      const area = cv.contourArea(cnt)
      if (area > largestArea) {
        if (largestCnt) largestCnt.delete()
        largestArea = area; largestCnt = cnt
      } else cnt.delete()
    }

    if (largestCnt && largestArea > W * H * 0.08) {
      // minAreaRect : rectangle orienté → suit l'inclinaison de la carte
      const rect   = cv.minAreaRect(largestCnt)
      const boxMat = new cv.Mat()
      cv.boxPoints(rect, boxMat)
      const pts: Pt[] = []
      for (let j = 0; j < 4; j++)
        pts.push({ x: boxMat.data32F[j * 2], y: boxMat.data32F[j * 2 + 1] })
      boxMat.delete()
      best = orderCorners(pts)
    }

    if (largestCnt) largestCnt.delete()
    diff.delete(); thresh.delete(); closed.delete(); contours.delete(); hierarchy.delete()
    if (best) break
  }

  src.delete(); gray.delete(); blur.delete()
  return best
}

// ── Détection Roboflow → bbox → OpenCV corners ───────────────────────────

async function imageToBase64(img: HTMLImageElement, maxSize = 800): Promise<{ b64: string; scale: number }> {
  const scale = Math.min(maxSize / img.naturalWidth, maxSize / img.naturalHeight, 1)
  const W = Math.round(img.naturalWidth * scale)
  const H = Math.round(img.naturalHeight * scale)
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  c.getContext('2d')!.drawImage(img, 0, 0, W, H)
  const dataUrl = c.toDataURL('image/jpeg', 0.85)
  return { b64: dataUrl.split(',')[1], scale }
}

// Approche CamScanner : scan depuis les bords du crop vers l'intérieur.
// Le fond est estimé depuis les zones de PADDING (extérieures au cadre overlay),
// garanties background. Retourne null si détection trop incertaine → fallback sur cadre.
function detectCardFromFrame(img: HTMLImageElement, frame: FrameRect): Pt[] | null {
  try {
    const PAD = 0.16
    const cx = Math.max(0, frame.x - frame.w * PAD)
    const cy = Math.max(0, frame.y - frame.h * PAD)
    const cw = Math.min(img.naturalWidth  - cx, frame.w * (1 + PAD * 2))
    const ch = Math.min(img.naturalHeight - cy, frame.h * (1 + PAD * 2))

    const MAX = 700
    const s = Math.min(MAX / cw, MAX / ch, 1)
    const W = Math.round(cw * s), H = Math.round(ch * s)

    const canvas = document.createElement('canvas')
    canvas.width = W; canvas.height = H
    canvas.getContext('2d')!.drawImage(img, cx, cy, cw, ch, 0, 0, W, H)
    const { data } = canvas.getContext('2d')!.getImageData(0, 0, W, H)

    // Grayscale
    const raw = new Float32Array(W * H)
    for (let i = 0; i < W * H; i++)
      raw[i] = 0.299 * data[i*4] + 0.587 * data[i*4+1] + 0.114 * data[i*4+2]

    // Blur 3×3
    const g = new Float32Array(W * H)
    for (let y = 1; y < H - 1; y++)
      for (let x = 1; x < W - 1; x++) {
        let sum = 0
        for (let dy = -1; dy <= 1; dy++)
          for (let dx = -1; dx <= 1; dx++)
            sum += raw[(y+dy)*W+(x+dx)]
        g[y*W+x] = sum / 9
      }

    // Position du cadre dans l'espace canvas cropé
    const fxL = Math.round((frame.x - cx) * s)
    const fxR = Math.round((frame.x + frame.w - cx) * s)
    const fyT = Math.round((frame.y - cy) * s)
    const fyB = Math.round((frame.y + frame.h - cy) * s)

    // Fond estimé depuis les 4 coins du crop (zones PAD — garanties background)
    const CORNER = Math.round(Math.min(W, H) * 0.08)
    let bgSum = 0, bgN = 0
    for (let y = 0; y < CORNER; y++) for (let x = 0; x < CORNER; x++) { bgSum += g[y*W+x]; bgN++ }
    for (let y = 0; y < CORNER; y++) for (let x = W-CORNER; x < W; x++) { bgSum += g[y*W+x]; bgN++ }
    for (let y = H-CORNER; y < H; y++) for (let x = 0; x < CORNER; x++) { bgSum += g[y*W+x]; bgN++ }
    for (let y = H-CORNER; y < H; y++) for (let x = W-CORNER; x < W; x++) { bgSum += g[y*W+x]; bgN++ }
    const bgLum = bgSum / bgN

    // Essai sur plusieurs seuils, garde le meilleur ratio carte
    const CARD_RATIO = 2.5 / 3.5
    let bestResult: Pt[] | null = null
    let bestScore = Infinity

    for (const THRESH of [18, 28, 40, 55]) {
      const topPts: Pt[] = [], botPts: Pt[] = [], leftPts: Pt[] = [], rightPts: Pt[] = []

      for (let x = Math.round(W * 0.05); x < W * 0.95; x++) {
        for (let y = 1; y < fyT + Math.round((fyB - fyT) * 0.5); y++) {
          if (Math.abs(g[y*W+x] - bgLum) > THRESH) { topPts.push({ x, y }); break }
        }
        for (let y = H - 2; y >= fyB - Math.round((fyB - fyT) * 0.5); y--) {
          if (Math.abs(g[y*W+x] - bgLum) > THRESH) { botPts.push({ x, y }); break }
        }
      }
      for (let y = Math.round(H * 0.05); y < H * 0.95; y++) {
        for (let x = 1; x < fxL + Math.round((fxR - fxL) * 0.5); x++) {
          if (Math.abs(g[y*W+x] - bgLum) > THRESH) { leftPts.push({ x, y }); break }
        }
        for (let x = W - 2; x >= fxR - Math.round((fxR - fxL) * 0.5); x--) {
          if (Math.abs(g[y*W+x] - bgLum) > THRESH) { rightPts.push({ x, y }); break }
        }
      }

      if (topPts.length < 8 || botPts.length < 8 || leftPts.length < 8 || rightPts.length < 8) continue

      function med(arr: number[]) { const s = [...arr].sort((a,b)=>a-b); return s[s.length>>1] }
      function filterY(pts: Pt[]) { const m = med(pts.map(p=>p.y)); const d = med(pts.map(p=>Math.abs(p.y-m)))*2+6; return pts.filter(p=>Math.abs(p.y-m)<=d) }
      function filterX(pts: Pt[]) { const m = med(pts.map(p=>p.x)); const d = med(pts.map(p=>Math.abs(p.x-m)))*2+6; return pts.filter(p=>Math.abs(p.x-m)<=d) }

      const tP = filterY(topPts), bP = filterY(botPts), lP = filterX(leftPts), rP = filterX(rightPts)
      if (tP.length < 5 || bP.length < 5 || lP.length < 5 || rP.length < 5) continue

      function fitH(pts: Pt[]) { const n=pts.length; let sx=0,sy=0,sxx=0,sxy=0; for(const p of pts){sx+=p.x;sy+=p.y;sxx+=p.x*p.x;sxy+=p.x*p.y}; const d=n*sxx-sx*sx; if(Math.abs(d)<1e-6)return null; const a=(n*sxy-sx*sy)/d; return {a,b:(sy-a*sx)/n} }
      function fitV(pts: Pt[]) { const n=pts.length; let sx=0,sy=0,syy=0,sxy=0; for(const p of pts){sx+=p.x;sy+=p.y;syy+=p.y*p.y;sxy+=p.x*p.y}; const d=n*syy-sy*sy; if(Math.abs(d)<1e-6)return null; const a=(n*sxy-sy*sx)/d; return {a,b:(sx-a*sy)/n} }
      function intersect(h:{a:number;b:number}, v:{a:number;b:number}): Pt|null { const d=1-h.a*v.a; if(Math.abs(d)<1e-6)return null; const y=(h.a*v.b+h.b)/d; return {x:v.a*y+v.b,y} }

      const top=fitH(tP), bot=fitH(bP), left=fitV(lP), right=fitV(rP)
      if (!top||!bot||!left||!right) continue

      const TL=intersect(top,left), TR=intersect(top,right), BR=intersect(bot,right), BL=intersect(bot,left)
      if (!TL||!TR||!BR||!BL) continue

      const w = Math.hypot(TR.x-TL.x, TR.y-TL.y)
      const h2 = Math.hypot(BL.x-TL.x, BL.y-TL.y)
      if (w < 10 || h2 < 10) continue
      const ratio = Math.min(w,h2) / Math.max(w,h2)
      const score = Math.min(Math.abs(ratio - CARD_RATIO), Math.abs(ratio - 1/CARD_RATIO))
      if (score < bestScore) {
        bestScore = score
        bestResult = [TL, TR, BR, BL].map(p => ({ x: cx + p.x/s, y: cy + p.y/s }))
      }
    }

    // Rejette si le ratio est trop loin d'une carte (détection ratée)
    return bestScore < 0.25 ? bestResult : null
  } catch {
    return null
  }
}

async function detectCard(img: HTMLImageElement): Promise<Pt[] | null> {
  const W = img.naturalWidth, H = img.naturalHeight

  // ── Étape 1 : Gemini Pro sur l'image entière (premier, le plus précis) ──
  try {
    const { b64 } = await imageToBase64(img, 1024)
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    let res: Response
    try {
      res = await fetch('/api/detect-corners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: b64, mimeType: 'image/jpeg' }),
        signal: ctrl.signal,
      })
    } finally { clearTimeout(t) }

    if (res!.ok) {
      const { topLeft: tl, topRight: tr, bottomRight: br, bottomLeft: bl } = await res!.json()
      if (tl && tr && br && bl) {
        const corners: Pt[] = [
          { x: tl.x * W, y: tl.y * H },
          { x: tr.x * W, y: tr.y * H },
          { x: br.x * W, y: br.y * H },
          { x: bl.x * W, y: bl.y * H },
        ]
        // Sanity check : quadrilatère convexe et ratio raisonnable
        const w = (Math.hypot(corners[1].x-corners[0].x, corners[1].y-corners[0].y) + Math.hypot(corners[2].x-corners[3].x, corners[2].y-corners[3].y)) / 2
        const h = (Math.hypot(corners[3].x-corners[0].x, corners[3].y-corners[0].y) + Math.hypot(corners[2].x-corners[1].x, corners[2].y-corners[1].y)) / 2
        const ratio = w / (h || 1)
        const CARD_RATIO = 2.5 / 3.5
        const rScore = Math.min(Math.abs(ratio - CARD_RATIO), Math.abs(ratio - 1 / CARD_RATIO))
        if (rScore < 0.45) return corners
      }
    }
  } catch { /* fallback OpenCV */ }

  // ── Étape 2 : OpenCV fallback ────────────────────────────────────────────
  try {
    const cv = await Promise.race([
      loadOpenCV(),
      new Promise<null>(r => setTimeout(() => r(null), 4000)),
    ])
    if (cv) {
      const result = await detectCardOpenCV(img, cv)
      if (result) return result
    }
  } catch { /* rien */ }

  return null
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
  // corners = [TL, TR, BR, BL] en coordonnées naturelles de l'image
  const [tl, tr, br, bl] = corners

  // Centre du quadrilatère
  const cx = (tl.x + tr.x + br.x + bl.x) / 4
  const cy = (tl.y + tr.y + br.y + bl.y) / 4

  // Largeur et hauteur moyennes
  const w = (Math.hypot(tr.x - tl.x, tr.y - tl.y) + Math.hypot(br.x - bl.x, br.y - bl.y)) / 2
  const h = (Math.hypot(bl.x - tl.x, bl.y - tl.y) + Math.hypot(br.x - tr.x, br.y - tr.y)) / 2

  // Angle de rotation (depuis le bord supérieur)
  const angle = Math.atan2(tr.y - tl.y, tr.x - tl.x)

  // Toujours sortir en portrait (600×840), rotation 90° si la carte est paysage
  const OUT_W = 600, OUT_H = 840
  const isLandscape = w > h
  // Pour une carte paysage, on pivote de 90° pour la mettre en portrait
  const effectiveAngle = isLandscape ? angle - Math.PI / 2 : angle
  const effectiveW = isLandscape ? h : w
  const effectiveH = isLandscape ? w : h

  const outC = document.createElement('canvas')
  outC.width = OUT_W; outC.height = OUT_H
  const ctx = outC.getContext('2d')!

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, OUT_W, OUT_H)

  const scale = Math.min(OUT_W / effectiveW, OUT_H / effectiveH)

  ctx.save()
  ctx.translate(OUT_W / 2, OUT_H / 2)
  ctx.rotate(-effectiveAngle)
  ctx.scale(scale, scale)
  ctx.drawImage(img, -cx, -cy)
  ctx.restore()

  return new Promise(res => outC.toBlob(b => res(b!), 'image/jpeg', 0.90))
}

// ── Composant ────────────────────────────────────────────────────────────

const HANDLE_COLORS = ['#ff5252', '#ffeb3b', '#69f0ae', '#40c4ff']
const HANDLE_R = 18

export default function CardScanner({ src, onResult, onFallback, onClose, frameRect }: Props) {
  const canvasRef     = useRef<HTMLCanvasElement>(null)
  const imgRef        = useRef<HTMLImageElement | null>(null)
  const origImgRef    = useRef<HTMLImageElement | null>(null)  // toujours l'original non-tourné
  const scaleRef      = useRef(1)
  const hasAdjusted   = useRef(false) // true dès que l'utilisateur bouge un coin

  const [status, setStatus]     = useState<Status>('detecting')
  const [corners, setCorners]   = useState<Pt[]>([])
  const [dragging, setDragging] = useState<number | null>(null)
  const [applying, setApplying] = useState(false)
  const [rotation, setRotation] = useState(0)

  // Zoom / pan — pan en coordonnées canvas (non-zoomées)
  const [zoom, setZoom] = useState(1)
  const [pan,  setPan]  = useState<Pt>({ x: 0, y: 0 })
  const zoomRef  = useRef(zoom)
  const panRef   = useRef(pan)
  zoomRef.current = zoom
  panRef.current  = pan

  // Refs pour le pinch
  const lastPinchDist = useRef(0)
  const lastPanPt     = useRef<Pt | null>(null)
  const isPanning     = useRef(false)

  // ── Chargement & détection ─────────────────────────────────────────────
  useEffect(() => {
    const img = new Image()
    img.onload = async () => {
      origImgRef.current = img
      imgRef.current = img
      await initCanvas(img)
    }
    img.src = src
  }, [src])

  const initCanvas = async (img: HTMLImageElement) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const maxW = Math.min(window.innerWidth - 32, 500)
    const maxH = Math.round(window.innerHeight * 0.50)
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1)
    scaleRef.current = scale
    canvas.width  = Math.round(img.naturalWidth  * scale)
    canvas.height = Math.round(img.naturalHeight * scale)
    setPan({ x: canvas.width / 2, y: canvas.height / 2 })
    setZoom(1)
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)

    hasAdjusted.current = false
    setStatus('detecting')

    const naturalCorners: Pt[] | null = frameRect
      ? (detectCardFromFrame(img, frameRect) ?? [
          { x: frameRect.x,                 y: frameRect.y },
          { x: frameRect.x + frameRect.w,   y: frameRect.y },
          { x: frameRect.x + frameRect.w,   y: frameRect.y + frameRect.h },
          { x: frameRect.x,                 y: frameRect.y + frameRect.h },
        ])
      : await Promise.race([
          detectCard(img),
          new Promise<null>(r => setTimeout(() => r(null), 10000)),
        ])
    const display = naturalCorners
      ? naturalCorners.map(p => ({ x: p.x * scale, y: p.y * scale }))
      : defaultCorners(canvas)
    setCorners(display)
    setStatus(naturalCorners ? 'found' : 'notfound')
  }

  // Tourne l'image depuis l'original (évite la dégradation par compressions successives)
  const handleRotate = async () => {
    const origImg = origImgRef.current
    if (!origImg || applying) return
    const newRot = (rotation + 45) % 360
    setRotation(newRot)

    const rad = newRot * Math.PI / 180
    const W = origImg.naturalWidth, H = origImg.naturalHeight
    const rotW = Math.ceil(Math.abs(W * Math.cos(rad)) + Math.abs(H * Math.sin(rad)))
    const rotH = Math.ceil(Math.abs(W * Math.sin(rad)) + Math.abs(H * Math.cos(rad)))

    const rotC = document.createElement('canvas')
    rotC.width = rotW; rotC.height = rotH
    const rotCtx = rotC.getContext('2d')!
    rotCtx.translate(rotW / 2, rotH / 2)
    rotCtx.rotate(rad)
    rotCtx.drawImage(origImg, -W / 2, -H / 2)

    const newImg = new Image()
    newImg.src = rotC.toDataURL('image/jpeg', 0.95)
    await new Promise(r => { newImg.onload = r })
    imgRef.current = newImg
    await initCanvas(newImg)
  }

  const defaultCorners = (canvas: HTMLCanvasElement): Pt[] => {
    const p = Math.round(Math.min(canvas.width, canvas.height) * 0.07)
    return [
      { x: p, y: p }, { x: canvas.width - p, y: p },
      { x: canvas.width - p, y: canvas.height - p }, { x: p, y: canvas.height - p },
    ]
  }

  // ── Dessin ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    const img    = imgRef.current
    if (!canvas || !img || corners.length < 4) return
    const ctx = canvas.getContext('2d')!
    const cw = canvas.width, ch = canvas.height
    const z = zoom, px = pan.x, py = pan.y

    ctx.clearRect(0, 0, cw, ch)
    ctx.save()
    ctx.translate(cw / 2, ch / 2)
    ctx.scale(z, z)
    ctx.translate(-px, -py)
    ctx.drawImage(img, 0, 0, cw, ch)

    // Quadrilatère
    ctx.beginPath()
    ctx.moveTo(corners[0].x, corners[0].y)
    corners.forEach(c => ctx.lineTo(c.x, c.y))
    ctx.closePath()
    ctx.fillStyle   = 'rgba(0,229,255,0.10)'; ctx.fill()
    ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 2.5 / z; ctx.stroke()

    // Handles (taille constante quel que soit le zoom)
    corners.forEach((c, i) => {
      ctx.beginPath()
      ctx.arc(c.x, c.y, HANDLE_R / z, 0, Math.PI * 2)
      ctx.fillStyle   = HANDLE_COLORS[i]; ctx.fill()
      ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2 / z; ctx.stroke()
    })
    ctx.restore()
  }, [corners, zoom, pan])

  // ── Conversion écran → coordonnées canvas (inverse de la transform draw) ──
  // draw: screenPt = (canvasPt - pan) * zoom + center
  // inverse: canvasPt = (screenPt - center) / zoom + pan
  const screenToCanvasCoord = (clientX: number, clientY: number): Pt => {
    const canvas = canvasRef.current!
    const rect   = canvas.getBoundingClientRect()
    const scaleX = canvas.width  / rect.width
    const scaleY = canvas.height / rect.height
    const screenX = (clientX - rect.left) * scaleX
    const screenY = (clientY - rect.top)  * scaleY
    const cx = canvas.width  / 2
    const cy = canvas.height / 2
    const z = zoomRef.current, p = panRef.current
    return {
      x: (screenX - cx) / z + p.x,
      y: (screenY - cy) / z + p.y,
    }
  }

  const nearestCorner = (pos: Pt): number => {
    const z = zoomRef.current
    let best = -1, bd = Infinity
    corners.forEach((c, i) => {
      const d = Math.hypot(c.x - pos.x, c.y - pos.y) * z
      if (d < bd) { bd = d; best = i }
    })
    return bd < HANDLE_R * 2.5 ? best : -1
  }

  // ── Événements souris ──────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    const pos = screenToCanvasCoord(e.clientX, e.clientY)
    const idx = nearestCorner(pos)
    if (idx >= 0) { hasAdjusted.current = true; setDragging(idx) }
    else { isPanning.current = true; lastPanPt.current = { x: e.clientX, y: e.clientY } }
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (dragging !== null) {
      const pos = screenToCanvasCoord(e.clientX, e.clientY)
      const canvas = canvasRef.current!
      setCorners(prev => { const n = [...prev]; n[dragging] = { x: Math.max(0, Math.min(canvas.width, pos.x)), y: Math.max(0, Math.min(canvas.height, pos.y)) }; return n })
    } else if (isPanning.current && lastPanPt.current) {
      const canvas = canvasRef.current!
      const rect   = canvas.getBoundingClientRect()
      const sx = canvas.width / rect.width, sy = canvas.height / rect.height
      const dx = (e.clientX - lastPanPt.current.x) * sx / zoomRef.current
      const dy = (e.clientY - lastPanPt.current.y) * sy / zoomRef.current
      lastPanPt.current = { x: e.clientX, y: e.clientY }
      setPan(p => ({ x: p.x - dx, y: p.y - dy }))
    }
  }
  const onMouseUp = () => { setDragging(null); isPanning.current = false; lastPanPt.current = null }

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.85 : 1 / 0.85
    setZoom(z => Math.max(1, Math.min(8, z * delta)))
  }

  // ── Événements tactiles ────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const t = e.touches[0]
      const pos = screenToCanvasCoord(t.clientX, t.clientY)
      const idx = nearestCorner(pos)
      if (idx >= 0) { hasAdjusted.current = true; setDragging(idx) }
      else { isPanning.current = true; lastPanPt.current = { x: t.clientX, y: t.clientY } }
    } else if (e.touches.length === 2) {
      setDragging(null); isPanning.current = false
      lastPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      lastPanPt.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2,
      }
    }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const t = e.touches[0]
      if (dragging !== null) {
        const pos = screenToCanvasCoord(t.clientX, t.clientY)
        const canvas = canvasRef.current!
        setCorners(prev => { const n = [...prev]; n[dragging] = { x: Math.max(0, Math.min(canvas.width, pos.x)), y: Math.max(0, Math.min(canvas.height, pos.y)) }; return n })
      } else if (isPanning.current && lastPanPt.current) {
        const canvas = canvasRef.current!
        const rect   = canvas.getBoundingClientRect()
        const sx = canvas.width / rect.width, sy = canvas.height / rect.height
        const dx = (t.clientX - lastPanPt.current.x) * sx / zoomRef.current
        const dy = (t.clientY - lastPanPt.current.y) * sy / zoomRef.current
        lastPanPt.current = { x: t.clientX, y: t.clientY }
        setPan(p => ({ x: p.x - dx, y: p.y - dy }))
      }
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      if (lastPinchDist.current > 0) {
        const ratio = dist / lastPinchDist.current
        setZoom(z => Math.max(1, Math.min(8, z * ratio)))
      }
      lastPinchDist.current = dist

      // Pan au centre du pinch
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2
      if (lastPanPt.current) {
        const canvas = canvasRef.current!
        const rect   = canvas.getBoundingClientRect()
        const sx = canvas.width / rect.width, sy = canvas.height / rect.height
        const dx = (midX - lastPanPt.current.x) * sx / zoomRef.current
        const dy = (midY - lastPanPt.current.y) * sy / zoomRef.current
        setPan(p => ({ x: p.x - dx, y: p.y - dy }))
      }
      lastPanPt.current = { x: midX, y: midY }
    }
  }
  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) { setDragging(null); isPanning.current = false; lastPanPt.current = null }
    if (e.touches.length === 1) { lastPinchDist.current = 0 }
  }

  // ── Warp ───────────────────────────────────────────────────────────────
  const applyWarp = async () => {
    const img = imgRef.current
    if (!img || corners.length < 4 || applying) return
    setApplying(true)
    const s = scaleRef.current
    const naturalCorners = corners.map(c => ({ x: c.x / s, y: c.y / s }))
    console.log('[warp] scale:', s, 'natural img:', img.naturalWidth, 'x', img.naturalHeight)
    console.log('[warp] corners natural:', naturalCorners)
    try {
      const blob = await warpCard(img, naturalCorners)
      onResult(blob)
    } catch {
      setApplying(false)
      onFallback()
    }
  }

  const resetZoom = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setZoom(1)
    setPan({ x: canvas.width / 2, y: canvas.height / 2 })
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.96)', zIndex: 999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '12px 16px 20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 13, margin: 0, textAlign: 'center' }}>
          {!applying && status === 'detecting' && 'Analyse en cours…'}
          {!applying && status === 'found'     && 'Carte détectée — ajustez les coins si besoin'}
          {!applying && status === 'notfound'  && 'Non détectée — placez les coins sur la carte'}
          {applying  && 'Recadrage en cours…'}
        </p>
        {status === 'detecting' && !applying && (
          <button onClick={() => setStatus('notfound')}
            style={{ padding: '4px 12px', background: 'rgba(255,255,255,0.15)', color: 'white', border: 'none', borderRadius: 20, fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Passer ✕
          </button>
        )}
      </div>

      <canvas
        ref={canvasRef}
        style={{ maxWidth: '100%', maxHeight: '50vh', borderRadius: 8, touchAction: 'none', display: 'block', cursor: dragging !== null ? 'grabbing' : isPanning.current ? 'grab' : 'crosshair' }}
        onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
        onWheel={onWheel}
        onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}
      />

      {/* Zoom slider + bouton rotation */}
      {corners.length === 4 && !applying && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, width: '100%', maxWidth: 420 }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input type="range" min="100" max="800" value={Math.round(zoom * 100)}
            onChange={e => setZoom(Number(e.target.value) / 100)}
            style={{ flex: 1, accentColor: '#00e5ff', height: 4, cursor: 'pointer' }}
          />
          <button onClick={resetZoom}
            style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.5)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', whiteSpace: 'nowrap' }}>
            {Math.round(zoom * 100)}% ↺
          </button>
          <button onClick={handleRotate}
            title="Tourner de 45°"
            style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', color: 'rgba(255,255,255,0.7)', lineHeight: 1 }}>
            ↻
          </button>
        </div>
      )}

      {corners.length === 4 && !applying && (
        <div style={{ display: 'flex', gap: 10, marginTop: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
          {['Haut-gauche','Haut-droit','Bas-droit','Bas-gauche'].map((label, i) => (
            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.38)' }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: HANDLE_COLORS[i], display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 12, width: '100%', maxWidth: 420, boxSizing: 'border-box' }}>
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
