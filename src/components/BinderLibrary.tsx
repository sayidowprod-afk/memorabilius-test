'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import CardPicker, { PickableCard } from './CardPicker'

interface Binder {
  id: number
  name: string
  layout: number
  color: string | null
  page_count: number
  position: number
}

interface Slot {
  page_number: number
  slot_index: number
  card_key: string
  img: string
  nom: string | null
}

const LAYOUTS = [4, 6, 9, 12, 16]
const COLS: Record<number, number> = { 4: 2, 6: 2, 9: 3, 12: 3, 16: 4 }

function slotKey(page: number, idx: number) { return `${page}:${idx}` }

export default function BinderLibrary({ userId, isOwner, accent, pendingCard, onPlaced }: {
  userId: string; isOwner: boolean; accent: string
  // Mode placement : une carte vient d'être ajoutée, on choisit juste où la ranger
  // (clic sur une pochette vide = placement direct, pas de sélecteur de carte)
  pendingCard?: PickableCard | null
  onPlaced?: () => void
}) {
  const [binders, setBinders] = useState<Binder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Binder | null>(null)
  const [slots, setSlots] = useState<Map<string, Slot>>(new Map())
  const [pageIndex, setPageIndex] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLayout, setNewLayout] = useState(9)
  const [pickerTarget, setPickerTarget] = useState<{ page: number; idx: number } | null>(null)
  const [justInserted, setJustInserted] = useState<string | null>(null)
  const [flipping, setFlipping] = useState(false)

  const wrapRef = useRef<HTMLDivElement>(null)
  const shadowRef = useRef<HTMLDivElement>(null)
  const dropShadowRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadBinders() }, [userId])

  const loadBinders = async () => {
    const { data } = await supabase.from('binders').select('*').eq('user_id', userId).order('position').order('id')
    setBinders(data || [])
    setLoading(false)
  }

  const openBinder = async (binder: Binder) => {
    setSelected(binder)
    setPageIndex(0)
    const { data } = await supabase.from('binder_slots').select('*').eq('binder_id', binder.id)
    const map = new Map<string, Slot>()
    for (const s of data || []) map.set(slotKey(s.page_number, s.slot_index), s)
    setSlots(map)
  }

  const createBinder = async () => {
    if (!newName.trim()) return
    const { data, error } = await supabase.from('binders').insert({
      user_id: userId, name: newName.trim(), layout: newLayout, color: accent, position: binders.length,
    }).select().single()
    if (error) { alert('Erreur : ' + error.message); return }
    setShowCreate(false)
    setNewName('')
    setBinders(prev => [...prev, data])
    openBinder(data)
  }

  const deleteBinder = async (id: number) => {
    if (!confirm('Supprimer définitivement ce classeur et son contenu ?')) return
    await supabase.from('binders').delete().eq('id', id)
    setBinders(prev => prev.filter(b => b.id !== id))
    setSelected(null)
  }

  const placeCard = async (page: number, idx: number, card: PickableCard) => {
    if (!selected) return
    const { error } = await supabase.from('binder_slots').insert({
      binder_id: selected.id, page_number: page, slot_index: idx,
      card_key: card.key, img: card.img, nom: card.nom,
    })
    if (error) { alert('Erreur : ' + error.message); return }
    const k = slotKey(page, idx)
    setSlots(prev => new Map(prev).set(k, { page_number: page, slot_index: idx, card_key: card.key, img: card.img, nom: card.nom }))
    setJustInserted(k)
    setTimeout(() => setJustInserted(null), 550)
    setPickerTarget(null)
  }

  const removeCard = async (page: number, idx: number) => {
    if (!selected) return
    await supabase.from('binder_slots').delete().eq('binder_id', selected.id).eq('page_number', page).eq('slot_index', idx)
    const k = slotKey(page, idx)
    setSlots(prev => { const m = new Map(prev); m.delete(k); return m })
  }

  const addPage = async () => {
    if (!selected) return
    const newCount = selected.page_count + 1
    await supabase.from('binders').update({ page_count: newCount }).eq('id', selected.id)
    setSelected(s => s ? { ...s, page_count: newCount } : s)
    setBinders(prev => prev.map(b => b.id === selected.id ? { ...b, page_count: newCount } : b))
  }

  const flip = (direction: 'next' | 'prev') => {
    if (!selected || flipping) return
    const wrap = wrapRef.current, shadow = shadowRef.current, drop = dropShadowRef.current
    if (!wrap || !shadow || !drop) return
    setFlipping(true)
    const ease = 'cubic-bezier(0.45,0.05,0.55,0.95)'
    if (direction === 'next') {
      wrap.style.transition = `transform 0.9s ${ease}`
      shadow.style.transition = `opacity 0.9s ${ease}`
      drop.style.transition = `opacity 0.9s ${ease}`
      wrap.style.transform = 'rotateY(-180deg)'
      shadow.style.opacity = '1'
      drop.style.opacity = '1'
      setTimeout(() => { shadow.style.opacity = '0'; drop.style.opacity = '0' }, 450)
      setTimeout(() => {
        wrap.style.transition = 'none'; shadow.style.transition = 'none'; drop.style.transition = 'none'
        wrap.style.transform = 'rotateY(0deg)'
        setPageIndex(p => p + 2)
        setFlipping(false)
      }, 900)
    } else {
      setPageIndex(p => Math.max(0, p - 2))
      wrap.style.transition = 'none'; shadow.style.transition = 'none'; drop.style.transition = 'none'
      wrap.style.transform = 'rotateY(-180deg)'
      shadow.style.opacity = '1'
      drop.style.opacity = '1'
      requestAnimationFrame(() => {
        wrap.style.transition = `transform 0.9s ${ease}`
        shadow.style.transition = `opacity 0.9s ${ease}`
        drop.style.transition = `opacity 0.9s ${ease}`
        wrap.style.transform = 'rotateY(0deg)'
        setTimeout(() => { shadow.style.opacity = '0'; drop.style.opacity = '0'; setFlipping(false) }, 900)
      })
    }
  }

  const renderPocketGrid = (page: number) => {
    if (!selected) return null
    if (page < 1 || page > selected.page_count) return <div style={{ visibility: 'hidden' }} />
    const n = selected.layout
    const cols = COLS[n] || 3
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6, height: '100%', paddingTop: 14 }}>
        {Array.from({ length: n }).map((_, idx) => {
          const k = slotKey(page, idx)
          const slot = slots.get(k)
          if (slot) {
            return (
              <div key={idx} className={`binder-slot-card${justInserted === k ? ' binder-slot-card-enter' : ''}`}
                style={{ aspectRatio: '2.5/3.5', borderRadius: 4, overflow: 'hidden' }}
                onClick={() => isOwner && removeCard(page, idx)}
                title={isOwner ? 'Cliquer pour retirer' : slot.nom || ''}
              >
                <img src={slot.img} alt={slot.nom || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 4 }} />
              </div>
            )
          }
          return (
            <div key={idx}
              onClick={async () => {
                if (!isOwner) return
                if (pendingCard) { await placeCard(page, idx, pendingCard); onPlaced?.() }
                else setPickerTarget({ page, idx })
              }}
              style={{
                aspectRatio: '2.5/3.5', borderRadius: 4, background: '#fafafa',
                border: '1px dashed #ccc', display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isOwner ? 'pointer' : 'default', color: '#bbb', fontSize: 18,
              }}
            >
              {isOwner ? '+' : ''}
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 40, color: '#999' }}>Chargement...</p>

  if (!selected) {
    return (
      <div>
        {pendingCard && (
          <div style={{ background: '#f0f4ff', border: `1px solid ${accent}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={pendingCard.img} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 3 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Choisis un classeur pour ranger « {pendingCard.nom} »</span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {binders.map(b => (
            <div key={b.id} onClick={() => openBinder(b)} style={{
              cursor: 'pointer', borderRadius: 12, overflow: 'hidden', border: '1px solid #eee',
              background: 'white', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', transition: '0.15s',
            }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
            >
              <div style={{ height: 90, background: b.color || accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ fontSize: 32 }}>📔</span>
              </div>
              <div style={{ padding: '10px 12px' }}>
                <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</div>
                <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{b.layout} pochettes · {b.page_count} pages</div>
              </div>
            </div>
          ))}
          {isOwner && (
            <div onClick={() => setShowCreate(true)} style={{
              cursor: 'pointer', borderRadius: 12, border: '2px dashed #ddd', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 140, color: '#999',
            }}>
              <span style={{ fontSize: 28 }}>+</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>Nouveau classeur</span>
            </div>
          )}
        </div>

        {binders.length === 0 && !isOwner && (
          <p style={{ textAlign: 'center', color: '#bbb', padding: 40 }}>Aucun classeur pour l'instant.</p>
        )}

        {showCreate && (
          <div onClick={() => setShowCreate(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 360, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>📔 Nouveau classeur</h3>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Nom</label>
                <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ex : Rookies 2024" autoFocus />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Pochettes par page</label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {LAYOUTS.map(n => (
                    <button key={n} onClick={() => setNewLayout(n)} style={{
                      flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13,
                      border: newLayout === n ? `2px solid ${accent}` : '2px solid #e0e0e0',
                      background: newLayout === n ? accent : 'white', color: newLayout === n ? 'white' : '#333',
                    }}>{n}</button>
                  ))}
                </div>
              </div>
              <button onClick={createBinder} disabled={!newName.trim()} className="btn-main btn-primary">Créer</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: accent, fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>← Retour {pendingCard ? 'aux classeurs' : 'à la bibliothèque'}</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontWeight: 900, fontSize: 15 }}>📔 {selected.name}</span>
          {isOwner && !pendingCard && (
            <button onClick={() => deleteBinder(selected.id)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12 }}>🗑️ Supprimer</button>
          )}
        </div>
      </div>

      {pendingCard && (
        <div style={{ background: '#f0f4ff', border: `1px solid ${accent}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={pendingCard.img} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 3 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Clique une pochette vide pour ranger « {pendingCard.nom} »</span>
        </div>
      )}

      <div style={{ background: '#f0f0f0', borderRadius: 16, padding: '32px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', perspective: 2400 }}>
        <div style={{ display: 'flex', position: 'relative' }}>
          <div style={{ width: 240, minHeight: 320, background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px 0 0 8px', padding: 12, boxSizing: 'border-box' }}>
            {renderPocketGrid(pageIndex)}
          </div>
          <div style={{ width: 0, position: 'relative', zIndex: 6 }}>
            <div style={{ position: 'absolute', top: -8, bottom: -8, left: -2, width: 4, background: '#ccc', borderRadius: 2 }} />
          </div>
          <div ref={wrapRef} style={{ width: 240, minHeight: 320, position: 'relative', transformStyle: 'preserve-3d' }}>
            <div style={{ position: 'absolute', inset: 0, background: 'white', border: '1px solid #e5e5e5', borderRadius: '0 8px 8px 0', padding: 12, boxSizing: 'border-box', backfaceVisibility: 'hidden', transformOrigin: 'left center' }}>
              {renderPocketGrid(pageIndex + 1)}
            </div>
            <div style={{ position: 'absolute', inset: 0, background: 'white', border: '1px solid #e5e5e5', borderRadius: '8px 0 0 8px', padding: 12, boxSizing: 'border-box', backfaceVisibility: 'hidden', transformOrigin: 'left center', transform: 'rotateY(180deg)' }}>
              {renderPocketGrid(pageIndex + 2)}
            </div>
            <div ref={shadowRef} style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to right, rgba(0,0,0,0.35), transparent 55%)', opacity: 0, borderRadius: '0 8px 8px 0' }} />
          </div>
          <div ref={dropShadowRef} style={{ position: 'absolute', left: 240, top: 6, bottom: -10, width: 240, boxShadow: '-18px 0 30px -12px rgba(0,0,0,0.35)', opacity: 0, pointerEvents: 'none', borderRadius: '0 8px 8px 0' }} />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <button onClick={() => flip('prev')} disabled={pageIndex <= 0 || flipping} style={{ opacity: pageIndex <= 0 ? 0.4 : 1 }}>← Page précédente</button>
        <span style={{ fontSize: 12, color: '#999' }}>
          Pages {Math.max(1, pageIndex)}–{Math.min(selected.page_count, pageIndex + 2)} / {selected.page_count}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {isOwner && pageIndex + 2 >= selected.page_count && (
            <button onClick={addPage} style={{ fontSize: 12 }}>+ Ajouter une page</button>
          )}
          <button onClick={() => flip('next')} disabled={pageIndex + 2 >= selected.page_count || flipping} style={{ opacity: pageIndex + 2 >= selected.page_count ? 0.4 : 1 }}>Page suivante →</button>
        </div>
      </div>

      {pickerTarget && (
        <CardPicker
          userId={userId}
          excludeKeys={new Set([...slots.values()].map(s => s.card_key))}
          onClose={() => setPickerTarget(null)}
          onSelect={card => placeCard(pickerTarget.page, pickerTarget.idx, card)}
        />
      )}
    </div>
  )
}
