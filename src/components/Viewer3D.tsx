'use client'
import { useRef, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useLang } from '@/lib/LangContext'
import { playerSlug } from '@/lib/playerSlug'
import { useTheme } from '@/lib/ThemeContext'
import CardVideoExport from '@/components/CardVideoExport'
import CardValueModule from '@/components/CardValueModule'
import SameCardCollectors from '@/components/SameCardCollectors'
import CollectionTagSelect from '@/components/CollectionTagSelect'
import BookletViewer from '@/components/BookletViewer'

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string; card_number?: string
  auto: boolean; rc: boolean; patch: boolean; g: string
  isManuelle?: boolean; id_manuelle?: string; collection_tag?: string
  booklet?: boolean; is_horizontal?: boolean; il?: string; ir?: string
}

export default function Viewer3D({ popup, accent, onClose, onNext, onPrev, getTags, userId, userSlug, isOwner, onCollectionTagChange, onAddToMyGallery, initialAddState }: {
  popup: Card
  accent: string
  onClose: () => void
  onNext?: () => void
  onPrev?: () => void
  getTags: (d: Card) => React.ReactNode
  userId?: string
  userSlug?: string
  isOwner?: boolean
  currentUserId?: string
  onCollectionTagChange?: (card: Card, tag: string) => void
  onAddToMyGallery?: () => Promise<'added' | 'duplicate'>
  initialAddState?: 'idle' | 'added' | 'duplicate'
}) {
  const { dark } = useTheme()
  const bg = dark ? '#1a1a1a' : '#fff'
  const zoneBg = dark ? '#111' : '#f8f8f8'
  const infoBg = dark ? '#1a1a1a' : 'white'
  const textColor = dark ? '#eee' : '#111'
  const borderColor = dark ? '#2a2a2a' : '#eee'
  const metaColor = dark ? '#888' : '#999'

  const [tagInput, setTagInput] = useState(popup.collection_tag || '')
  const [tagSaving, setTagSaving] = useState(false)

  const saveTag = async () => {
    if (!onCollectionTagChange) return
    setTagSaving(true)
    await onCollectionTagChange(popup, tagInput.trim())
    setTagSaving(false)
  }

  const rotX = useRef(0)
  const rotY = useRef(0)
  const scale = useRef(1)
  const isDragging = useRef(false)
  const lastX = useRef(0)
  const lastY = useRef(0)
  const lastTap = useRef(0)
  const cardRef = useRef<HTMLDivElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const idleRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const [showVideo, setShowVideo] = useState(false)
  const [copied, setCopied] = useState(false)
  const [slabMode, setSlabMode] = useState(false)
  const [addState, setAddState] = useState<'idle' | 'loading' | 'added' | 'duplicate'>(initialAddState ?? 'idle')
  const { lang } = useLang()

  // Parse grade: "PSA 9", "BGS 9.5", or just "9" / "10" → slab info
  const gradeInfo = (() => {
    const g = popup.g?.trim()
    if (!g || g.toLowerCase() === 'raw') return null

    const psaLabels: Record<number, string> = { 10: 'GEM MT', 9: 'MINT', 8: 'NM-MT', 7: 'NM', 6: 'EX-MT', 5: 'EX', 4: 'VG-EX', 3: 'VG', 2: 'GOOD', 1: 'POOR' }
    const colors: Record<string, { top: string; text: string; accent: string }> = {
      PSA: { top: '#c8102e', text: '#fff', accent: '#e8c840' },
      BGS: { top: '#1a1a1a', text: '#e8c840', accent: '#e8c840' },
      SGC: { top: '#006633', text: '#fff', accent: '#fff' },
      CGC: { top: '#003399', text: '#fff', accent: '#fff' },
      BVG: { top: '#1a1a1a', text: '#e8c840', accent: '#e8c840' },
    }

    // "PSA 9", "BGS 9.5" etc.
    const withCompany = g.match(/^(PSA|BGS|SGC|CGC|BVG)\s*([\d.]+)$/i)
    if (withCompany) {
      const company = withCompany[1].toUpperCase()
      const num = parseFloat(withCompany[2])
      const bgsLabels: Record<number, string> = { 10: 'PRISTINE', 9.5: 'GEM MINT', 9: 'MINT PLUS', 8.5: 'NEAR MINT+', 8: 'NEAR MINT', 7: 'NEAR MINT', 6: 'EX-MT' }
      const sgcLabels: Record<number, string> = { 10: 'PRISTINE', 9.5: 'MINT+', 9: 'MINT', 8.5: 'NM-MT+', 8: 'NM-MT', 7.5: 'NM+', 7: 'NM' }
      const label = company === 'PSA' ? (psaLabels[num] || 'GRADED') : company === 'BGS' ? (bgsLabels[num] || 'GRADED') : company === 'SGC' ? (sgcLabels[num] || 'AUTHENTIC') : 'AUTHENTIC'
      return { company, grade: withCompany[2], label, color: colors[company] || colors.PSA }
    }

    // Just a number: "9", "10", "8.5"
    const numOnly = g.match(/^([\d.]+)$/)
    if (numOnly) {
      const num = parseFloat(numOnly[1])
      return { company: 'PSA', grade: numOnly[1], label: psaLabels[num] || 'GRADED', color: colors.PSA }
    }

    // Any non-raw value (e.g. "Graded", "Auth")
    return { company: 'GRADE', grade: g, label: 'CERTIFIED', color: colors.PSA }
  })()

  const handleShare = () => {
    if (!userId) return
    const url = `${window.location.origin}/galerie/${userId}?card=${encodeURIComponent(popup.f)}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

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

  const pauseSlbAnim = useCallback(() => {
    idleRef.current?.style.setProperty('animation-play-state', 'paused')
  }, [])
  const resumeSlbAnim = useCallback(() => {
    setTimeout(() => idleRef.current?.style.setProperty('animation-play-state', 'running'), 500)
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    isDragging.current = true
    lastX.current = e.clientX
    lastY.current = e.clientY
    pauseSlbAnim()
  }, [pauseSlbAnim])

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

  const onMouseUp = useCallback(() => { isDragging.current = false; resumeSlbAnim() }, [resumeSlbAnim])

  const onDoubleClick = useCallback(() => { reset() }, [reset])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    scale.current = Math.min(Math.max(0.5, scale.current - e.deltaY * 0.001), 4)
    cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(applyTransform)
  }, [applyTransform])

  const touch1 = useRef({ x: 0, y: 0 })
  const lastDist = useRef(0)
  const swipeStartX = useRef(0)
  const swipeStartY = useRef(0)
  const swipeStartTime = useRef(0)
  const swipeAccumX = useRef(0)
  const slbWrapRef = useRef<HTMLDivElement>(null)

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      touch1.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      const now = Date.now()
      if (now - lastTap.current < 300) reset()
      lastTap.current = now
      swipeStartX.current = e.touches[0].clientX
      swipeStartY.current = e.touches[0].clientY
      swipeStartTime.current = Date.now()
      swipeAccumX.current = 0
    } else if (e.touches.length === 2) {
      lastDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
    }
    pauseSlbAnim()
  }, [reset, pauseSlbAnim])

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      const dx = e.touches[0].clientX - touch1.current.x
      const dy = e.touches[0].clientY - touch1.current.y
      swipeAccumX.current += Math.abs(dx)
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

  const onTouchEnd = useCallback(() => {
    isDragging.current = false
    resumeSlbAnim()
    const dx = touch1.current.x - swipeStartX.current
    const dy = touch1.current.y - swipeStartY.current
    const dt = Date.now() - swipeStartTime.current
    // Quick straight horizontal swipe → navigate (skip if user was rotating back-and-forth)
    const netDx = Math.abs(dx)
    const accumX = swipeAccumX.current
    const isStraight = accumX > 0 && netDx / accumX > 0.55
    if (netDx > 70 && netDx > Math.abs(dy) * 2 && dt < 300 && isStraight) {
      if (dx < 0) onNext?.()
      else onPrev?.()
    }
  }, [onNext, onPrev, resumeSlbAnim])

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
      position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
      background: bg, zIndex: 9999999,
      display: 'flex', overflow: 'hidden',
    }}>
      <style>{`
        .viewer-layout { display: flex; width: 100%; height: 100%; overflow: hidden; }
        .viewer-zone { flex: 1.2; position: relative; overflow: hidden; background: ${zoneBg}; display: flex; align-items: center; justify-content: center; perspective: 2000px; cursor: grab; user-select: none; -webkit-user-select: none; touch-action: none; }
        .viewer-info { flex: 0.8; padding: 30px; display: flex; flex-direction: column; justify-content: center; background: ${infoBg}; overflow-y: auto; color: ${textColor}; }
        .viewer-card { width: 560px; height: 784px; }
        .viewer-card--horizontal { width: min(784px, 54vw) !important; height: min(560px, 38.6vw) !important; }
        @media (max-width: 1200px) { .viewer-card { width: 420px; height: 588px; } .viewer-card--horizontal { width: min(560px, 54vw) !important; height: min(400px, 38.6vw) !important; } }
        @media (max-width: 600px) {
          .viewer-layout { flex-direction: column; }
          .viewer-zone { flex: 0 0 65% !important; width: 100% !important; }
          .viewer-info { flex: 1 !important; width: 100% !important; padding: 10px 14px !important; justify-content: flex-start !important; }
          .viewer-info h2 { font-size: 1rem !important; margin: 2px 0 !important; }
          .viewer-card { width: 240px !important; height: 336px !important; }
          .viewer-card--horizontal { width: min(260px, 80vw) !important; height: min(186px, 57vw) !important; }
          .viewer-hint { display: none !important; }
        }
      `}</style>
      <button onClick={onClose} style={{
        position: 'absolute', top: 10, right: 10, fontSize: 18, cursor: 'pointer',
        background: dark ? 'rgba(40,40,40,0.95)' : 'rgba(255,255,255,0.95)', width: 32, height: 32, borderRadius: '50%',
        border: `1px solid ${borderColor}`, color: textColor, display: 'flex', alignItems: 'center',
        justifyContent: 'center', zIndex: 10001,
      }}>×</button>

      <div className="viewer-layout">
        {popup.booklet ? (
          <div className="viewer-zone" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <BookletViewer
              frontCover={popup.f}
              backCover={popup.b}
              interiorLeft={popup.il}
              interiorRight={popup.ir}
              accent={accent}
            />
          </div>
        ) : (
        <div className="viewer-zone"
          onMouseDown={onMouseDown} onMouseMove={onMouseMove}
          onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
          onDoubleClick={onDoubleClick} onWheel={onWheel}
          onTouchStart={onTouchStart} onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          {/* Slab mode toggle */}
          {gradeInfo && (
            <button onClick={(e) => { e.stopPropagation(); setSlabMode(s => !s) }} style={{
              position: 'absolute', top: 12, left: 12, zIndex: 10,
              background: slabMode ? gradeInfo.color.top : 'rgba(0,0,0,0.45)',
              color: 'white', border: 'none', borderRadius: 20, padding: '6px 14px',
              fontWeight: 800, fontSize: 11, cursor: 'pointer', backdropFilter: 'blur(4px)',
              transition: '0.2s',
            }}>
              {slabMode ? '🃏 Carte seule' : `🏅 Slab ${gradeInfo.company}`}
            </button>
          )}
          {gradeInfo && !slabMode && (
            <div style={{
              position: 'absolute', bottom: 12, left: 12, zIndex: 10,
              background: gradeInfo.color.top, color: gradeInfo.color.text,
              borderRadius: 6, padding: '4px 10px',
              fontFamily: 'Arial, sans-serif', fontWeight: 900, fontSize: 12,
              letterSpacing: '0.5px', pointerEvents: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            }}>
              {gradeInfo.company} {gradeInfo.grade}
            </div>
          )}

          <style>{`.card-idle { transform-style: preserve-3d; }`}</style>
          <div ref={wrapRef} style={{ willChange: 'transform' }}>
            <div ref={idleRef} className="card-idle">
            {slabMode && gradeInfo ? (
              /* ── SLAB VIEW ── */
              (() => {
                const isPSA = gradeInfo.company === 'PSA' || gradeInfo.company === 'GRADE'
                const isBGS = gradeInfo.company === 'BGS' || gradeInfo.company === 'BVG'
                const isSGC = gradeInfo.company === 'SGC'
                const isCGC = gradeInfo.company === 'CGC'
                // Deterministic cert number from card data
                const certSeed = (popup.n + popup.y + popup.s).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
                const certNum = String((certSeed * 7919 + 10000000) % 90000000 + 10000000).slice(0, 8)
                const setLine = [popup.y, popup.br, popup.s].filter(Boolean).join(' ').toUpperCase()

                return (
                  <div ref={cardRef} style={{ position: 'relative', transformStyle: 'preserve-3d', willChange: 'transform' }}>
                    {/* D = 18px slab depth */}
                    <style>{`
                      /* ── 3D WRAPPER (no overflow:hidden — would flatten 3D) ── */
                      .slb-wrap {
                        position: relative;
                        transform-style: preserve-3d;
                        width: 252px;
                      }
                      @media(max-width:1200px){.slb-wrap{width:214px;}}
                      @media(max-width:600px){.slb-wrap{width:162px;}}
                      @media(max-width:600px){
                        .psa2 { border-width: 3px; }
                        .psa2-main { padding: 3px 6px 2px; }
                        .psa2-set  { font-size: 5.5px; }
                        .psa2-name { font-size: 8px; }
                        .psa2-gname{ font-size: 7px; }
                        .psa2-gnum { font-size: 20px; }
                        .psa2-cert { font-size: 6px; }
                        .psa2-bot  { padding: 1px 6px 3px; }
                        .psa2-bc   { font-size: 12px; letter-spacing: -2.5px; }
                        .psa2-logo-p, .psa2-logo-sa { font-size: 8px; }
                        .psa2-logo-box { padding: 1px 4px; }
                        .bgs2-b    { font-size: 18px; }
                        .bgs2-side { width: 22px; }
                        .bgs2-name { font-size: 8px; }
                        .bgs2-gnum { font-size: 24px; }
                      }

                      /* ── FRONT FACE — clear acrylic ── */
                      .slb-front {
                        position: relative;
                        transform: translateZ(18px);
                        transform-style: preserve-3d;
                        border-radius: 6px;
                        overflow: hidden;
                        /* Clear acrylic — barely tinted transparent */
                        background: linear-gradient(158deg,
                          rgba(232,244,255,0.46) 0%,
                          rgba(214,230,254,0.28) 38%,
                          rgba(224,237,255,0.38) 68%,
                          rgba(212,228,252,0.30) 100%
                        );
                        /* Front face: bright edge highlight + soft natural shadow */
                        box-shadow:
                          0 0 0 1px rgba(255,255,255,0.92),
                          0 6px 14px rgba(0,0,0,0.14),
                          0 14px 36px rgba(0,0,0,0.12),
                          0 28px 60px rgba(0,0,0,0.09),
                          0 50px 90px rgba(0,0,0,0.06),
                          inset 0  1px 0 rgba(255,255,255,0.72),
                          inset 1px 0  0 rgba(255,255,255,0.42),
                          inset -1px 0  0 rgba(0,0,0,0.08),
                          inset 0 -1px 0 rgba(0,0,0,0.14);
                        backdrop-filter: blur(4px);
                      }
                      /* Diagonal gloss — simulates polished acrylic surface */
                      .slb-front::before {
                        content: ''; position: absolute; inset: 0; z-index: 3;
                        pointer-events: none; border-radius: 6px;
                        background: linear-gradient(116deg,
                          rgba(255,255,255,0.24) 0%,
                          rgba(255,255,255,0.10) 22%,
                          rgba(255,255,255,0.02) 44%,
                          transparent 58%,
                          rgba(255,255,255,0.04) 80%
                        );
                      }

                      /* ── PLASTIC ZONES on front face ── */
                      .slb-top { padding: 6px 13px 6px; position: relative; z-index: 1; }
                      .slb-mid { padding: 0 15px; position: relative; z-index: 1; }
                      .slb-bot {
                        padding: 11px 15px 15px; position: relative; z-index: 1;
                        display: flex; flex-direction: column; align-items: center; gap: 7px;
                      }

                      /* ── CARD WINDOW — deeply recessed ── */
                      .slb-window {
                        position: relative; overflow: hidden; border-radius: 2px;
                        box-shadow:
                          0 0 0 1px rgba(0,0,0,0.90),
                          inset 0 5px 16px rgba(0,0,0,0.85),
                          inset 4px 0 12px rgba(0,0,0,0.55),
                          inset -4px 0 12px rgba(0,0,0,0.55),
                          inset 0 -5px 14px rgba(0,0,0,0.60);
                      }
                      .slb-window img { display: block; width: 100%; aspect-ratio: 5/7; object-fit: cover; }
                      .slb-sheen {
                        position: absolute; inset: 0; pointer-events: none;
                        background: linear-gradient(to bottom, rgba(255,255,255,0.07) 0%, transparent 20%);
                      }

                      /* ── GOLD ACCENT ── */
                      .slb-gold {
                        width: 65%; height: 1.5px;
                        background: linear-gradient(to right, transparent, rgba(218,178,50,0.70), rgba(242,202,62,1), rgba(218,178,50,0.70), transparent);
                      }
                      .slb-dots { display: flex; gap: 5px; align-items: center; }
                      .slb-dot  { width: 4px; height: 4px; border-radius: 50%; background: rgba(215,170,45,0.50); }

                      /* ── 3D SIDE PANELS (visible when rotating) ── */
                      /* Left — rotates around left edge, goes from z=0 to z=18 */
                      .slb-el {
                        position: absolute; left: 0; top: 0; bottom: 0; width: 18px;
                        transform-origin: left center;
                        transform: rotateY(-90deg);
                        background: linear-gradient(to left,
                          rgba(175,202,235,0.90) 0%,
                          rgba(210,230,252,0.95) 55%,
                          rgba(238,248,255,0.98) 100%
                        );
                      }
                      /* Right */
                      .slb-er {
                        position: absolute; right: 0; top: 0; bottom: 0; width: 18px;
                        transform-origin: right center;
                        transform: rotateY(90deg);
                        background: linear-gradient(to right,
                          rgba(175,202,235,0.90) 0%,
                          rgba(210,230,252,0.95) 55%,
                          rgba(238,248,255,0.98) 100%
                        );
                      }
                      /* Top */
                      .slb-et {
                        position: absolute; left: 0; right: 0; top: 0; height: 18px;
                        transform-origin: top center;
                        transform: rotateX(90deg);
                        background: linear-gradient(to top,
                          rgba(175,202,235,0.90) 0%,
                          rgba(235,246,255,0.98) 100%
                        );
                      }
                      /* Bottom */
                      .slb-eb {
                        position: absolute; left: 0; right: 0; bottom: 0; height: 18px;
                        transform-origin: bottom center;
                        transform: rotateX(-90deg);
                        background: linear-gradient(to bottom,
                          rgba(175,202,235,0.90) 0%,
                          rgba(235,246,255,0.98) 100%
                        );
                      }

                      /* ── GRADING INSERTS — paper labels, no plastic effect ── */

                      /* ── PSA — cadre rouge épais sur fond blanc, grade énorme ── */
                      /* ── PSA — cadre rouge épais, fond blanc, proportions slab réel ── */
                      .psa2 {
                        border: 5px solid #cc1122;
                        border-radius: 2px; overflow: hidden;
                        background: #fff;
                        font-family: Arial, Helvetica, sans-serif;
                        box-shadow: 0 1px 5px rgba(0,0,0,0.25);
                      }
                      .psa2-main {
                        padding: 5px 9px 3px;
                        display: flex; gap: 5px; align-items: flex-start;
                      }
                      .psa2-left {
                        flex: 1; min-width: 0;
                        display: flex; flex-direction: column; gap: 1px;
                      }
                      .psa2-set  { font-size: 7.5px; font-weight: 400; color: #111; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.3; }
                      .psa2-name { font-size: 11px; font-weight: 900; color: #111; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.2; }
                      .psa2-var  { font-size: 7px; color: #444; text-transform: uppercase; line-height: 1.3; }
                      .psa2-right {
                        display: flex; flex-direction: column;
                        align-items: flex-end; flex-shrink: 0;
                      }
                      .psa2-gname { font-size: 10px; font-weight: 800; color: #111; letter-spacing: 0.3px; line-height: 1.2; }
                      .psa2-gnum  { font-size: 30px; font-weight: 900; color: #111; line-height: 0.95; letter-spacing: -1px; }
                      .psa2-cert  { font-size: 8px; font-weight: 600; color: #111; letter-spacing: 0.3px; line-height: 1.3; }
                      .psa2-bot {
                        display: flex; align-items: center;
                        padding: 1px 9px 5px; gap: 6px;
                      }
                      .psa2-bc {
                        flex: 1; font-family: monospace;
                        font-size: 18px; letter-spacing: -3.5px;
                        color: #111; line-height: 1; overflow: hidden;
                      }
                      .psa2-logo-box {
                        background: linear-gradient(145deg, #ddd, #c4c4c4);
                        border: 0.5px solid #aaa; border-radius: 2px;
                        padding: 2px 5px; flex-shrink: 0;
                        box-shadow: inset 0 1px 0 rgba(255,255,255,0.5), 0 1px 2px rgba(0,0,0,0.15);
                      }
                      .psa2-logo-p  { font-size: 11px; font-weight: 900; font-style: italic; color: #cc1122; }
                      .psa2-logo-sa { font-size: 11px; font-weight: 900; font-style: italic; color: #003DA6; }

                      /* ── BGS / BECKETT (crème, bande noire B à gauche, note sur droite) ── */
                      .bgs2 {
                        background: #f2eed8;
                        border-radius: 3px; overflow: hidden;
                        font-family: Arial, sans-serif;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.40), 0 0 0 0.5px rgba(0,0,0,0.15);
                        display: flex; min-height: 60px;
                        border: 0.5px solid #d8cf9a;
                      }
                      .bgs2-side { width: 34px; background: #111; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                      .bgs2-b    { font-size: 26px; font-weight: 900; color: #d4a820; font-style: italic; line-height: 1; }
                      .bgs2-body { flex: 1; padding: 5px 8px; display: flex; align-items: stretch; gap: 5px; min-width: 0; }
                      .bgs2-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; }
                      .bgs2-set  { font-size: 7px; font-weight: 700; color: #666; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; letter-spacing: 0.3px; }
                      .bgs2-name { font-size: 11px; font-weight: 900; color: #111; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                      .bgs2-sub  { display: grid; grid-template-columns: 1fr 1fr; gap: 1px 6px; }
                      .bgs2-sub-item { font-size: 6.5px; color: #666; font-style: italic; font-weight: 600; text-transform: uppercase; }
                      .bgs2-cert { font-size: 6.5px; color: #999; font-weight: 700; letter-spacing: 0.3px; }
                      .bgs2-grade {
                        display: flex; flex-direction: column; align-items: center; justify-content: center;
                        flex-shrink: 0; padding: 0 6px; border-left: 1px solid #c8b96a;
                        min-width: 52px;
                      }
                      .bgs2-gnum  { font-size: 36px; font-weight: 900; color: #111; line-height: 1; }
                      .bgs2-gname { font-size: 6.5px; font-weight: 800; color: #555; letter-spacing: 0.5px; text-transform: uppercase; text-align: center; margin-top: 2px; }

                      /* ── SGC ── */
                      .sgc2 { background: #fafafa; border-radius: 3px; overflow: hidden; font-family: Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.40), 0 0 0 0.5px rgba(0,0,0,0.15); display: flex; min-height: 60px; }
                      .sgc2-side { width: 26px; background: #006633; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                      .sgc2-txt  { font-size: 9px; font-weight: 900; color: #fff; letter-spacing: 1px; writing-mode: vertical-rl; transform: rotate(180deg); }
                      .sgc2-body { flex: 1; padding: 5px 8px; display: flex; align-items: center; gap: 5px; min-width: 0; }
                      .sgc2-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: space-between; gap: 2px; }
                      .sgc2-set  { font-size: 7.5px; font-weight: 700; color: #444; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                      .sgc2-name { font-size: 11px; font-weight: 900; color: #111; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; letter-spacing: -0.3px; }
                      .sgc2-var  { font-size: 7px; color: #666; text-transform: uppercase; }
                      .sgc2-cert { font-size: 7px; color: #bbb; font-weight: 700; }
                      .sgc2-gbox { background: #006633; border-radius: 3px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px 10px; flex-shrink: 0; min-width: 50px; }
                      .sgc2-gnum { font-size: 34px; font-weight: 900; color: #fff; line-height: 1; }
                      .sgc2-gname{ font-size: 6.5px; font-weight: 800; color: rgba(255,255,255,0.85); text-transform: uppercase; margin-top: 2px; }

                      /* ── CGC ── */
                      .cgc2 { background: #fff; border-radius: 3px; overflow: hidden; font-family: Arial, sans-serif; box-shadow: 0 2px 8px rgba(0,0,0,0.40), 0 0 0 0.5px rgba(0,0,0,0.15); }
                      .cgc2-top  { background: #0039a6; padding: 4px 10px; display: flex; justify-content: space-between; align-items: center; min-height: 28px; }
                      .cgc2-brand{ font-size: 14px; font-weight: 900; color: #fff; letter-spacing: 2px; }
                      .cgc2-gnum { font-size: 24px; font-weight: 900; color: #fff; line-height: 1; }
                      .cgc2-body { padding: 5px 10px; display: flex; justify-content: space-between; align-items: center; gap: 4px; min-height: 32px; }
                      .cgc2-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
                      .cgc2-set  { font-size: 7.5px; font-weight: 700; color: #444; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                      .cgc2-name { font-size: 11px; font-weight: 900; color: #111; text-transform: uppercase; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
                      .cgc2-var  { font-size: 7px; color: #666; text-transform: uppercase; }
                      .cgc2-right{ display: flex; flex-direction: column; align-items: flex-end; gap: 2px; flex-shrink: 0; }
                      .cgc2-gname{ font-size: 8px; font-weight: 800; color: #0039a6; }
                      .cgc2-cert { font-size: 6.5px; color: #bbb; font-weight: 700; }
                    `}</style>

                    <div ref={slbWrapRef} className="slb-wrap">
                      {/* ── FRONT FACE ── */}
                      <div className="slb-front">
                        {/* Label zone — plastic top */}
                        <div className="slb-top">
                          {isPSA && (
                            <div className="psa2">
                              <div className="psa2-main">
                                <div className="psa2-left">
                                  <span className="psa2-set">{setLine}</span>
                                  <span className="psa2-name">{popup.n.toUpperCase()}</span>
                                  {popup.v && <span className="psa2-var">{popup.v.toUpperCase()}</span>}
                                </div>
                                <div className="psa2-right">
                                  <span className="psa2-gname">{gradeInfo.label}</span>
                                  <span className="psa2-gnum">{gradeInfo.grade}</span>
                                  <span className="psa2-cert">{certNum}</span>
                                </div>
                              </div>
                              <div className="psa2-bot">
                                <span className="psa2-bc">{'|||||||||||||||||||||||||||||||'}</span>
                                <div className="psa2-logo-box">
                                  <span className="psa2-logo-p">P</span><span className="psa2-logo-sa">SA</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {isBGS && (
                            <div className="bgs2">
                              <div className="bgs2-side"><span className="bgs2-b">B</span></div>
                              <div className="bgs2-body">
                                <div className="bgs2-info">
                                  <span className="bgs2-set">{setLine}</span>
                                  <span className="bgs2-name">{popup.n.toUpperCase()}</span>
                                  <div className="bgs2-sub">
                                    <span className="bgs2-sub-item">CENTERING —</span>
                                    <span className="bgs2-sub-item">CORNERS —</span>
                                    <span className="bgs2-sub-item">EDGES —</span>
                                    <span className="bgs2-sub-item">SURFACE —</span>
                                  </div>
                                  <span className="bgs2-cert">{certNum}</span>
                                </div>
                                <div className="bgs2-grade">
                                  <span className="bgs2-gnum">{gradeInfo.grade}</span>
                                  <span className="bgs2-gname">{gradeInfo.label}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {isSGC && (
                            <div className="sgc2">
                              <div className="sgc2-side"><span className="sgc2-txt">SGC</span></div>
                              <div className="sgc2-body">
                                <div className="sgc2-info">
                                  <span className="sgc2-set">{setLine}</span>
                                  <span className="sgc2-name">{popup.n.toUpperCase()}</span>
                                  {popup.v && <span className="sgc2-var">{popup.v.toUpperCase()}</span>}
                                  <span className="sgc2-cert">{certNum}</span>
                                </div>
                                <div className="sgc2-gbox">
                                  <span className="sgc2-gnum">{gradeInfo.grade}</span>
                                  <span className="sgc2-gname">{gradeInfo.label}</span>
                                </div>
                              </div>
                            </div>
                          )}
                          {isCGC && (
                            <div className="cgc2">
                              <div className="cgc2-top">
                                <span className="cgc2-brand">CGC</span>
                                <span className="cgc2-gnum">{gradeInfo.grade}</span>
                              </div>
                              <div className="cgc2-body">
                                <div className="cgc2-info">
                                  <span className="cgc2-set">{setLine}</span>
                                  <span className="cgc2-name">{popup.n.toUpperCase()}</span>
                                  {popup.v && <span className="cgc2-var">{popup.v.toUpperCase()}</span>}
                                </div>
                                <div className="cgc2-right">
                                  <span className="cgc2-gname">{gradeInfo.label}</span>
                                  <span className="cgc2-cert">{certNum}</span>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Card window */}
                        <div className="slb-mid">
                          <div className="slb-window">
                            <img src={popup.f} draggable={false} alt={popup.n} />
                            <div className="slb-sheen" />
                          </div>
                        </div>

                        {/* Bottom plastic + gold accent */}
                        <div className="slb-bot">
                          <div className="slb-gold" />
                          <div className="slb-dots">
                            <div className="slb-dot" />
                            <div className="slb-dot" style={{opacity:0.65,width:'3px',height:'3px'}} />
                            <div className="slb-dot" style={{opacity:0.38,width:'2.5px',height:'2.5px'}} />
                          </div>
                        </div>
                      </div>

                      {/* ── 3D SIDE PANELS — acrylic edges visible when rotating ── */}
                      <div className="slb-el" />
                      <div className="slb-er" />
                      <div className="slb-et" />
                      <div className="slb-eb" />
                    </div>
                  </div>
                )
              })()
            ) : (
              /* ── CARD VIEW (original) ── */
              <div ref={cardRef} className={`viewer-card${popup.is_horizontal ? ' viewer-card--horizontal' : ''}`} style={{
                position: 'relative', transformStyle: 'preserve-3d', willChange: 'transform',
              }}>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                  <img src={popup.f} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={popup.n} />
                </div>
                <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', overflow: 'hidden' }}>
                  <img src={popup.b} draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={popup.n} />
                </div>
              </div>
            )}
            </div>{/* /card-idle */}
          </div>
          <p className="viewer-hint" style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', fontSize: 10, color: '#bbb', whiteSpace: 'nowrap', pointerEvents: 'none' }}>
            Glisser · Scroll pour zoomer · Double-clic pour reset
          </p>
        </div>
        )}

        <div className="viewer-info">
          <div style={{ color: accent, fontWeight: 900, fontSize: 10, textTransform: 'uppercase', marginBottom: 2 }}>{popup.t}</div>
          <Link href={`/joueur/${playerSlug(popup.n)}`} style={{ textDecoration: 'none', color: 'inherit' }}
            onMouseEnter={e => (e.currentTarget.querySelector('h2')!.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.querySelector('h2')!.style.textDecoration = 'none')}
          >
            <h2 style={{ fontSize: '1.4rem', fontWeight: 900, margin: '3px 0', cursor: 'pointer' }}>{popup.n}</h2>
          </Link>
          <div style={{ fontSize: '0.9rem', color: accent, fontWeight: 700, marginBottom: 8, fontStyle: 'italic' }}>{popup.v}</div>
          {getTags(popup)}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, borderTop: `1px solid ${borderColor}`, marginTop: 10, paddingTop: 10 }}>
            {[['Année', popup.y], ['Numérotation', popup.num || 'N/A'], ['Grade', popup.g], ['Collection', `${popup.br} ${popup.s}`]].map(([l, v]) => (
              <div key={l}>
                <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase' }}>{l}</label>
                <span style={{ fontSize: 12, fontWeight: 700, color: textColor }}>{v}</span>
              </div>
            ))}
          </div>

          {/* Ma collection (tag) — owner seulement */}
          {isOwner && onCollectionTagChange && userId && (
            <div style={{ marginTop: 10, borderTop: `1px solid ${borderColor}`, paddingTop: 10 }}>
              <label style={{ display: 'block', fontSize: 9, fontWeight: 800, color: metaColor, textTransform: 'uppercase', marginBottom: 5 }}>
                Ma collection
              </label>
              <CollectionTagSelect
                userId={userId}
                value={tagInput}
                onChange={async (tag) => {
                  setTagInput(tag)
                  setTagSaving(true)
                  await onCollectionTagChange(popup, tag)
                  setTagSaving(false)
                }}
              />
            </div>
          )}

          {/* Boutons actions */}
          <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button onClick={() => setShowVideo(true)} style={{
              flex: 1, background: '#0d0d1f', color: 'white', border: 'none',
              borderRadius: 10, padding: '12px', fontWeight: 800, cursor: 'pointer', fontSize: 14,
            }}>
              🎬 {lang === 'fr' ? 'Exporter en vidéo' : 'Export as video'}
            </button>
            {userId && (
              <button onClick={handleShare} style={{
                background: copied ? '#2e7d32' : (dark ? '#2a2a2a' : '#f0f0f0'), color: copied ? 'white' : (dark ? '#eee' : '#333'),
                border: 'none', borderRadius: 10, padding: '12px 14px',
                fontWeight: 800, cursor: 'pointer', fontSize: 14, whiteSpace: 'nowrap',
                transition: '0.2s',
              }}>
                {copied ? '✓ Copié' : '🔗 Partager'}
              </button>
            )}
          </div>

          {/* Ajouter à ma galerie — visiteur connecté seulement */}
          {!isOwner && onAddToMyGallery && (
            <div style={{ marginTop: 10 }}>
              <button
                disabled={addState === 'loading' || addState === 'added' || addState === 'duplicate'}
                onClick={async () => {
                  setAddState('loading')
                  const result = await onAddToMyGallery()
                  setAddState(result)
                }}
                style={{
                  width: '100%', border: 'none', borderRadius: 10, padding: '12px',
                  fontWeight: 800, cursor: addState === 'idle' ? 'pointer' : 'default', fontSize: 14,
                  background: addState === 'added' ? '#2e7d32' : addState === 'duplicate' ? (dark ? '#2a2a2a' : '#f0f0f0') : '#003DA6',
                  color: addState === 'duplicate' ? (dark ? '#aaa' : '#666') : 'white',
                  transition: '0.2s',
                }}
              >
                {addState === 'loading' ? '...' : addState === 'added' ? (lang === 'fr' ? '✓ Ajoutée à ta galerie !' : '✓ Added to your gallery!') : addState === 'duplicate' ? (lang === 'fr' ? 'Déjà dans ta galerie' : 'Already in your gallery') : (lang === 'fr' ? '+ J\'ai cette carte' : '+ I have this card')}
              </button>
            </div>
          )}

          <CardValueModule
            cardName={popup.n}
            set={`${popup.br} ${popup.s}`.trim()}
            year={popup.y}
            num={popup.num}
            variant={popup.v}
            rc={popup.rc}
            auto={popup.auto}
            patch={popup.patch}
            grade={popup.g}
            accent={accent}
            img={popup.f}
          />

          {/* PSA Population Report */}
          {popup.g?.toUpperCase().startsWith('PSA') && (() => {
            const psaGrade = popup.g?.match(/\d+(?:\.\d+)?/)?.[0] || ''
            const q = encodeURIComponent([popup.n, popup.y, popup.br, popup.s].filter(Boolean).join(' '))
            // Recherche PSA du site (résultats spécifiques à la carte : pop, APR, sets)
            const psaPopUrl  = `https://www.psacard.com/search?q=${q}`
            const psaCertUrl = `https://www.psacard.com/certlookup`
            return (
              <div style={{ borderTop: '1px solid #eee', paddingTop: 12, marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 10, fontWeight: 800, color: '#bbb', textTransform: 'uppercase', letterSpacing: 1, marginRight: 4 }}>PSA</span>
                <a href={psaPopUrl} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 11, fontWeight: 700, color: '#c0392b', textDecoration: 'none',
                  border: '1.5px solid #c0392b33', borderRadius: 20, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, transition: '0.15s',
                }}
                  onMouseEnter={e => { e.currentTarget.style.background = '#c0392b'; e.currentTarget.style.color = 'white' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#c0392b' }}
                >
                  Population Report ↗
                </a>
                <a href={psaCertUrl} target="_blank" rel="noopener noreferrer" style={{
                  fontSize: 11, fontWeight: 700, color: '#888', textDecoration: 'none',
                  border: '1.5px solid #e0e0e0', borderRadius: 20, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 4, transition: '0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#bbb')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = '#e0e0e0')}
                >
                  Cert Lookup ↗
                </a>
                {psaGrade && (
                  <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, color: '#aaa' }}>Note {psaGrade}</span>
                )}
              </div>
            )
          })()}

          {popup.n && (
            <SameCardCollectors
              cardName={popup.n}
              year={popup.y}
              brand={popup.br}
              set={popup.s}
              variant={popup.v}
              num={popup.num}
              rc={popup.rc}
              auto={popup.auto}
              patch={popup.patch}
              excludeUserId={userId}
              accent={accent}
            />
          )}

          {showVideo && <CardVideoExport card={popup} accent={accent} onClose={() => setShowVideo(false)} />}
        </div>
      </div>
    </div>
  )
}
