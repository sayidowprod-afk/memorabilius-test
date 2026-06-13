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
  const { lang } = useLang()

  const DURATION = 6000 // 6 secondes pour un tour complet
  const FPS = 60
  const CARD_W = 600
  const CARD_H = 840

  const loadImage = (src: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => resolve(img)
      img.onerror = () => {
        // Fallback si CORS bloque
        const img2 = new Image()
        img2.onload = () => resolve(img2)
        img2.onerror = reject
        img2.src = src
      }
      img.src = src
    })

  const drawFrame = (
    ctx: CanvasRenderingContext2D,
    frontImg: HTMLImageElement,
    backImg: HTMLImageElement,
    progress: number // 0 à 1
  ) => {
    const W = ctx.canvas.width
    const H = ctx.canvas.height

    // Fond dégradé
    const grad = ctx.createLinearGradient(0, 0, W, H)
    grad.addColorStop(0, '#0a0a1a')
    grad.addColorStop(1, '#1a1a3a')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, W, H)

    // Particules / effet de lumière
    ctx.save()
    ctx.globalAlpha = 0.15
    const glow = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6)
    glow.addColorStop(0, accent)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(0, 0, W, H)
    ctx.restore()

    // Animation rotation 3D simulée avec scaleX
    const angle = progress * Math.PI * 2 // tour complet
    const scaleX = Math.cos(angle)
    const showBack = scaleX < 0

    const cardX = W / 2
    const cardY = H / 2 - 60
    const cardW = CARD_W * Math.abs(scaleX)
    const cardH = CARD_H

    if (cardW > 2) {
      ctx.save()
      ctx.translate(cardX, cardY)

      // Ombre portée
      ctx.shadowColor = accent
      ctx.shadowBlur = 40 * Math.abs(scaleX)

      // Dessiner la carte
      ctx.drawImage(
        showBack ? backImg : frontImg,
        -cardW / 2, -cardH / 2,
        cardW, cardH
      )

      // Reflet lumineux
      if (Math.abs(scaleX) > 0.1) {
        const glowPos = (Math.sin(angle) + 1) / 2
        const shine = ctx.createLinearGradient(
          -cardW / 2 + cardW * glowPos, -cardH / 2,
          -cardW / 2 + cardW * glowPos + 80, cardH / 2
        )
        shine.addColorStop(0, 'rgba(255,255,255,0)')
        shine.addColorStop(0.5, 'rgba(255,255,255,0.15)')
        shine.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.fillStyle = shine
        ctx.fillRect(-cardW / 2, -cardH / 2, cardW, cardH)
      }

      ctx.restore()
    }

    // Zone infos en bas
    const infoY = H / 2 + cardH / 2 - 40
    const infoH = H - infoY

    // Fond info
    ctx.save()
    ctx.globalAlpha = 0.85
    ctx.fillStyle = '#0d0d1f'
    ctx.fillRect(0, infoY, W, infoH)
    ctx.restore()

    // Ligne accent
    ctx.fillStyle = accent
    ctx.fillRect(0, infoY, W, 3)

    // Nom joueur
    ctx.fillStyle = 'white'
    ctx.font = `bold ${Math.round(W * 0.042)}px Inter, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(card.n, W / 2, infoY + infoH * 0.3)

    // Infos secondaires
    ctx.fillStyle = 'rgba(255,255,255,0.6)'
    ctx.font = `${Math.round(W * 0.028)}px Inter, sans-serif`
    const info2 = [card.t, card.y, `${card.br} ${card.s}`].filter(Boolean).join(' · ')
    ctx.fillText(info2, W / 2, infoY + infoH * 0.55)

    // Tags
    const tags: { label: string; color: string }[] = []
    if (card.rc) tags.push({ label: 'RC', color: '#e67e22' })
    if (card.auto) tags.push({ label: 'AUTO', color: '#2e7d32' })
    if (card.num) tags.push({ label: `/${card.num}`, color: '#7b1fa2' })
    if (card.patch) tags.push({ label: 'PATCH', color: '#1976d2' })

    if (tags.length > 0) {
      const tagW = 70
      const totalW = tags.length * (tagW + 8) - 8
      let tagX = W / 2 - totalW / 2
      tags.forEach(tag => {
        ctx.fillStyle = tag.color
        ctx.beginPath()
        ctx.roundRect(tagX, infoY + infoH * 0.68, tagW, 22, 4)
        ctx.fill()
        ctx.fillStyle = 'white'
        ctx.font = `bold ${Math.round(W * 0.022)}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.fillText(tag.label, tagX + tagW / 2, infoY + infoH * 0.68 + 15)
        tagX += tagW + 8
      })
    }

    // Logo Memorabilius
    ctx.fillStyle = accent
    ctx.font = `bold ${Math.round(W * 0.032)}px Inter, sans-serif`
    ctx.textAlign = 'right'
    ctx.fillText('Memorabilius', W - 20, H - 12)
  }

  const startRecording = async () => {
    const canvas = canvasRef.current
    if (!canvas) return
    setRecording(true)
    setProgress(0)
    setDone(false)
    setVideoUrl(null)

    const ctx = canvas.getContext('2d')!

    // Charger les images
    let frontImg: HTMLImageElement
    let backImg: HTMLImageElement
    try {
      frontImg = await loadImage(card.f)
      backImg = await loadImage(card.b || card.f)
    } catch {
      // Images placeholder si CORS
      frontImg = new Image()
      frontImg.src = card.f
      backImg = frontImg
    }

    const stream = canvas.captureStream(FPS)
    const recorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 8000000, // 8 Mbps - haute qualité
    })

    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: 'video/webm' })
      const url = URL.createObjectURL(blob)
      setVideoUrl(url)
      setDone(true)
      setRecording(false)
    }

    recorder.start()

    const startTime = performance.now()
    const animate = (now: number) => {
      const elapsed = now - startTime
      const p = Math.min(elapsed / DURATION, 1)
      setProgress(Math.round(p * 100))
      drawFrame(ctx, frontImg, backImg, p)
      if (p < 1) {
        requestAnimationFrame(animate)
      } else {
        recorder.stop()
      }
    }
    requestAnimationFrame(animate)
  }

  const download = () => {
    if (!videoUrl) return
    const a = document.createElement('a')
    a.href = videoUrl
    a.download = `${card.n.replace(/\s+/g, '_')}_memorabilius.webm`
    a.click()
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d1f', borderRadius: 20, padding: 30, maxWidth: 500, width: '100%', textAlign: 'center', border: `1px solid ${accent}` }}>
        <h2 style={{ color: 'white', fontWeight: 900, marginBottom: 8 }}>
          {lang === 'fr' ? '🎬 Exporter en vidéo' : '🎬 Export as video'}
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, marginBottom: 20 }}>
          {card.n} — {lang === 'fr' ? 'Rotation 360° avec infos' : '360° rotation with info'}
        </p>

        {/* Canvas de rendu */}
        <canvas ref={canvasRef} width={900} height={1300} style={{ width: '100%', maxWidth: 280, borderRadius: 12, display: 'block', margin: '0 auto 20px', border: `1px solid ${accent}` }} />

        {/* Barre de progression */}
        {recording && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, height: 8, overflow: 'hidden' }}>
              <div style={{ background: accent, height: '100%', width: `${progress}%`, transition: '0.1s', borderRadius: 10 }} />
            </div>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>{progress}%</p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          {!recording && !done && (
            <button onClick={startRecording} style={{ background: accent, color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}>
              {lang === 'fr' ? '▶ Générer la vidéo' : '▶ Generate video'}
            </button>
          )}
          {done && videoUrl && (
            <>
              <button onClick={download} style={{ background: '#2e7d32', color: 'white', border: 'none', borderRadius: 10, padding: '12px 24px', fontWeight: 800, cursor: 'pointer', fontSize: 15 }}>
                ⬇️ {lang === 'fr' ? 'Télécharger (.webm)' : 'Download (.webm)'}
              </button>
              <button onClick={startRecording} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                🔄 {lang === 'fr' ? 'Refaire' : 'Redo'}
              </button>
            </>
          )}
          <button onClick={onClose} style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)', border: 'none', borderRadius: 10, padding: '12px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
            {lang === 'fr' ? 'Fermer' : 'Close'}
          </button>
        </div>

        {done && (
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 16, lineHeight: 1.5 }}>
            {lang === 'fr' ? '💡 Le format .webm est lisible sur tous les navigateurs et convertible en MP4 gratuitement sur cloudconvert.com' : '💡 .webm format is readable on all browsers and convertible to MP4 for free on cloudconvert.com'}
          </p>
        )}
      </div>
    </div>
  )
}
