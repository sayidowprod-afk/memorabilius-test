'use client'
import { useRef, useCallback, useEffect } from 'react'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

const BASE_SCALE = 1.0 // pas de zoom artificiel qui dégrade la qualité

export default function Viewer3D({ popup, accent, onClose, getTags }: {
  popup: Card
  accent: string
  onClose: () => void
  getTags: (d: Card) => React.ReactNode
}) {
  const rotX = useRef(0)
  const rotY = useRef(0)
  const scale = useRef(BASE_SCALE)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const lastTap = useRef(0)
  const isZoomed = useRef(false)
  const cardRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)

  const applyTransform = useCallback(() => {
    if (cardRef.current) {
      cardRef.current.style.transform = `rotateX(${rotX.current}deg) rotateY(${rotY.current}deg)`
    }
    if (wrapRef.current) {
      wrapRef.current.style.transform = `scale(${scale.current})`
    }
  }, [])

  const reset = useCallback(() => {
    rotX.current = 0
    rotY.current = 0
    scale.current = BASE_SCALE
    isZoomed.current = false
    applyTransform()
  }, [applyTransform])

  // Double clic = toggle zoom / position de base
  const onDoubleClick = useCallback(() => {
    if (isZoomed.current) {
      // Dézoom
      scale.current = BASE_SCALE
      rotX.current = 0
      rotY.current = 0
      isZoomed.current = false
    } else {
      // Zoom
      scale.current = BASE_SCALE * 1.8
      isZoomed.current = true
    }
    applyTransform()
  }, [applyTransform])

  // Souris
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    lastX.current = e.clientX
    lastY.current = e.clientY
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return
    e.preventDefault()
    const dx = e.clientX - lastX.current
    const dy = e.clientY - lastY.current
    lastX.current = e.clientX
    lastY.current = e.clientY
    rotY.current += dx * 0.35
    rotX.current -= dy * 0.35
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const onMouseUp = useCallback(() => {
    isDragging.current = false
  }, [])

  // Molette
  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    scale.current = Math.min(Math.max(0.5, scale.current - e.deltaY * 0.001))
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  // Touch
  const touch1 = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      const now = Date.now()
      if (now - lastTap.current < 300) onDoubleClick()
      lastTap.current = now
    } else if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
    }
  }, [onDoubleClick])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touch1.current.x
      const dy = e.touches[0].clientY - touch1.current.y
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      rotY.current += dx * 0.35
      rotX.current -= dy * 0.35
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      scale.current = Math.min(Math.max(0.3, scale.current * (dist / lastDist.current)), 5)
      lastDist.current = dist
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    }
  }, [applyTransform])

  useEffect(() => {
    // Position initiale
    applyTransform()
    const prevent = (e: Event) => { if (isDragging.current) e.preventDefault() }
    document.addEventListener('selectstart', prevent)
    document.addEventListener('mouseup', () => { isDragging.current = false })
    return () => {
      document.removeEventListener('selectstart', prevent)
      cancelAnimationFrame(rafRef.current)
    }
  }, [applyTransform])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: '#fff', zIndex: 9999999, display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @media (min-width: 600px) {
          .viewer3d-inner { flex-direction: row !important; }
          .viewer3d-zone { flex: 1.2 !important; height: 100% !important; }
          .viewer3d-info { flex: 0.8 !important; height: 100% !important; }
        }
        @media (max-width: 599px) {
          .viewer3d-zone { flex: 0 0 55vh !important; }
          .viewer3d-info { flex: 1 !important; overflow-y: auto !important; }
          .msg-back { display: block !important; }
        }
        .msg-back { display: none; }
        @media (max-width: 768px) { .msg-back { display: block !important; } }
      `}</style>
      <button onClick={onClose} style={{
        position: 'absolute', top: 12, right: 12, fontSize: 20, cursor: 'pointer',
        background: 'rgba(255,255,255,0.9)', width: 36, height: 36, borderRadius: '50%',
        border: '1px solid #eee', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 10001,
      }}>×</button>

      <div className="viewer3d-inner" style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>

      {/* Zone 3D */}
      <div
        className="viewer3d-zone"
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#f8f8f8', perspective: 2000,
          cursor: isDragging.current ? 'grabbing' : 'grab',
          userSelect: 'none', WebkitUserSelect: 'none',
          touchAction: 'none', overflow: 'hidden', position: 'relative',
        }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => { isDragging.current = false }}
      >
        <div ref={wrapRef} style={{ willChange: 'transform' }}>
          <div ref={cardRef} style={{
            width: 340, height: 476,
            position: 'relative',
            transformStyle: 'preserve-3d',
            willChange: 'transform',
          }}>
            {/* Face avant */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              borderRadius: 0,
              boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}>
              <img
                src={popup.f}
                draggable={false}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover', display: 'block',
                  imageRendering: 'auto',
                } as React.CSSProperties}
                alt={popup.n}
              />
            </div>
            {/* Face arrière */}
            <div style={{
              position: 'absolute', inset: 0,
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: 0,
              boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
              overflow: 'hidden',
            }}>
              <img
                src={popup.b}
                draggable={false}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover', display: 'block',
                  imageRendering: 'auto',
                } as React.CSSProperties}
                alt={popup.n}
              />
            </div>
          </div>
        </div>
        <p style={{
          position: 'absolute', bottom: 16,
          left: '50%', transform: 'translateX(-50%)',
          fontSize: 11, color: '#bbb', whiteSpace: 'nowrap',
          pointerEvents: 'none',
        }}>
          Glisser · Scroll pour zoomer · Double-clic pour zoom/reset
        </p>
      </div>

      {/* Infos */}
      <div className="viewer3d-info" style={{ padding: 24, display: 'flex', flexDirection: 'column', justifyContent: 'center', background: 'white', overflowY: 'auto' }}>
        <div style={{ color: accent, fontWeight: 900, fontSize: 11, textTransform: 'uppercase' }}>{popup.t}</div>
        <h2 style={{ fontSize: '1.8rem', fontWeight: 900, margin: '5px 0' }}>{popup.n}</h2>
        <div style={{ fontSize: '1.1rem', color: accent, fontWeight: 700, marginBottom: 10, fontStyle: 'italic' }}>{popup.v}</div>
        {getTags(popup)}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 15, borderTop: '1px solid #eee', marginTop: 15, paddingTop: 15 }}>
          {[['Année', popup.y], ['Numérotation', popup.num || 'N/A'], ['Grade', popup.g], ['Collection', `${popup.br} ${popup.s}`]].map(([l, v]) => (
            <div key={l}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>{l}</label>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      </div>
    </div>
  )
}
