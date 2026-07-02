'use client'
import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import CardPicker, { PickableCard } from './CardPicker'

const Viewer3D = dynamic(() => import('./Viewer3D'), { ssr: false })

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
const BINDER_COLORS = ['#c0392b', '#e2b13c', '#1a1a1a', '#e8dcc4', '#1f3a5f', '#2c2c2c', '#6b2737', '#3d5a3d']
const SHELF_ROW_SIZE = 12
const PAGE_W = 230
const PAGE_H = 310
const FLIP_MS = 500

function slotKey(page: number, idx: number) { return `${page}:${idx}` }

// Effet feuille plastique : léger reflet diagonal, comme les vraies pochettes brillantes
function PlasticSheen() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
      background: 'linear-gradient(115deg, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0) 22%, rgba(255,255,255,0) 78%, rgba(255,255,255,0.22) 100%)',
    }} />
  )
}

export default function BinderLibrary({ userId, isOwner, accent, pendingCard, onPlaced, onOpenCard }: {
  userId: string; isOwner: boolean; accent: string
  // Mode placement : une carte vient d'être ajoutée, on choisit juste où la ranger
  // (clic sur une pochette vide = placement direct, pas de sélecteur de carte)
  pendingCard?: PickableCard | null
  onPlaced?: () => void
  // Ouverture d'une carte : si fourni (depuis la galerie), délègue au Viewer3D
  // complet de la galerie (avec toutes les infos + tags) via l'image de la carte.
  // Sinon, on retombe sur un Viewer3D minimal interne.
  onOpenCard?: (img: string) => boolean
}) {
  const [binders, setBinders] = useState<Binder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Binder | null>(null)
  const [slots, setSlots] = useState<Map<string, Slot>>(new Map())
  const [pageIndex, setPageIndex] = useState(0)
  const [showCreate, setShowCreate] = useState(false)
  const [newName, setNewName] = useState('')
  const [newLayout, setNewLayout] = useState(9)
  const [newColor, setNewColor] = useState(BINDER_COLORS[0])
  const [pickerTarget, setPickerTarget] = useState<{ page: number; idx: number } | null>(null)
  const [justInserted, setJustInserted] = useState<string | null>(null)
  const [viewerSlot, setViewerSlot] = useState<Slot | null>(null)

  // État du feuilletage : direction, angle courant, page affichée dans l'élément
  // qui tourne, et si l'angle doit être animé (transition CSS) ou suivre la souris 1:1
  const [flip, setFlip] = useState<{ dir: 'next' | 'prev'; angle: number; contentPage: number; anim: boolean } | null>(null)
  const dragRef = useRef<{ dir: 'next' | 'prev'; startX: number; active: boolean; angle: number; pointerId: number; el: HTMLElement } | null>(null)
  const spreadRef = useRef<HTMLDivElement>(null)

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
      user_id: userId, name: newName.trim(), layout: newLayout, color: newColor, position: binders.length,
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

  // Termine un feuilletage démarré à mi-course (clic ou glissé relâché après le seuil) :
  // continue la rotation, échange le contenu au point mort (± 90°, page vue de tranche),
  // puis referme sur le nouveau contenu et valide le changement de page.
  const finishFlip = (dir: 'next' | 'prev') => {
    if (!selected) return
    const midAngle = dir === 'next' ? -90 : 90
    const farAngle = dir === 'next' ? -179 : 179
    setFlip({ dir, angle: midAngle, contentPage: dir === 'next' ? pageIndex + 1 : pageIndex, anim: true })
    requestAnimationFrame(() => setFlip(s => s && { ...s, angle: farAngle }))
    setTimeout(() => {
      // Contenu qui « atterrit » de l'autre côté : page qui devient la nouvelle
      // page opposée (next → nouvelle page de gauche, prev → nouvelle page de droite)
      const newContentPage = dir === 'next' ? pageIndex + 2 : pageIndex - 1
      setFlip({ dir, angle: midAngle, contentPage: newContentPage, anim: false })
      requestAnimationFrame(() => setFlip(s => s && { ...s, angle: 0, anim: true }))
      setTimeout(() => {
        setPageIndex(p => dir === 'next' ? p + 2 : Math.max(0, p - 2))
        setFlip(null)
      }, FLIP_MS / 2)
    }, FLIP_MS / 2)
  }

  const cancelFlip = () => {
    setFlip(s => s && { ...s, angle: 0, anim: true })
    setTimeout(() => setFlip(null), FLIP_MS / 2)
  }

  const clickFlip = (dir: 'next' | 'prev') => {
    if (!selected || flip) return
    if (dir === 'next' && pageIndex + 2 >= selected.page_count) return
    if (dir === 'prev' && pageIndex <= 0) return
    finishFlip(dir)
  }

  // Glisser à la souris / au doigt pour tourner la page.
  // On ne capture le pointeur (et ne démarre le feuilletage) qu'au-delà d'un
  // petit seuil de déplacement : un simple clic reste un clic et atteint la
  // pochette en dessous (ajout de carte / ouverture Viewer3D).
  const beginDrag = (dir: 'next' | 'prev') => (e: React.PointerEvent) => {
    if (!selected || flip) return
    if (dir === 'next' && pageIndex + 2 >= selected.page_count) return
    if (dir === 'prev' && pageIndex <= 0) return
    dragRef.current = { dir, startX: e.clientX, active: false, angle: 0, pointerId: e.pointerId, el: e.currentTarget as HTMLElement }
  }

  const moveDrag = (e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    if (!d.active) {
      if (Math.abs(dx) < 6) return // pas encore un vrai glissé → laisse le clic passer
      d.active = true
      try { d.el.setPointerCapture(d.pointerId) } catch {}
      setFlip({ dir: d.dir, angle: 0, contentPage: d.dir === 'next' ? pageIndex + 1 : pageIndex, anim: false })
    }
    const progress = Math.max(0, Math.min(1, (d.dir === 'next' ? -dx : dx) / PAGE_W))
    d.angle = (d.dir === 'next' ? -90 : 90) * progress
    setFlip(s => s && { ...s, angle: d.angle })
  }

  const endDrag = () => {
    const d = dragRef.current
    if (!d) return
    dragRef.current = null
    if (!d.active) return // simple tap : le clic sur la pochette suit son cours
    if (Math.abs(d.angle) / 90 > 0.3) finishFlip(d.dir)
    else cancelFlip()
  }

  const renderPocketGrid = (page: number) => {
    if (!selected) return null
    if (page < 1 || page > selected.page_count) return <div style={{ visibility: 'hidden' }} />
    const n = selected.layout
    const cols = COLS[n] || 3
    return (
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 7, height: '100%', paddingTop: 14 }}>
        {Array.from({ length: n }).map((_, idx) => {
          const k = slotKey(page, idx)
          const slot = slots.get(k)
          if (slot) {
            return (
              <div key={idx} className={`binder-slot-card${justInserted === k ? ' binder-slot-card-enter' : ''}`}
                style={{ aspectRatio: '2.5/3.5', borderRadius: 4, overflow: 'hidden' }}
                onClick={() => { if (!onOpenCard || !onOpenCard(slot.img)) setViewerSlot(slot) }}
                title={slot.nom || ''}
              >
                <img src={slot.img} alt={slot.nom || ''} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 4 }} />
                <PlasticSheen />
                {isOwner && (
                  <button
                    onClick={e => { e.stopPropagation(); removeCard(page, idx) }}
                    title="Retirer du classeur"
                    style={{
                      position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.55)', color: 'white', border: 'none', fontSize: 11, lineHeight: 1,
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0,
                    }}
                    className="binder-slot-remove"
                  >✕</button>
                )}
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

  const pageShellStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    width: PAGE_W, height: PAGE_H, background: 'white',
    border: '1px solid #e5e5e5', boxSizing: 'border-box', padding: 12,
    borderRadius: side === 'left' ? '8px 0 0 8px' : '0 8px 8px 0',
    position: 'relative', overflow: 'hidden',
  })

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
        {(() => {
          const items: (Binder | 'new')[] = [...binders]
          if (isOwner) items.push('new')
          const rows: (Binder | 'new')[][] = []
          for (let i = 0; i < items.length; i += SHELF_ROW_SIZE) rows.push(items.slice(i, i + SHELF_ROW_SIZE))
          if (rows.length === 0) rows.push([])
          return (
            <div style={{ background: 'white', border: '1px solid #eee', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', padding: '20px 20px 6px' }}>
              {rows.map((row, ri) => (
                <div key={ri} style={{
                  display: 'flex', alignItems: 'flex-end', gap: 2, paddingBottom: 10,
                  borderBottom: '5px solid #f0f0f0', marginBottom: 16,
                }}>
                  {row.map(b => b === 'new' ? (
                    <div key="new" onClick={() => setShowCreate(true)} title="Nouveau classeur" style={{
                      width: 32, height: 170, cursor: 'pointer', border: '1.5px dashed #ddd', borderRadius: '3px 3px 0 0',
                      background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <span style={{ fontSize: 16, color: '#bbb' }}>+</span>
                    </div>
                  ) : (
                    <div key={b.id} onClick={() => openBinder(b)} title={`${b.name} — ${b.layout} pochettes, ${b.page_count} pages`} style={{
                      width: 32, height: 170, cursor: 'pointer', flexShrink: 0,
                      background: b.color || accent, borderRadius: '3px 3px 0 0',
                      boxShadow: 'inset 2px 0 0 rgba(255,255,255,0.12), inset -2px 0 0 rgba(0,0,0,0.15)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 8,
                      transition: 'transform 0.15s', position: 'relative',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-8px)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <span style={{
                        writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, fontWeight: 800,
                        color: 'rgba(255,255,255,0.92)', maxHeight: 130, overflow: 'hidden', textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap', letterSpacing: '0.02em',
                      }}>{b.name}</span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })()}

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
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Couleur</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {BINDER_COLORS.map(c => (
                    <button key={c} onClick={() => setNewColor(c)} style={{
                      width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', background: c,
                      border: newColor === c ? `3px solid ${accent}` : '3px solid transparent',
                      boxShadow: newColor === c ? 'none' : '0 0 0 1px #ddd',
                    }} />
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

  const flippingLeft = flip?.dir === 'prev'
  const flippingRight = flip?.dir === 'next'
  const shadowOpacity = flip ? Math.min(1, Math.abs(flip.angle) / 90) : 0

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => setSelected(null)} className="btn-main btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>
          ← Retour {pendingCard ? 'aux classeurs' : 'à la bibliothèque'}
        </button>
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

      <div style={{ background: '#f7f7f7', borderRadius: 16, padding: '36px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div ref={spreadRef} onPointerMove={moveDrag} onPointerUp={endDrag} onPointerLeave={endDrag}
          style={{ display: 'flex', position: 'relative', perspective: 1800, touchAction: 'pan-y' }}>
          {/* Page gauche — pendant un feuilletage "prev", montre déjà la page révélée dessous */}
          <div style={pageShellStyle('left')}
            onPointerDown={beginDrag('prev')}
          >
            {renderPocketGrid(flippingLeft ? pageIndex - 2 : pageIndex)}
            <PlasticSheen />
          </div>

          <div style={{ width: 0, position: 'relative', zIndex: 20 }}>
            <div style={{ position: 'absolute', top: -10, bottom: -10, left: -2, width: 4, background: 'linear-gradient(90deg, #ccc, #ddd, #ccc)', borderRadius: 2 }} />
          </div>

          {/* Page droite — pendant un feuilletage "next", montre déjà la page révélée dessous */}
          <div style={pageShellStyle('right')}
            onPointerDown={beginDrag('next')}
          >
            {renderPocketGrid(flippingRight ? pageIndex + 3 : pageIndex + 1)}
            <PlasticSheen />
          </div>

          {/* Page en train de tourner (gauche ou droite selon la direction) */}
          {flip && (
            <div
              style={{
                position: 'absolute', top: 0,
                left: flip.dir === 'next' ? PAGE_W : 0,
                width: PAGE_W, height: PAGE_H,
                transformOrigin: flip.dir === 'next' ? 'left center' : 'right center',
                transform: `rotateY(${flip.angle}deg)`,
                transition: flip.anim ? `transform ${FLIP_MS / 2}ms cubic-bezier(0.45,0.05,0.55,0.95)` : 'none',
                zIndex: 30,
              }}
            >
              <div style={{ ...pageShellStyle(flip.dir === 'next' ? 'right' : 'left'), width: '100%', height: '100%' }}>
                {renderPocketGrid(flip.contentPage)}
                <PlasticSheen />
                <div style={{
                  position: 'absolute', inset: 0, background: flip.dir === 'next' ? 'linear-gradient(to left, rgba(0,0,0,0.3), transparent 60%)' : 'linear-gradient(to right, rgba(0,0,0,0.3), transparent 60%)',
                  opacity: shadowOpacity, pointerEvents: 'none',
                }} />
              </div>
            </div>
          )}

          {/* Ombre portée sur la page statique pendant le feuilletage */}
          {flip && (
            <div style={{
              position: 'absolute', top: 0,
              left: flip.dir === 'next' ? 0 : PAGE_W, width: PAGE_W, height: PAGE_H,
              background: flip.dir === 'next' ? 'linear-gradient(to right, transparent 60%, rgba(0,0,0,0.25))' : 'linear-gradient(to left, transparent 60%, rgba(0,0,0,0.25))',
              opacity: shadowOpacity, pointerEvents: 'none', borderRadius: flip.dir === 'next' ? '8px 0 0 8px' : '0 8px 8px 0',
            }} />
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 }}>
        <button onClick={() => clickFlip('prev')} disabled={pageIndex <= 0 || !!flip} className="btn-main btn-secondary"
          style={{ padding: '8px 16px', fontSize: 13, opacity: pageIndex <= 0 ? 0.4 : 1 }}>
          ← Page précédente
        </button>
        <span style={{ fontSize: 12, color: '#999' }}>
          Pages {Math.max(1, pageIndex)}–{Math.min(selected.page_count, pageIndex + 2)} / {selected.page_count}
        </span>
        <div style={{ display: 'flex', gap: 8 }}>
          {isOwner && pageIndex + 2 >= selected.page_count && (
            <button onClick={addPage} className="btn-main btn-secondary" style={{ padding: '8px 14px', fontSize: 12 }}>+ Ajouter une page</button>
          )}
          <button onClick={() => clickFlip('next')} disabled={pageIndex + 2 >= selected.page_count || !!flip} className="btn-main btn-primary"
            style={{ padding: '8px 16px', fontSize: 13, opacity: pageIndex + 2 >= selected.page_count ? 0.4 : 1 }}>
            Page suivante →
          </button>
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

      {viewerSlot && (
        <Viewer3D
          popup={{
            f: viewerSlot.img, b: viewerSlot.img, n: viewerSlot.nom || '', t: '', y: '',
            br: '', s: '', v: '', num: '', auto: false, rc: false, patch: false, g: 'Raw',
          }}
          accent={accent}
          onClose={() => setViewerSlot(null)}
          getTags={() => null}
        />
      )}
    </div>
  )
}
