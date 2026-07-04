'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'

const GRADIENT_PRESETS = [
  'linear-gradient(135deg, #C8102E, #1D3F8B)',
  'linear-gradient(135deg, #0f2027, #203a43, #2c5364)',
  'linear-gradient(135deg, #232526, #414345)',
  'linear-gradient(135deg, #1a2a6c, #b21f1f, #fdbb2d)',
  'linear-gradient(135deg, #654ea3, #eaafc8)',
  'linear-gradient(135deg, #f7971e, #ffd200)',
]
const SOLID_PRESETS = ['#0e1116', '#1D3F8B', '#C8102E', '#2e7d32', '#6b2737', '#111111', '#f5f5f5']

// Éditeur de personnalisation de page (fond + couleur du pseudo).
export default function PageCustomizer({ userId, initialBg, initialNameColor, onClose, onSaved }: {
  userId: string
  initialBg: string | null
  initialNameColor: string | null
  onClose: () => void
  onSaved: (bg: string | null, nameColor: string | null) => void
}) {
  const startsGrad = !!initialBg && initialBg.includes('gradient')
  const [mode, setMode] = useState<'solid' | 'gradient'>(startsGrad ? 'gradient' : 'solid')
  const [solid, setSolid] = useState(startsGrad ? '#1D3F8B' : (initialBg || '#0e1116'))
  const [gA, setGA] = useState('#C8102E')
  const [gB, setGB] = useState('#1D3F8B')
  const [angle, setAngle] = useState(135)
  const [preset, setPreset] = useState<string | null>(startsGrad ? initialBg : null)
  const [nameColor, setNameColor] = useState(initialNameColor || '#ffffff')
  const [saving, setSaving] = useState(false)

  const bgValue = mode === 'solid'
    ? solid
    : (preset || `linear-gradient(${angle}deg, ${gA}, ${gB})`)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ page_bg: bgValue, page_name_color: nameColor }).eq('id', userId)
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    onSaved(bgValue, nameColor)
    onClose()
  }

  const reset = async () => {
    setSaving(true)
    await supabase.from('profiles').update({ page_bg: null, page_name_color: null }).eq('id', userId)
    setSaving(false)
    onSaved(null, null)
    onClose()
  }

  const swatch = (v: string, active: boolean, onClick: () => void) => (
    <button onClick={onClick} style={{ width: 40, height: 40, borderRadius: 8, cursor: 'pointer', background: v, border: active ? '3px solid #003DA6' : '2px solid #ddd' }} />
  )

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 22, width: '100%', maxWidth: 420, maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>🎨 Personnaliser ma page</h3>

        {/* Aperçu */}
        <div style={{ height: 90, borderRadius: 12, background: bgValue, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontWeight: 900, fontSize: 22, color: nameColor, textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>Pseudo</span>
        </div>

        {/* Type de fond */}
        <div style={{ display: 'flex', gap: 8 }}>
          {(['solid', 'gradient'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13, border: mode === m ? '2px solid #003DA6' : '2px solid #e0e0e0', background: mode === m ? '#003DA610' : 'white' }}>
              {m === 'solid' ? 'Couleur unie' : 'Dégradé'}
            </button>
          ))}
        </div>

        {mode === 'solid' ? (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 8 }}>Fond</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {SOLID_PRESETS.map(c => swatch(c, solid === c, () => setSolid(c)))}
              <input type="color" value={solid.startsWith('#') ? solid : '#000000'} onChange={e => setSolid(e.target.value)} style={{ width: 40, height: 40, border: 'none', background: 'none', cursor: 'pointer' }} />
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888' }}>Dégradés prêts</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GRADIENT_PRESETS.map(g => swatch(g, preset === g, () => setPreset(g)))}
            </div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888', marginTop: 4 }}>Ou dégradé personnalisé</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <input type="color" value={gA} onChange={e => { setGA(e.target.value); setPreset(null) }} style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }} />
              <input type="color" value={gB} onChange={e => { setGB(e.target.value); setPreset(null) }} style={{ width: 40, height: 40, border: 'none', cursor: 'pointer' }} />
              <div style={{ flex: 1 }}>
                <input type="range" min={0} max={360} value={angle} onChange={e => { setAngle(Number(e.target.value)); setPreset(null) }} style={{ width: '100%' }} />
                <div style={{ fontSize: 11, color: '#999', textAlign: 'center' }}>{angle}°</div>
              </div>
            </div>
          </div>
        )}

        {/* Couleur du pseudo */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 8 }}>Couleur du pseudo</label>
          <input type="color" value={nameColor} onChange={e => setNameColor(e.target.value)} style={{ width: 48, height: 40, border: 'none', cursor: 'pointer' }} />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={reset} disabled={saving} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 13, fontWeight: 700 }}>Réinitialiser</button>
          <div style={{ flex: 1 }} />
          <button onClick={onClose} className="btn-main btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>Annuler</button>
          <button onClick={save} disabled={saving} className="btn-main btn-primary" style={{ padding: '8px 16px', fontSize: 13 }}>{saving ? '...' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>,
    document.body
  )
}
