'use client'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'

export interface PickableCard {
  key: string
  img: string
  nom: string
  team?: string
  year?: string
  brand?: string
  variant?: string
  rc?: boolean
  auto?: boolean
  patch?: boolean
  num?: boolean
}

const ACCENT = '#003DA6'
const TAGS = [
  { key: 'rc', label: 'RC', bg: '#e67e22' },
  { key: 'auto', label: 'AUTO', bg: '#2e7d32' },
  { key: 'patch', label: 'PATCH', bg: '#1976d2' },
  { key: 'num', label: '# NUM', bg: '#7b1fa2' },
] as const

// Sélecteur de carte parmi la collection du user (manuelles + CSV), dédupliquées par image.
// Mode simple : onSelect(carte). Mode multi : sélection multiple → onSelectMany(cartes[]).
export default function CardPicker({ userId, onSelect, onSelectMany, onClose, excludeKeys, multi }: {
  userId: string
  onSelect?: (card: PickableCard) => void
  onSelectMany?: (cards: PickableCard[]) => void
  onClose: () => void
  excludeKeys?: Set<string>
  multi?: boolean
}) {
  const [cards, setCards] = useState<PickableCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [fTeam, setFTeam] = useState('')
  const [fYear, setFYear] = useState('')
  const [fBrand, setFBrand] = useState('')
  const [fTags, setFTags] = useState({ rc: false, auto: false, patch: false, num: false })
  const [picked, setPicked] = useState<PickableCard[]>([])
  const pickedKeys = new Set(picked.map(p => p.key))

  useEffect(() => {
    (async () => {
      const [{ data: manuelles }, { data: profile }] = await Promise.all([
        supabase.from('cartes_manuelles').select('nom, image_recto, equipe, annee, marque, variation, rc, auto, patch, num').eq('user_id', userId).not('image_recto', 'is', null),
        supabase.from('profiles').select('id, display_name, avatar_url, lien_csv, couleur_bordure').eq('id', userId).single(),
      ])
      const seen = new Set<string>()
      const list: PickableCard[] = []
      for (const m of (manuelles || []) as any[]) {
        if (!m.image_recto || seen.has(m.image_recto)) continue
        seen.add(m.image_recto)
        list.push({
          key: m.image_recto, img: m.image_recto, nom: m.nom || '',
          team: m.equipe || '', year: (m.annee || '').toString(), brand: m.marque || '', variant: m.variation || '',
          rc: !!m.rc, auto: !!m.auto, patch: !!m.patch, num: !!(m.num && String(m.num).trim()),
        })
      }
      if (profile?.lien_csv) {
        const csvCards = await fetchCsvCardsForProfiles([profile])
        for (const c of csvCards) {
          if (!c.img || seen.has(c.img)) continue
          seen.add(c.img)
          list.push({
            key: c.img, img: c.img, nom: c.name || '',
            team: c.team || '', year: c.year || '', brand: c.brand || '', variant: c.variant || '',
            rc: !!c.rc, auto: !!c.auto, patch: !!c.patch, num: !!(c.num && String(c.num).trim()),
          })
        }
      }
      setCards(list)
      setLoading(false)
    })()
  }, [userId])

  const teams = useMemo(() => [...new Set(cards.map(c => c.team).filter(Boolean) as string[])].sort(), [cards])
  const years = useMemo(() => [...new Set(cards.map(c => c.year).filter(Boolean) as string[])].sort().reverse(), [cards])
  const brands = useMemo(() => [...new Set(cards.map(c => c.brand).filter(Boolean) as string[])].sort(), [cards])

  const filtered = cards
    .filter(c => !excludeKeys?.has(c.key))
    .filter(c => !search || c.nom.toLowerCase().includes(search.toLowerCase()) || (c.variant || '').toLowerCase().includes(search.toLowerCase()))
    .filter(c => !fTeam || c.team === fTeam)
    .filter(c => !fYear || c.year === fYear)
    .filter(c => !fBrand || c.brand === fBrand)
    .filter(c => !fTags.rc || c.rc)
    .filter(c => !fTags.auto || c.auto)
    .filter(c => !fTags.patch || c.patch)
    .filter(c => !fTags.num || c.num)

  const selectStyle: React.CSSProperties = { padding: '7px 10px', borderRadius: 8, border: '1.5px solid #e0e0e0', fontSize: 12, background: 'white', cursor: 'pointer' }

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 600, maxHeight: '86vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>🃏 {multi ? 'Choisir des cartes' : 'Choisir une carte'}</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>

        {/* Recherche + filtres */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un joueur, une variation..." autoFocus />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <select value={fTeam} onChange={e => setFTeam(e.target.value)} style={{ ...selectStyle, borderColor: fTeam ? ACCENT : '#e0e0e0' }}>
            <option value="">Équipe</option>
            {teams.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <select value={fYear} onChange={e => setFYear(e.target.value)} style={{ ...selectStyle, borderColor: fYear ? ACCENT : '#e0e0e0' }}>
            <option value="">Année</option>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={fBrand} onChange={e => setFBrand(e.target.value)} style={{ ...selectStyle, borderColor: fBrand ? ACCENT : '#e0e0e0' }}>
            <option value="">Marque</option>
            {brands.map(b => <option key={b} value={b}>{b}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TAGS.map(t => {
            const on = fTags[t.key]
            return (
              <button key={t.key} onClick={() => setFTags(prev => ({ ...prev, [t.key]: !prev[t.key] }))} style={{
                padding: '6px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: 900, fontSize: 11,
                background: on ? t.bg : '#f0f0f0', color: on ? 'white' : '#555',
              }}>{t.label}</button>
            )
          })}
          {(fTeam || fYear || fBrand || search || fTags.rc || fTags.auto || fTags.patch || fTags.num) && (
            <button onClick={() => { setSearch(''); setFTeam(''); setFYear(''); setFBrand(''); setFTags({ rc: false, auto: false, patch: false, num: false }) }}
              style={{ padding: '6px 12px', borderRadius: 20, border: '1px solid #e0e0e0', cursor: 'pointer', fontWeight: 700, fontSize: 11, background: 'white', color: '#888' }}>
              ✕ Réinitialiser
            </button>
          )}
        </div>

        <div style={{ fontSize: 11, color: '#999' }}>{filtered.length} carte{filtered.length > 1 ? 's' : ''}</div>

        <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
          {loading ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#999', padding: 20 }}>Chargement...</p>
          ) : filtered.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#999', padding: 20 }}>Aucune carte trouvée</p>
          ) : filtered.map(c => {
            const sel = pickedKeys.has(c.key)
            return (
              <div key={c.key}
                onClick={() => {
                  if (multi) setPicked(prev => sel ? prev.filter(p => p.key !== c.key) : [...prev, c])
                  else onSelect?.(c)
                }}
                style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: sel ? `2px solid ${ACCENT}` : '1px solid #eee', transition: '0.15s', position: 'relative' }}
                onMouseEnter={e => { if (!sel) e.currentTarget.style.borderColor = ACCENT }}
                onMouseLeave={e => { if (!sel) e.currentTarget.style.borderColor = '#eee' }}
              >
                <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden' }}>
                  <img src={c.img} alt={c.nom} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
                {(c.rc || c.auto || c.patch) && (
                  <div style={{ position: 'absolute', top: 3, left: 3, display: 'flex', gap: 2 }}>
                    {c.rc && <span style={{ fontSize: 7, fontWeight: 900, color: 'white', background: '#e67e22', borderRadius: 2, padding: '1px 3px' }}>RC</span>}
                    {c.auto && <span style={{ fontSize: 7, fontWeight: 900, color: 'white', background: '#2e7d32', borderRadius: 2, padding: '1px 3px' }}>AU</span>}
                    {c.patch && <span style={{ fontSize: 7, fontWeight: 900, color: 'white', background: '#1976d2', borderRadius: 2, padding: '1px 3px' }}>PA</span>}
                  </div>
                )}
                {multi && sel && (
                  <div style={{ position: 'absolute', top: 3, right: 3, width: 20, height: 20, borderRadius: '50%', background: ACCENT, color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 900 }}>✓</div>
                )}
                <div style={{ padding: '4px 6px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom}</div>
              </div>
            )
          })}
        </div>

        {multi && (
          <button onClick={() => { if (picked.length) onSelectMany?.(picked) }} disabled={!picked.length}
            className="btn-main btn-primary" style={{ opacity: picked.length ? 1 : 0.5 }}>
            Ajouter {picked.length > 0 ? `(${picked.length})` : ''}
          </button>
        )}
      </div>
    </div>,
    document.body
  )
}
