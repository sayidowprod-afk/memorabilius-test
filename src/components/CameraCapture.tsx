'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

interface FrameRect { x: number; y: number; w: number; h: number }

interface Props {
  onCapture: (blob: Blob, frameRect: FrameRect) => void
  onClose: () => void
  ratio?: number
}

export default function CameraCapture({ onCapture, onClose, ratio }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: false,
    }).then(stream => {
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setReady(true)
      }
    }).catch(() => setError('Caméra non accessible'))

    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  const capture = () => {
    const video = videoRef.current
    if (!video) return

    const vw = video.videoWidth
    const vh = video.videoHeight
    const dw = video.clientWidth
    const dh = video.clientHeight

    // Cadre overlay : min(78vw, 56vh) × ratio carte — centré
    let frameW = Math.min(dw * 0.78, dh * 0.56 * CARD_RATIO)
    let frameH = frameW / CARD_RATIO
    const frameX = (dw - frameW) / 2
    const frameY = (dh - frameH) / 2

    // Mapping display → video naturelle
    // La vidéo est object-fit:cover → calcule le crop réel
    const videoAspect = vw / vh
    const displayAspect = dw / dh
    let srcX = 0, srcY = 0, srcW = vw, srcH = vh
    if (videoAspect > displayAspect) {
      srcW = vh * displayAspect
      srcX = (vw - srcW) / 2
    } else {
      srcH = vw / displayAspect
      srcY = (vh - srcH) / 2
    }
    const scaleX = srcW / dw
    const scaleY = srcH / dh

    // Zone du cadre en coordonnées vidéo naturelle (avec 6% de padding)
    const PAD = 0.06
    const fx = srcX + frameX * scaleX
    const fy = srcY + frameY * scaleY
    const fw = frameW * scaleX
    const fh = frameH * scaleY
    const frameRect: FrameRect = {
      x: Math.max(0, fx - fw * PAD),
      y: Math.max(0, fy - fh * PAD),
      w: Math.min(vw, fw * (1 + PAD * 2)),
      h: Math.min(vh, fh * (1 + PAD * 2)),
    }

    // Canvas à pleine résolution vidéo
    const canvas = document.createElement('canvas')
    canvas.width = vw
    canvas.height = vh
    canvas.getContext('2d')!.drawImage(video, 0, 0, vw, vh)

    streamRef.current?.getTracks().forEach(t => t.stop())

    canvas.toBlob(blob => {
      if (blob) onCapture(blob, frameRect)
    }, 'image/jpeg', 0.92)
  }

  const CARD_RATIO = ratio ?? (2.5 / 3.5)

  const content = (
    <div style={{ position: 'fixed', inset: 0, background: 'black', zIndex: 9999, display: 'flex', flexDirection: 'column' }}>
      {error ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white', gap: 16 }}>
          <p style={{ fontSize: 16 }}>{error}</p>
          <button onClick={onClose} style={{ padding: '10px 24px', background: 'white', color: 'black', border: 'none', borderRadius: 8, fontWeight: 700, cursor: 'pointer' }}>Fermer</button>
        </div>
      ) : (
        <>
          {/* Vidéo */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />

          {/* Overlay sombre avec découpe */}
          {ready && (
            <OverlayMask cardRatio={CARD_RATIO} />
          )}

          {/* Boutons */}
          <div style={{ position: 'absolute', bottom: 40, left: 0, right: 0, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 32 }}>
            <button onClick={onClose}
              style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,255,255,0.2)', border: '2px solid white', color: 'white', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              ✕
            </button>
            <button onClick={capture} disabled={!ready}
              style={{ width: 72, height: 72, borderRadius: '50%', background: ready ? 'white' : '#666', border: '4px solid rgba(255,255,255,0.5)', cursor: ready ? 'pointer' : 'default', boxShadow: '0 0 0 3px white' }}>
            </button>
            <div style={{ width: 48 }} />
          </div>

          {!ready && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <p style={{ color: 'white', fontSize: 14 }}>Chargement…</p>
            </div>
          )}
        </>
      )}
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(content, document.body) : null
}

function OverlayMask({ cardRatio }: { cardRatio: number }) {
  // Calcule la taille du cadre en CSS pur (sans JS) via aspect-ratio
  // Le cadre prend 80% de la largeur ou 70% de la hauteur (le plus petit)
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* Fond sombre via box-shadow géant sur le cadre */}
      <div style={{
        position: 'relative',
        width: 'min(78vw, 56vh)',
        aspectRatio: `${cardRatio}`,
        borderRadius: 10,
        boxShadow: '0 0 0 200vmax rgba(0,0,0,0.60)',
        border: '2px solid rgba(255,255,255,0.6)',
        zIndex: 1,
      }}>
        {/* Coins cyan */}
        {[
          { top: -3, left: -3, borderTop: '4px solid #00e5ff', borderLeft: '4px solid #00e5ff' },
          { top: -3, right: -3, borderTop: '4px solid #00e5ff', borderRight: '4px solid #00e5ff' },
          { bottom: -3, right: -3, borderBottom: '4px solid #00e5ff', borderRight: '4px solid #00e5ff' },
          { bottom: -3, left: -3, borderBottom: '4px solid #00e5ff', borderLeft: '4px solid #00e5ff' },
        ].map((s, i) => (
          <div key={i} style={{ position: 'absolute', width: 24, height: 24, borderRadius: 2, ...s }} />
        ))}
        <p style={{
          position: 'absolute', bottom: -36, left: 0, right: 0,
          textAlign: 'center', color: 'rgba(255,255,255,0.8)',
          fontSize: 13, fontWeight: 600, margin: 0, whiteSpace: 'nowrap',
        }}>
          Alignez la carte dans le cadre
        </p>
      </div>
    </div>
  )
}
