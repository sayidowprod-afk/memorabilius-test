'use client'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS, teamLogoUrl, type Sport } from '@/lib/sportsTeams'

const SPORTS: { id: Sport; label: string }[] = [
  { id: 'nba', label: 'NBA' },
  { id: 'nfl', label: 'NFL' },
  { id: 'mlb', label: 'MLB' },
  { id: 'nhl', label: 'NHL' },
  { id: 'football', label: 'Foot' },
]

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
export default function PageCustomizer({ userId, initialBg, initialNameColor, initialFrameColor, initialPattern, onClose, onSaved }: {
  userId: string
  initialBg: string | null
  initialNameColor: string | null
  initialFrameColor: string | null
  initialPattern: string | null
  onClose: () => void
  onSaved: (bg: string | null, nameColor: string | null, frameColor: string | null, pattern: string | null) => void
}) {
  const startsGrad = !!initialBg && initialBg.includes('gradient')
  const [mode, setMode] = useState<'solid' | 'gradient'>(startsGrad ? 'gradient' : 'solid')
  const [solid, setSolid] = useState(startsGrad ? '#1D3F8B' : (initialBg || '#0e1116'))
  const [gA, setGA] = useState('#C8102E')
  const [gB, setGB] = useState('#1D3F8B')
  const [angle, setAngle] = useState(135)
  const [preset, setPreset] = useState<string | null>(startsGrad ? initialBg : null)
  const [nameColor, setNameColor] = useState(initialNameColor || '#ffffff')
  const [frameColor, setFrameColor] = useState(initialFrameColor || '#ffffff')
  const parseInit = (): string[] => {
    if (!initialPattern) return []
    try { const a = JSON.parse(initialPattern); return Array.isArray(a) ? a : [initialPattern] } catch { return [initialPattern] }
  }
  const [patterns, setPatterns] = useState<string[]>(parseInit)
  const [sport, setSport] = useState<Sport>('nba')
  const [saving, setSaving] = useState(false)
  const toggleLogo = (url: string) => setPatterns(p => p.includes(url) ? p.filter(x => x !== url) : [...p, url])
  const patternValue = patterns.length ? JSON.stringify(patterns) : null

  const bgValue = mode === 'solid'
    ? solid
    : (preset || `linear-gradient(${angle}deg, ${gA}, ${gB})`)

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('profiles').update({ page_bg: bgValue, page_name_color: nameColor, page_frame_color: frameColor, page_pattern: patternValue }).eq('id', userId)
    setSaving(false)
    if (error) { alert('Erreur : ' + error.message); return }
    onSaved(bgValue, nameColor, frameColor, patternValue)
    onClose()
  }

  const reset = async () => {
    setSaving(true)
    await supabase.from('profiles').update({ page_bg: null, page_name_color: null, page_frame_color: null, page_pattern: null }).eq('id', userId)
    setSaving(false)
    onSaved(null, null, null, null)
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
        <div style={{ height: 90, borderRadius: 12, background: bgValue, position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {patterns.length > 0 && Array.from({ length: 14 }).map((_, i) => (
            <img key={i} src={patterns[i % patterns.length]} alt="" style={{ position: 'absolute', left: `${(i * 37 + 11) % 100}%`, top: `${(i * 53 + 7) % 100}%`, width: 26, height: 26, objectFit: 'contain', opacity: 0.22, transform: `translate(-50%,-50%) rotate(${(i * 47) % 60 - 30}deg)` }} />
          ))}
          <span style={{ position: 'relative', fontWeight: 900, fontSize: 22, color: nameColor, textShadow: '0 1px 4px rgba(0,0,0,0.35)' }}>Pseudo</span>
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

        {/* Couleur interne des cadres de cartes */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 8 }}>Couleur interne des cadres de cartes</label>
          <input type="color" value={frameColor} onChange={e => setFrameColor(e.target.value)} style={{ width: 48, height: 40, border: 'none', cursor: 'pointer' }} />
        </div>

        {/* Motif de logos en fond (sélection multiple, disposition aléatoire) */}
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 8 }}>
            Motif de logos en fond {patterns.length > 0 && <span style={{ color: '#003DA6' }}>· {patterns.length} choisi{patterns.length > 1 ? 's' : ''}</span>}
          </label>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {SPORTS.map(s => (
              <button key={s.id} onClick={() => setSport(s.id)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: sport === s.id ? '2px solid #003DA6' : '2px solid #e0e0e0', background: sport === s.id ? '#003DA610' : 'white' }}>{s.label}</button>
            ))}
            {patterns.length > 0 && (
              <button onClick={() => setPatterns([])} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 800, cursor: 'pointer', border: '2px solid #e74c3c', background: '#e74c3c11', color: '#e74c3c' }}>Tout retirer</button>
            )}
          </div>
          <div style={{ fontSize: 11, color: '#aaa', marginBottom: 6 }}>Clique pour ajouter/retirer — plusieurs possibles, placés aléatoirement.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 44px)', gap: 6, maxHeight: 150, overflowY: 'auto' }}>
            {SPORTS_TEAMS.filter(tm => tm.sport === sport).map(tm => {
              const url = teamLogoUrl(tm)
              const on = patterns.includes(url)
              return (
                <button key={tm.id} onClick={() => toggleLogo(url)} title={tm.name} style={{ position: 'relative', width: 44, height: 44, borderRadius: 8, cursor: 'pointer', background: on ? '#003DA610' : 'white', padding: 3, border: on ? '2px solid #003DA6' : '2px solid #eee' }}>
                  <img src={url} alt={tm.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  {on && <span style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: '#003DA6', color: 'white', fontSize: 10, fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✓</span>}
                </button>
              )
            })}
          </div>
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
