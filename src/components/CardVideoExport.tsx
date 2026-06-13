'use client'
import { useRef, useState } from 'react'
import { useLang } from '@/lib/LangContext'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

interface Props {
  card: Card
  accent: string
  onClose: () => void
}

export default function CardVideoExport({ card, accent, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [recording, setRecording] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)
  const [videoUrl, setVideoUrl] = useState<string | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [format, setFormat] = useState<'webm' | 'mp4'>('webm')
  const { lang } = useLang()

  const DURATION = 6000
  const FPS = 60

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => {
        const img2 = new Image()
        img2.onload = () => resolve(img2)
        img2.onerror = () => resolve(img2)
        img2.src = src
      }
      img.src = src
    })

  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    frontImg: HTMLImageElement,
    backImg: HTMLImageElement,
    p: number
  ) => {
    const W = ctx.canvas.width
    const H = ctx.canvas.height
    const isDark = theme === 'dark'

    // Fond
    const grad = ctx.createLinearGradient(0, 0, W, H)
    if (isDark) { grad.addColorStop(0, '#0a0a1a'); grad.addColorStop(1, '#1a1a3a') }
    else { grad.addColorStop(0, '#f0f4ff'); grad.addColorStop(1, '#e8ecff') }
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Halo
    ctx.save()
    ctx.globalAlpha = isDark ? 0.15 : 0.08
    const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6)
    glow.addColorStop(0, accent); glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H)
    ctx.restore()

    // Carte
    const angle = p * Math.PI * 2
    const scaleX = Math.cos(angle)
    const showBack = scaleX < 0
    const CARD_W = 600, CARD_H = 840
    const cardW = CARD_W * Math.abs(scaleX)

    if (cardW > 2) {
      ctx.save()
      ctx.translate(W / 2, H / 2 - 80)
      ctx.shadowColor = accent
      ctx.shadowBlur = 50 * Math.abs(scaleX)
      ctx.drawImage(showBack ? backImg : frontImg, -cardW / 2, -CARD_H / 2, cardW, CARD_H)
      if (Math.abs(scaleX) > 0.1) {
        const glowPos = (Math.sin(angle) + 1) / 2
        const shine = ctx.createLinearGradient(-cardW / 2 + cardW * glowPos, -CARD_H / 2, -cardW / 2 + cardW * glowPos + 100, CARD_H / 2)
        shine.addColorStop(0, 'rgba(255,255,255,0)')
        shine.addColorStop(0.5, `rgba(255,255,255,${isDark ? 0.18 : 0.3})`)
        shine.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = shine; ctx.fillRect(-cardW / 2, -CARD_H / 2, cardW, CARD_H)
      }
      ctx.restore()
    }

    // Zone infos
    const infoY = H / 2 + 840 / 2 - 40
    const infoH = H - infoY
    ctx.save(); ctx.globalAlpha = isDark ? 0.9 : 0.92
    ctx.fillStyle = isDark ? '#0d0d1f' : '#ffffff'
    ctx.fillRect(0, infoY, W, infoH); ctx.restore()
    ctx.fillStyle = accent; ctx.fillRect(0, infoY, W, 3)

    // Nom
    ctx.fillStyle = isDark ? 'white' : '#121212'
    ctx.font = `bold ${Math.round(W * 0.042)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(card.n, W / 2, infoY + 44)

    // Variation
    if (card.v) {
      ctx.fillStyle = accent
      ctx.font = `600 ${Math.round(W * 0.028)}px Inter, sans-serif`
      ctx.fillText(card.v, W / 2, infoY + 76)
    }

    // Infos secondaires
    ctx.fillStyle = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)'
    ctx.font = `${Math.round(W * 0.024)}px Inter, sans-serif`
    const info2 = [card.t, card.y, `${card.br} ${card.s}`].filter(Boolean).join(' · ')
    ctx.fillText(info2, W / 2, infoY + (card.v ? 104 : 76))

    // Tags
    const tags: { label: string; color: string }[] = []
    if (card.rc) tags.push({ label: 'RC', color: '#e67e22' })
    if (card.auto) tags.push({ label: 'AUTO', color: '#2e7d32' })
    if (card.num) tags.push({ label: `/${card.num}`, color: '#7b1fa2' })
    if (card.patch) tags.push({ label: 'PATCH', color: '#1976d2' })
    if (tags.length > 0) {
      const tagW = 72, totalW = tags.length * (tagW + 8) - 8
      let tagX = W / 2 - totalW / 2
      const tagY = infoY + (card.v ? 118 : 90)
      tags.forEach(tag => {
        ctx.fillStyle = tag.color; ctx.beginPath()
        ctx.roundRect(tagX, tagY, tagW, 24, 4); ctx.fill()
        ctx.fillStyle = 'white'
        ctx.font = `bold ${Math.round(W * 0.022)}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(tag.label, tagX + tagW / 2, tagY + 16)
        tagX += tagW + 8
      })
    }

    // Logo
    ctx.fillStyle = accent
    ctx.font = `bold ${Math.round(W * 0.03)}px Inter, sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText('Memorabilius', W - 20, H - 14)
  }

  const startRecording = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setRecording(true); setProgress(0); setDone(false); setVideoUrl(null)
    const ctx = canvas.getContext('2d')!
    const frontImg = await loadImage(card.f)
    const backImg = await loadImage(card.b || card.f)
    const mimeType = format === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')
      ? 'video/mp4' : 'video/webm;codecs=vp9'
    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000 })
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType })
      setVideoUrl(URL.createObjectURL(blob)); setDone(true); setRecording(false)
    }
    recorder.start()
    const startTime = performance.now()
    const animate = (now: number) => {
      const p = Math.min((now - startTime) / DURATION, 1)
      setProgress(Math.round(p * 100))
      drawFrame(ctx, frontImg, backImg, p)
      if (p < 1) requestAnimationFrame(animate)
      else recorder.stop()
    }
    requestAnimationFrame(animate)
  }

  const download = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `${card.n.replace(/\s+/g, '_')}_memorabilius.${format}`
    a.click()
  }

  const btnStyle = (active: boolean) => ({
    padding: '8px 18px', border: 'none', borderRadius: 20, cursor: 'pointer',
    fontWeight: 700, fontSize: 13,
    background: active ? accent : 'rgba(255,255,255,0.1)',
    color: active ? 'white' : 'rgba(255,255,255,0.6)',
  })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d1f', borderRadius: 20, padding: 30, maxWidth: 520, width: '100%', textAlign: 'center', border: `1px solid ${accent}` }}>
        <h2 style={{ color: 'white', fontWeight: 900, marginBottom: 6 }}>
          🎬 {lang === 'fr' ? 'Exporter en vidéo' : 'Export as video'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, marginBottom: 20 }}>
          {card.n}{card.v ? ` — ${card.v}` : ''}
        </p>

        {!recording && (
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>{lang === 'fr' ? 'Thème' : 'Theme'}</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={btnStyle(theme === 'dark')} onClick={() => setTheme('dark')}>🌙 {lang === 'fr' ? 'Sombre' : 'Dark'}</button>
                <button style={btnStyle(theme === 'light')} onClick={() => setTheme('light')}>☀️ {lang === 'fr' ? 'Clair' : 'Light'}</button>
              </div>
            </div>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', fontWeight: 700 }}>Format</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button style={btnStyle(format === 'webm')} onClick={() => setFormat('webm')}>WebM</button>
                <button style={btnStyle(format === 'mp4')} onClick={() => setFormat('mp4')}>MP4</button>
              </div>
            </div>
          </div>
        )}

        <canvas ref={canvasRef} width={900} height={1300} style={{ width: '100%', maxWidth: 260, borderRadius: 12, display: 'block', margin: '0 auto 20px', border: `1px solid ${accent}33` }} />

        {recording && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, height: 8, overflow: 'hidden' }}>
              <div style={{ background: accent, height: '100%', width: `${progress}%`, transition: '0.1s', borderRadius: 10 }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 8 }}>{progress}%</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!recording && !done && (
            <button onClick={startRecording} style={{ background: accent, color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}>
              ▶ {lang === 'fr' ? 'Générer la vidéo' : 'Generate video'}
            </button>
          )}
          {done && videoUrl && (
            <>
              <button onClick={download} style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}>
                ⬇️ {lang === 'fr' ? `Télécharger (.${format})` : `Download (.${format})`}
              </button>
              <button onClick={startRecording} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                🔄 {lang === 'fr' ? 'Refaire' : 'Redo'}
              </button>
            </>
          )}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.5)', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            {lang === 'fr' ? 'Fermer' : 'Close'}
          </button>
        </div>

        {done && format === 'webm' && (
          <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 14, lineHeight: 1.5 }}>
            💡 {lang === 'fr' ? 'Convertir en MP4 gratuitement sur cloudconvert.com' : 'Convert to MP4 for free on cloudconvert.com'}
          </p>
        )}
      </div>
    </div>
  )
}
