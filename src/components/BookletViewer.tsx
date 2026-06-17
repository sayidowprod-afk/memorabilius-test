'use client'
import { useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'

interface Props {
  frontCover: string
  backCover: string
  interiorLeft?: string
  interiorRight?: string
  accent: string
}

export default function BookletViewer({ frontCover, backCover, interiorLeft, interiorRight, accent }: Props) {
  const { dark } = useTheme()
  const [open, setOpen] = useState(false)
  const [showBack, setShowBack] = useState(false)

  const bg = dark ? '#111' : '#f0f0f0'
  const shadow = '0 20px 60px rgba(0,0,0,0.4)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '20px 0' }}>

      {/* Viewer */}
      <div style={{ perspective: 1200, width: '100%', display: 'flex', justifyContent: 'center' }}>
        {open && interiorLeft && interiorRight ? (
          /* Vue ouverte — double page */
          <div style={{ display: 'flex', gap: 4, animation: 'bookOpen 0.5s ease-out', transformOrigin: 'center' }}>
            <style>{`
              @keyframes bookOpen {
                from { transform: scaleX(0.3); opacity: 0.5; }
                to   { transform: scaleX(1);   opacity: 1; }
              }
            `}</style>
            {/* Page gauche */}
            <div style={{ width: 220, boxShadow: '-4px 0 20px rgba(0,0,0,0.3)', borderRadius: '8px 0 0 8px', overflow: 'hidden', position: 'relative' }}>
              <img src={interiorLeft} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Page gauche" />
              <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(to right, rgba(0,0,0,0.2), rgba(0,0,0,0.05))' }} />
            </div>
            {/* Spine / pli central */}
            <div style={{ width: 8, background: `linear-gradient(to right, #888, #ccc, #888)`, flexShrink: 0, boxShadow: '0 0 10px rgba(0,0,0,0.3)' }} />
            {/* Page droite */}
            <div style={{ width: 220, boxShadow: '4px 0 20px rgba(0,0,0,0.3)', borderRadius: '0 8px 8px 0', overflow: 'hidden', position: 'relative' }}>
              <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 6, background: 'linear-gradient(to left, rgba(0,0,0,0.1), rgba(0,0,0,0.05))' }} />
              <img src={interiorRight} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt="Page droite" />
            </div>
          </div>
        ) : (
          /* Vue fermée — couverture simple */
          <div style={{
            width: 240, borderRadius: 8, overflow: 'hidden',
            boxShadow: shadow,
            transform: 'rotateY(-8deg)',
            transition: 'transform 0.3s',
          }}>
            <img
              src={showBack ? backCover : frontCover}
              style={{ width: '100%', display: 'block' }}
              alt={showBack ? 'Couverture arrière' : 'Couverture avant'}
            />
          </div>
        )}
      </div>

      {/* Contrôles */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
        {interiorLeft && interiorRight && (
          <button
            onClick={() => setOpen(o => !o)}
            style={{
              background: open ? accent : (dark ? '#333' : '#f0f0f0'),
              color: open ? 'white' : (dark ? '#eee' : '#333'),
              border: 'none', borderRadius: 20, padding: '8px 20px',
              fontWeight: 800, fontSize: 13, cursor: 'pointer', transition: '0.2s',
            }}
          >
            {open ? '📕 Fermer' : '📖 Ouvrir'}
          </button>
        )}
        {!open && (
          <button
            onClick={() => setShowBack(b => !b)}
            style={{
              background: dark ? '#2a2a2a' : '#f0f0f0',
              color: dark ? '#eee' : '#555',
              border: 'none', borderRadius: 20, padding: '8px 20px',
              fontWeight: 700, fontSize: 13, cursor: 'pointer',
            }}
          >
            {showBack ? '↩ Avant' : '↪ Arrière'}
          </button>
        )}
      </div>
    </div>
  )
}
