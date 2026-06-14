'use client'
import { useRef, useState, useEffect } from 'react'
import { useLang } from '@/lib/LangContext'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}
interface Props { card: Card; accent: string; onClose: () => void }

const VIDEO_FORMATS = {
  default: { w: 900,  h: 1300, label: 'Défaut',  ratio: '9:13' },
  reel:    { w: 1080, h: 1920, label: 'Reel',    ratio: '9:16' },
  square:  { w: 1080, h: 1080, label: 'Carré',   ratio: '1:1'  },
} as const
type VideoFormat = keyof typeof VIDEO_FORMATS

// Particules stables (déterministes)
const PARTICLES = Array.from({ length: 50 }, (_, i) => ({
  x: (i * 137.508) % 1,
  y: (i * 97.3) % 1,
  r: 0.8 + (i % 4) * 0.7,
  speed: 0.05 + (i % 6) * 0.02,
  phase: i * 0.73,
}))

export default function CardVideoExport({ card, accent, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [codec, setCodec] = useState<'webm' | 'mp4'>('webm')
  const [vfmt, setVfmt] = useState<VideoFormat>('default')
  const { lang } = useLang()

  const DURATION = 6000
  const FPS = 30
  const themeRef = useRef(theme)
  const vfmtRef = useRef(vfmt)
  themeRef.current = theme
  vfmtRef.current = vfmt

  // Sync canvas size to selected format
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = VIDEO_FORMATS[vfmt]
    canvas.width = w; canvas.height = h
  }, [vfmt])

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise(resolve => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => { const i2 = new Image(); i2.onload = () => resolve(i2); i2.onerror = () => resolve(i2); i2.src = src }
      img.src = src
    })

  const drawFrame = (ctx: CanvasRenderingContext2D, frontImg: HTMLImageElement, backImg: HTMLImageElement, p: number) => {
    const W = ctx.canvas.width
    const H = ctx.canvas.height
    const isDark = themeRef.current === 'dark'
    const ar = parseInt(accent.slice(1, 3), 16)
    const ag = parseInt(accent.slice(3, 5), 16)
    const ab = parseInt(accent.slice(5, 7), 16)

    const bgBase   = isDark ? '#06060f' : '#f0f4ff'
    const bgBot    = isDark ? '#0d0d22' : '#dde4ff'
    const infoBg   = isDark ? '#08081a' : '#ffffff'
    const textMain = isDark ? '#ffffff' : '#111111'
    const textSub  = isDark ? 'rgba(255,255,255,0.52)' : 'rgba(0,0,0,0.48)'

    // ── Fond : base sombre + halo accent en coin haut-droit ────────────────
    ctx.fillStyle = bgBase; ctx.fillRect(0, 0, W, H)
    // Halo accent rayonnant depuis le coin haut-droit
    const halo = ctx.createRadialGradient(W * 0.85, H * 0.08, 0, W * 0.85, H * 0.08, W * 1.1)
    halo.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.28 : 0.14})`)
    halo.addColorStop(0.5, `rgba(${ar},${ag},${ab},${isDark ? 0.07 : 0.04})`)
    halo.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, H)
    // Dégradé vertical subtil vers le bas
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
    bgGrad.addColorStop(0, 'rgba(0,0,0,0)'); bgGrad.addColorStop(1, bgBot + '99')
    ctx.fillStyle = bgGrad; ctx.fillRect(0, 0, W, H)

    // ── Particules ─────────────────────────────────────────────────────────
    PARTICLES.forEach(({ x, y, r, speed, phase }) => {
      const py = ((y * H - p * speed * H * 3) % H + H) % H
      const a = (isDark ? 0.05 : 0.08) + 0.03 * Math.sin(p * Math.PI * 5 + phase)
      ctx.beginPath(); ctx.arc(x * W, py, r, 0, Math.PI * 2)
      ctx.fillStyle = isDark ? `rgba(${ar},${ag},${ab + 60},${a})` : `rgba(80,80,220,${a})`
      ctx.fill()
    })

    // ── Layout dynamique ───────────────────────────────────────────────────
    const INFO_H  = Math.round(H * 0.19)   // 19% pour les infos
    const CARD_ZONE_H = H - INFO_H
    const CARD_MAX_W  = W * 0.82
    const CARD_MAX_H  = CARD_ZONE_H * 0.88
    const CARD_RATIO  = 3.5 / 2.5
    const BASE_W = Math.min(CARD_MAX_W, CARD_MAX_H / CARD_RATIO)
    const BASE_H = BASE_W * CARD_RATIO
    const CARD_CY = CARD_ZONE_H / 2

    // ── Spotlight ──────────────────────────────────────────────────────────
    const pulse = 1 + 0.07 * Math.sin(p * Math.PI * 3)
    const spot = ctx.createRadialGradient(W / 2, CARD_CY, 0, W / 2, CARD_CY, BASE_W * 0.9 * pulse)
    spot.addColorStop(0, `rgba(${ar},${ag},${ab},${isDark ? 0.18 : 0.10})`)
    spot.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = spot; ctx.fillRect(0, 0, W, H)

    // ── Animation carte ────────────────────────────────────────────────────
    const angle  = p * Math.PI * 2
    const scaleX = Math.cos(angle)
    const showBack = scaleX < 0
    const zoom   = 1 + 0.04 * Math.sin(p * Math.PI)
    const cardW  = BASE_W * Math.abs(scaleX) * zoom
    const cardH  = BASE_H * zoom

    if (cardW > 2) {
      // Reflet au sol
      const floorY = CARD_CY + BASE_H * zoom / 2
      ctx.save()
      ctx.translate(W / 2, floorY)
      ctx.transform(Math.abs(scaleX) * zoom, 0, 0, -zoom, 0, 0)
      ctx.globalAlpha = 0.16 * Math.abs(scaleX)
      ctx.drawImage(showBack ? backImg : frontImg, -BASE_W / 2, 0, BASE_W, BASE_H)
      ctx.restore()
      // Fondu reflet
      const reflFade = ctx.createLinearGradient(0, floorY, 0, floorY + BASE_H * 0.4 * zoom)
      reflFade.addColorStop(0, 'rgba(0,0,0,0)'); reflFade.addColorStop(1, bgBot)
      ctx.fillStyle = reflFade; ctx.fillRect(0, floorY, W, BASE_H * 0.4 * zoom)

      // Carte principale
      ctx.save()
      ctx.translate(W / 2, CARD_CY)
      // Ombre portée
      ctx.shadowColor = `rgba(${ar},${ag},${ab},0.5)`
      ctx.shadowBlur = 40 * zoom
      ctx.shadowOffsetY = 12
      ctx.drawImage(showBack ? backImg : frontImg, -cardW / 2, -cardH / 2, cardW, cardH)
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
      ctx.restore()
    }

    // ── Zone infos ─────────────────────────────────────────────────────────
    const infoY = H - INFO_H
    // Fondu progressif
    const fadeGrad = ctx.createLinearGradient(0, infoY - INFO_H * 0.35, 0, infoY + 10)
    fadeGrad.addColorStop(0, 'rgba(0,0,0,0)'); fadeGrad.addColorStop(1, infoBg)
    ctx.fillStyle = fadeGrad; ctx.fillRect(0, infoY - INFO_H * 0.35, W, INFO_H * 0.45)
    ctx.fillStyle = infoBg; ctx.fillRect(0, infoY + 10, W, INFO_H)

    // Ligne accent
    const lineGrad = ctx.createLinearGradient(W * 0.15, 0, W * 0.85, 0)
    lineGrad.addColorStop(0, 'rgba(0,0,0,0)')
    lineGrad.addColorStop(0.3, accent); lineGrad.addColorStop(0.7, accent)
    lineGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lineGrad; ctx.fillRect(0, infoY, W, 2)

    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    const tx = W / 2
    let ty = infoY + INFO_H * 0.11

    // Badges (en premier pour ancrer le layout)
    const tags: { label: string; color: string }[] = []
    if (card.rc)    tags.push({ label: 'RC',    color: '#e67e22' })
    if (card.auto)  tags.push({ label: 'AUTO',  color: '#2e7d32' })
    if (card.num)   tags.push({ label: card.num, color: '#7b1fa2' })
    if (card.patch) tags.push({ label: 'PATCH', color: '#1976d2' })

    const badgeFs = Math.round(W * 0.025)
    const badgeH  = Math.round(W * 0.038)
    const badgePad = Math.round(W * 0.022)

    if (tags.length > 0) {
      ctx.font = `700 ${badgeFs}px Inter, sans-serif`
      const widths = tags.map(t => ctx.measureText(t.label).width + badgePad * 2)
      const gap = Math.round(W * 0.012)
      const totalW = widths.reduce((a, b) => a + b, 0) + gap * (tags.length - 1)
      let bx = tx - totalW / 2
      tags.forEach((tag, i) => {
        const bw = widths[i]
        ctx.fillStyle = tag.color
        ctx.beginPath(); ctx.roundRect(bx, ty, bw, badgeH, 5); ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.fillText(tag.label, bx + bw / 2, ty + badgeH * 0.18)
        bx += bw + gap
      })
      ty += badgeH + Math.round(INFO_H * 0.06)
    }

    // Nom joueur
    const nameFs = Math.round(W * 0.052)
    ctx.fillStyle = textMain
    ctx.font = `800 ${nameFs}px Inter, sans-serif`
    ctx.fillText(card.n, tx, ty)
    ty += nameFs + Math.round(INFO_H * 0.04)

    // Variation
    if (card.v) {
      const varFs = Math.round(W * 0.031)
      ctx.fillStyle = accent
      ctx.font = `600 ${varFs}px Inter, sans-serif`
      ctx.fillText(card.v, tx, ty)
      ty += varFs + Math.round(INFO_H * 0.03)
    }

    // Infos secondaires
    const infoFs = Math.round(W * 0.025)
    ctx.fillStyle = textSub
    ctx.font = `400 ${infoFs}px Inter, sans-serif`
    const meta = [card.t, card.y, [card.br, card.s].filter(Boolean).join(' ')].filter(Boolean).join(' · ')
    if (meta) ctx.fillText(meta, tx, ty)

    // Logo watermark
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
    ctx.fillStyle = isDark ? `rgba(${ar},${ag},${ab},0.55)` : `rgba(${ar},${ag},${ab},0.7)`
    ctx.font = `600 ${Math.round(W * 0.026)}px Inter, sans-serif`
    ctx.fillText('memorabilius.fr', W - Math.round(W * 0.03), H - Math.round(H * 0.012))
  }

  const startRecording = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const { w, h } = VIDEO_FORMATS[vfmtRef.current]
    canvas.width = w; canvas.height = h

    setRecording(true); setProgress(0); setDone(false); setVideoUrl(null)
    const ctx = canvas.getContext('2d')!
    const [frontImg, backImg] = await Promise.all([loadImage(card.f), loadImage(card.b || card.f)])

    const mimeType = codec === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4' : 'video/webm;codecs=vp9'
    // captureStream(0) + requestFrame() : on ne capture que les frames réellement rendus
    const stream = canvas.captureStream(0)
    const videoTrack = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6_000_000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      setVideoUrl(URL.createObjectURL(new Blob(chunks, { type: mimeType })))
      setDone(true); setRecording(false)
    }
    recorder.start()

    const totalFrames = Math.ceil((DURATION / 1000) * FPS)
    let frame = 0
    const frameDur = DURATION / totalFrames
    const render = () => {
      const p = Math.min(frame / totalFrames, 1)
      setProgress(Math.round(p * 100))
      drawFrame(ctx, frontImg, backImg, p)
      videoTrack.requestFrame() // capture uniquement ce frame rendu
      frame++
      if (frame <= totalFrames) setTimeout(render, frameDur)
      else setTimeout(() => recorder.stop(), 200)
    }
    setTimeout(render, 0)
  }

  const download = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `${card.n.replace(/\s+/g, '_')}_memorabilius.${codec}`
    a.click()
  }

  const chip = (active: boolean) => ({
    padding: '7px 16px', border: 'none', borderRadius: 20, cursor: 'pointer',
    fontWeight: 700, fontSize: 13,
    background: active ? accent : 'rgba(255,255,255,0.09)',
    color: active ? '#fff' : 'rgba(255,255,255,0.55)',
    transition: '0.15s',
  })

  const { w, h } = VIDEO_FORMATS[vfmt]

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d22', borderRadius: 20, padding: 28, maxWidth: 480, width: '100%', textAlign: 'center', border: `1px solid ${accent}44` }}>

        <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 17, margin: '0 0 4px' }}>
          🎬 {lang === 'fr' ? 'Exporter en vidéo' : 'Export video'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: 12, margin: '0 0 16px' }}>
          {card.n}{card.v ? ` · ${card.v}` : ''}
        </p>

        <canvas ref={canvasRef} width={w} height={h}
          style={{ width: '100%', maxWidth: 240, height: 'auto', borderRadius: 10, display: 'block', margin: '0 auto 18px', border: `1px solid ${accent}33`, background: '#080818' }} />

        {!recording && (
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 18, flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Format</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                {(Object.entries(VIDEO_FORMATS) as [VideoFormat, typeof VIDEO_FORMATS[VideoFormat]][]).map(([key, f]) => (
                  <button key={key} style={chip(vfmt === key)} onClick={() => setVfmt(key)}>
                    {f.label} <span style={{ opacity: 0.6, fontSize: 11 }}>{f.ratio}</span>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>{lang === 'fr' ? 'Thème' : 'Theme'}</p>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button style={chip(theme === 'dark')} onClick={() => setTheme('dark')}>🌙 {lang === 'fr' ? 'Sombre' : 'Dark'}</button>
                <button style={chip(theme === 'light')} onClick={() => setTheme('light')}>☀️ {lang === 'fr' ? 'Clair' : 'Light'}</button>
              </div>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Codec</p>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                <button style={chip(codec === 'webm')} onClick={() => setCodec('webm')}>WebM</button>
                <button style={chip(codec === 'mp4')} onClick={() => setCodec('mp4')}>MP4</button>
              </div>
            </div>
          </div>
        )}

        {recording && (
          <div style={{ margin: '0 0 16px' }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 8, height: 6, overflow: 'hidden' }}>
              <div style={{ background: accent, height: '100%', width: `${progress}%`, transition: '0.1s', borderRadius: 8 }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginTop: 6 }}>{progress}%</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!recording && !done && (
            <button onClick={startRecording} style={{ background: accent, color: '#fff', border: 'none', borderRadius: 10, padding: '11px 22px', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
              ▶ {lang === 'fr' ? 'Générer' : 'Generate'}
            </button>
          )}
          {done && videoUrl && (
            <>
              <button onClick={download} style={{ background: '#2e7d32', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontWeight: 800, cursor: 'pointer', fontSize: 14 }}>
                ⬇ {lang === 'fr' ? `Télécharger (.${codec})` : `Download (.${codec})`}
              </button>
              <button onClick={startRecording} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.7)', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                🔄 {lang === 'fr' ? 'Refaire' : 'Redo'}
              </button>
              </>
            )}
            <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.4)', border: 'none', borderRadius: 10, padding: '11px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
              {lang === 'fr' ? 'Fermer' : 'Close'}
            </button>
          </div>

          {done && codec === 'webm' && (
            <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: 11, marginTop: 12, lineHeight: 1.5 }}>
              💡 {lang === 'fr' ? 'Convertir en MP4 sur cloudconvert.com' : 'Convert to MP4 at cloudconvert.com'}
            </p>
          )}
      </div>
    </div>
  )
}
