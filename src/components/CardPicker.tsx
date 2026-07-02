'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '@/lib/supabase'
import { fetchCsvCardsForProfiles } from '@/lib/csvCards'

export interface PickableCard {
  key: string
  img: string
  nom: string
}

// Sélecteur de carte parmi la collection du user (manuelles + CSV), dédupliquées par image.
export default function CardPicker({ userId, onSelect, onClose, excludeKeys }: {
  userId: string
  onSelect: (card: PickableCard) => void
  onClose: () => void
  excludeKeys?: Set<string>
}) {
  const [cards, setCards] = useState<PickableCard[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    (async () => {
      const [{ data: manuelles }, { data: profile }] = await Promise.all([
        supabase.from('cartes_manuelles').select('nom, image_recto').eq('user_id', userId).not('image_recto', 'is', null),
        supabase.from('profiles').select('id, display_name, avatar_url, lien_csv, couleur_bordure').eq('id', userId).single(),
      ])
      const seen = new Set<string>()
      const list: PickableCard[] = []
      for (const m of manuelles || []) {
        if (!m.image_recto || seen.has(m.image_recto)) continue
        seen.add(m.image_recto)
        list.push({ key: m.image_recto, img: m.image_recto, nom: m.nom || '' })
      }
      if (profile?.lien_csv) {
        const csvCards = await fetchCsvCardsForProfiles([profile])
        for (const c of csvCards) {
          if (!c.img || seen.has(c.img)) continue
          seen.add(c.img)
          list.push({ key: c.img, img: c.img, nom: c.name || '' })
        }
      }
      setCards(list)
      setLoading(false)
    })()
  }, [userId])

  const filtered = cards
    .filter(c => !excludeKeys?.has(c.key))
    .filter(c => !search || c.nom.toLowerCase().includes(search.toLowerCase()))

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 560, maxHeight: '82vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>🃏 Choisir une carte</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
        </div>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un joueur..." autoFocus />
        <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: 10 }}>
          {loading ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#999', padding: 20 }}>Chargement...</p>
          ) : filtered.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#999', padding: 20 }}>Aucune carte trouvée</p>
          ) : filtered.map(c => (
            <div key={c.key} onClick={() => onSelect(c)} style={{ cursor: 'pointer', borderRadius: 8, overflow: 'hidden', border: '1px solid #eee', transition: '0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = '#003DA6')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = '#eee')}
            >
              <div style={{ aspectRatio: '2.5/3.5', overflow: 'hidden' }}>
                <img src={c.img} alt={c.nom} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
              <div style={{ padding: '4px 6px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nom}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}
