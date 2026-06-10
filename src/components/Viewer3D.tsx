'use client'
import { useRef, useCallback, useEffect } from 'react'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

export default function Viewer3D({ popup, accent, onClose, getTags }: {
  popup: Card
  accent: string
  onClose: () => void
  getTags: (d: Card) => React.ReactNode
}) {
  const rotX = useRef(0)
  const rotY = useRef(0)
  const scale = useRef(1)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const lastTap = useRef(0)
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
    scale.current = 1
    applyTransform()
  }, [applyTransform])

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
    rotY.current += dx * 0.4
    rotX.current -= dy * 0.4
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const onMouseUp = useCallback(() => { isDragging.current = false }, [])

  const onDoubleClick = useCallback(() => { reset() }, [reset])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    scale.current = Math.min(Math.max(0.5, scale.current - e.deltaY * 0.001), 4)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const touch1 = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      const now = Date.now()
      if (now - lastTap.current < 300) reset()
      lastTap.current = now
    } else if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
    }
  }, [reset])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touch1.current.x
      const dy = e.touches[0].clientY - touch1.current.y
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      rotY.current += dx * 0.4
      rotX.current -= dy * 0.4
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    } else if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      scale.current = Math.min(Math.max(0.5, scale.current * (dist / lastDist.current)), 4)
      lastDist.current = dist
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(applyTransform)
    }
  }, [applyTransform])

  useEffect(() => {
    const prevent = (e: Event) => { if (isDragging.current) e.preventDefault() }
    document.addEventListener('selectstart', prevent)
    document.addEventListener('mouseup', () => { isDragging.current = false })
    return () => {
      document.removeEventListener('selectstart', prevent)
      cancelAnimationFrame(rafRef.current)
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, width: '100%', height: '100%',
      background: '#fff', zIndex: 9999999, display: 'flex',
      overflow: 'hidden',
    }}>
      <style>{`
        .viewer-layout { display: flex; flex-direction: row; width: 100%; height: 100%; overflow: hidden; }
        .viewer-zone { flex: 1.2; display: flex; align-items: center; justify-content: center; background: #f8f8f8; perspective: 2000px; cursor: grab; user-select: none; -webkit-user-select: none; touch-action: none; overflow: hidden; position: relative; }
        .viewer-info { flex: 0.8; padding: 24px; display: flex; flex-direction: column; justify-content: center; background: white; overflow-y: auto; min-width: 0; }
        @media (max-width: 600px) {
          .viewer-layout { flex-direction: column; }
          .viewer-zone { flex: 0 0 62vh !important; min-height: 0; }
          .viewer-info { flex: 1; padding: 12px 14px; justify-content: flex-start; overflow-y: auto; }
          .viewer-info h2 { font-size: 1.1rem !important; margin: 3px 0 !important; }
          .viewer-info .v-sub { font-size: 0.85rem !important; margin-bottom: 6px !important; }
          .viewer-hint { display: none !important; }
        }
      `}</style>
      <button onClick={onClose} style={{
        position: 'absolute', top: 12, right: 12, fontSize: 18, cursor: 'pointer',
        background: 'rgba(255,255,255,0.95)', width: 32, height: 32, borderRadius: '50%',
        border: '1px solid #eee', display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 10001, lineHeight: 1, flexShrink: 0,
      }}>×</button>

      <div className="viewer-layout">
        {/* Zone 3D */}
        <div
          className="viewer-zone"
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
            <div style={{ transform: 'scale(0.35)', transformOrigin: 'center center' }}>
            <div ref={cardRef} style={{
              width: 1000, height: 1400,
              position: 'relative',
              transformStyle: 'preserve-3d',
              willChange: 'transform',
            }}>
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                <img src={popup.f} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} alt={popup.n} />
              </div>
              <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                <img src={popup.b} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} alt={popup.n} />
              </div>
            </div>
            </div>
          </div>
          <p className="viewer-hint" style={{ position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#bbb', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Glisser · Scroll pour zoomer · Double-clic pour reset
          </p>
        </div>

        {/* Infos */}
        <div className="viewer-info">
          <div style={{ color: accent, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>{popup.t}</div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: '4px 0' }}>{popup.n}</h2>
          <div className="v-sub" style={{ fontSize: '0.95rem', color: accent, fontWeight: 700, marginBottom: 8, fontStyle: 'italic' }}>{popup.v}</div>
          {getTags(popup)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: '1px solid #eee', marginTop: 10, paddingTop: 10 }}>
            {[['Année', popup.y], ['Numérotation', popup.num || 'N/A'], ['Grade', popup.g], ['Collection', `${popup.br} ${popup.s}`]].map(([l, v]) => (
              <div key={l}>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: '#999', textTransform: 'uppercase' }}>{l}</label>
                <span style={{ fontSize: 12, fontWeight: 700 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
