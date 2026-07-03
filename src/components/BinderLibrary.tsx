'use client'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import CardPicker, { PickableCard } from './CardPicker'

const Viewer3D = dynamic(() => import('./Viewer3D'), { ssr: false })

interface Binder {
  id: number
  name: string
  subtitle: string | null
  layout: number
  color: string | null
  cover_img: string | null
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
const PAGE_MAX_W = 300
const PAGE_RATIO = 310 / 230 // hauteur / largeur d'une page
const FLIP_MS = 620

function slotKey(page: number, idx: number) { return `${page}:${idx}` }

// Effet feuille plastique : léger reflet diagonal, comme les vraies pochettes brillantes
function PlasticSheen() {
  return (
    <div style={{
      position: 'absolute', inset: 0, pointerEvents: 'none', borderRadius: 'inherit',
      background: 'linear-gradient(115deg, rgba(255,255,255,0.18) 0%, rgba(255,255,255,0) 20%, rgba(255,255,255,0) 82%, rgba(255,255,255,0.08) 100%)',
    }} />
  )
}

export default function BinderLibrary({ userId, isOwner, accent, pendingCard, onPlaced, onOpenCard }: {
  userId: string; isOwner: boolean; accent: string
  pendingCard?: PickableCard | null
  onPlaced?: () => void
  onOpenCard?: (img: string) => boolean
}) {
  const [binders, setBinders] = useState<Binder[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Binder | null>(null)
  const [slots, setSlots] = useState<Map<string, Slot>>(new Map())
  // Page gauche du double-feuillet, PAIRE (0, 2, 4…). Comme un vrai classeur :
  // 0 = intérieur de couverture (gauche) + page 1 seule à droite, puis 2–3, 4–5…
  const [pageIndex, setPageIndex] = useState(0)
  const [isOpen, setIsOpen] = useState(false)   // classeur ouvert (pages) ou fermé (couverture)
  const [pickerTarget, setPickerTarget] = useState<{ page: number; idx: number } | null>(null)
  const [multiPicker, setMultiPicker] = useState(false)
  const [coverAnimating, setCoverAnimating] = useState(false)
  const [coverAngle, setCoverAngle] = useState(0)
  const [justInserted, setJustInserted] = useState<string | null>(null)
  const [viewerSlot, setViewerSlot] = useState<Slot | null>(null)
  // Glisser-déplacer d'une carte d'une pochette à une autre
  const [cardDrag, setCardDrag] = useState<{ img: string; x: number; y: number } | null>(null)
  const cardDragRef = useRef<{ page: number; idx: number; slot: Slot; startX: number; startY: number; active: boolean; pointerId: number; el: HTMLElement; timer: number } | null>(null)
  const openSpreadRef = useRef<HTMLDivElement>(null)
  const flipCooldownRef = useRef(0)

  // Formulaire création/édition partagé. null = fermé, 'create' = nouveau, number = id à éditer
  const [formOpen, setFormOpen] = useState<null | 'create' | number>(null)
  const [fName, setFName] = useState('')
  const [fSubtitle, setFSubtitle] = useState('')
  const [fLayout, setFLayout] = useState(9)
  const [fColor, setFColor] = useState(BINDER_COLORS[0])
  const [fCover, setFCover] = useState<string | null>(null)
  const [uploadingCover, setUploadingCover] = useState(false)
  const coverInputRef = useRef<HTMLInputElement>(null)

  const [pageW, setPageW] = useState(PAGE_MAX_W)
  const stageRef = useRef<HTMLDivElement>(null)
  const pageH = Math.round(pageW * PAGE_RATIO)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const avail = el.clientWidth - 32
      setPageW(Math.max(120, Math.min(PAGE_MAX_W, Math.floor(avail / 2))))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [selected])

  // Feuilletage à deux faces : la feuille tourne en continu de 0 à ±180°.
  // Face avant = page qui part, face arrière (pré-retournée) = page qui arrive.
  const [flip, setFlip] = useState<{ dir: 'next' | 'prev'; angle: number; anim: boolean } | null>(null)
  // Fenêtre pendant laquelle les clics de pochette sont ignorés (juste après un glissé).
  // Plus fiable qu'un booléen : couvre le clic « fantôme » qui arrive après un feuilletage.
  const suppressClickUntil = useRef(0)
  const clickSuppressed = () => Date.now() < suppressClickUntil.current
  const spreadRef = useRef<HTMLDivElement>(null)

  useEffect(() => { loadBinders() }, [userId])

  // Filet de sécurité : si un pointeur est relâché/annulé n'importe où et que le
  // garde-fou anti-clic est resté « à l'infini » sans glissé actif, on le réarme.
  useEffect(() => {
    const reset = () => {
      const anyActive = swipeRef.current?.active || cardDragRef.current?.active || reorderRef.current?.active
      if (!anyActive && suppressClickUntil.current > Date.now() + 50000) {
        suppressClickUntil.current = Date.now() + 200
      }
    }
    window.addEventListener('pointerup', reset)
    window.addEventListener('pointercancel', reset)
    return () => { window.removeEventListener('pointerup', reset); window.removeEventListener('pointercancel', reset) }
  }, [])

  const loadBinders = async () => {
    const { data } = await supabase.from('binders').select('*').eq('user_id', userId).order('position').order('id')
    setBinders(data || [])
    setLoading(false)
  }

  const openBinder = async (binder: Binder) => {
    setSelected(binder)
    setPageIndex(0)
    setIsOpen(false)
    const { data } = await supabase.from('binder_slots').select('*').eq('binder_id', binder.id)
    const map = new Map<string, Slot>()
    for (const s of data || []) map.set(slotKey(s.page_number, s.slot_index), s)
    setSlots(map)
  }

  const openCreateForm = () => {
    setFName(''); setFSubtitle(''); setFLayout(9); setFColor(BINDER_COLORS[0]); setFCover(null)
    setFormOpen('create')
  }
  const openEditForm = (b: Binder) => {
    setFName(b.name); setFSubtitle(b.subtitle || ''); setFLayout(b.layout); setFColor(b.color || BINDER_COLORS[0]); setFCover(b.cover_img)
    setFormOpen(b.id)
  }

  const uploadCover = async (file: File) => {
    if (file.size > 4 * 1024 * 1024) { alert('Image trop lourde (max 4 Mo)'); return }
    setUploadingCover(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = `binders/${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (error) { alert('Erreur upload : ' + error.message); setUploadingCover(false); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setFCover(data.publicUrl)
    setUploadingCover(false)
  }

  const saveForm = async () => {
    if (!fName.trim()) return
    const payload = { name: fName.trim(), subtitle: fSubtitle.trim() || null, color: fColor, cover_img: fCover }
    if (formOpen === 'create') {
      const { data, error } = await supabase.from('binders').insert({
        user_id: userId, layout: fLayout, position: binders.length, ...payload,
      }).select().single()
      if (error) { alert('Erreur : ' + error.message); return }
      setBinders(prev => [...prev, data])
      setFormOpen(null)
      openBinder(data)
    } else {
      const id = formOpen as number
      const { error } = await supabase.from('binders').update(payload).eq('id', id)
      if (error) { alert('Erreur : ' + error.message); return }
      setBinders(prev => prev.map(b => b.id === id ? { ...b, ...payload } : b))
      setSelected(s => s && s.id === id ? { ...s, ...payload } : s)
      setFormOpen(null)
    }
  }

  const deleteBinder = async (id: number) => {
    if (!confirm('Supprimer définitivement ce classeur et son contenu ?')) return
    await supabase.from('binders').delete().eq('id', id)
    setBinders(prev => prev.filter(b => b.id !== id))
    setSelected(null)
  }

  // Réorganisation des classeurs par glisser-déposer.
  // On ne réordonne PAS le tableau pendant le glissé (sinon React re-render les
  // tranches et la capture du pointeur se perd → blocage). Aperçu flottant, puis
  // réorganisation uniquement au relâchement, sur la tranche survolée.
  const reorderRef = useRef<{ binder: Binder; startX: number; startY: number; active: boolean; pointerId: number; el: HTMLElement } | null>(null)
  const [reorderingId, setReorderingId] = useState<number | null>(null)
  const [reorderDrag, setReorderDrag] = useState<{ binder: Binder; x: number; y: number } | null>(null)

  const shelfPointerDown = (b: Binder) => (e: React.PointerEvent) => {
    if (!isOwner) return
    reorderRef.current = { binder: b, startX: e.clientX, startY: e.clientY, active: false, pointerId: e.pointerId, el: e.currentTarget as HTMLElement }
  }
  const shelfPointerMove = (e: React.PointerEvent) => {
    const r = reorderRef.current
    if (!r) return
    if (!r.active) {
      if (Math.hypot(e.clientX - r.startX, e.clientY - r.startY) < 6) return
      r.active = true
      suppressClickUntil.current = Date.now() + 100000
      setReorderingId(r.binder.id)
      try { r.el.setPointerCapture(r.pointerId) } catch {}
    }
    setReorderDrag({ binder: r.binder, x: e.clientX, y: e.clientY })
  }
  const shelfPointerUp = (e: React.PointerEvent) => {
    const r = reorderRef.current
    reorderRef.current = null
    if (!r) return
    setReorderDrag(null)
    setReorderingId(null)
    if (!r.active) return
    suppressClickUntil.current = Date.now() + 300
    const targetEl = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-binder-spine]') as HTMLElement | null
    const overId = targetEl ? Number(targetEl.dataset.binderSpine) : NaN
    if (Number.isNaN(overId) || overId === r.binder.id) return
    setBinders(prev => {
      const from = prev.findIndex(b => b.id === r.binder.id)
      const to = prev.findIndex(b => b.id === overId)
      if (from < 0 || to < 0) return prev
      const next = [...prev]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      next.forEach((b, i) => { supabase.from('binders').update({ position: i }).eq('id', b.id) })
      return next
    })
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

  // Ajoute plusieurs cartes d'un coup dans les premières pochettes vides (crée des pages si besoin)
  const placeMany = async (cards: PickableCard[]) => {
    if (!selected || !cards.length) return
    const remaining = [...cards]
    const inserts: any[] = []
    const localAdds = new Map<string, Slot>()
    let page = 1
    let pageCount = selected.page_count
    while (remaining.length) {
      if (page > pageCount) pageCount++ // nouvelle page vide
      for (let idx = 0; idx < selected.layout && remaining.length; idx++) {
        const k = slotKey(page, idx)
        if (slots.has(k) || localAdds.has(k)) continue
        const card = remaining.shift()!
        const row = { binder_id: selected.id, page_number: page, slot_index: idx, card_key: card.key, img: card.img, nom: card.nom }
        inserts.push(row)
        localAdds.set(k, { page_number: page, slot_index: idx, card_key: card.key, img: card.img, nom: card.nom })
      }
      page++
    }
    if (pageCount !== selected.page_count) {
      await supabase.from('binders').update({ page_count: pageCount }).eq('id', selected.id)
      setSelected(s => s ? { ...s, page_count: pageCount } : s)
      setBinders(prev => prev.map(b => b.id === selected.id ? { ...b, page_count: pageCount } : b))
    }
    const { error } = await supabase.from('binder_slots').insert(inserts)
    if (error) { alert('Erreur : ' + error.message); openBinder(selected); return }
    setSlots(prev => { const m = new Map(prev); for (const [k, v] of localAdds) m.set(k, v); return m })
  }

  // Déplace une carte d'une pochette vers une autre (échange si la cible est occupée)
  const moveSlot = async (fromPage: number, fromIdx: number, toPage: number, toIdx: number) => {
    if (!selected) return
    const fromKey = slotKey(fromPage, fromIdx), toKey = slotKey(toPage, toIdx)
    const fromSlot = slots.get(fromKey)
    if (!fromSlot) return
    const toSlot = slots.get(toKey)

    // Mise à jour optimiste locale
    setSlots(prev => {
      const m = new Map(prev)
      m.set(toKey, { ...fromSlot, page_number: toPage, slot_index: toIdx })
      if (toSlot) m.set(fromKey, { ...toSlot, page_number: fromPage, slot_index: fromIdx })
      else m.delete(fromKey)
      return m
    })

    // Persistance : on supprime puis réinsère les lignes concernées (contrainte unique)
    await supabase.from('binder_slots').delete().eq('binder_id', selected.id).eq('page_number', fromPage).eq('slot_index', fromIdx)
    if (toSlot) await supabase.from('binder_slots').delete().eq('binder_id', selected.id).eq('page_number', toPage).eq('slot_index', toIdx)
    const rows = [{ binder_id: selected.id, page_number: toPage, slot_index: toIdx, card_key: fromSlot.card_key, img: fromSlot.img, nom: fromSlot.nom }]
    if (toSlot) rows.push({ binder_id: selected.id, page_number: fromPage, slot_index: fromIdx, card_key: toSlot.card_key, img: toSlot.img, nom: toSlot.nom })
    const { error } = await supabase.from('binder_slots').insert(rows)
    if (error) { alert('Erreur : ' + error.message); openBinder(selected) }
  }

  // Déplacer une carte = APPUI LONG puis glisser (pour ne pas confondre avec le
  // swipe de page, surtout sur mobile où les cartes remplissent la page).
  // Un glissé horizontal avant l'appui long → c'est un swipe de page (géré par la scène).
  const cardPointerDown = (page: number, idx: number, slot: Slot) => (e: React.PointerEvent) => {
    if (!isOwner || pendingCard || flip) return
    // PAS de stopPropagation : la scène doit aussi voir le geste pour un éventuel swipe
    const el = e.currentTarget as HTMLElement
    const pointerId = e.pointerId
    const timer = window.setTimeout(() => {
      const c = cardDragRef.current
      if (!c || c.active) return
      if (swipeRef.current?.active) { cardDragRef.current = null; return } // un swipe a démarré → pas de saisie
      swipeRef.current = null // annule le candidat swipe : ce geste est une saisie de carte
      c.active = true
      suppressClickUntil.current = Date.now() + 100000
      try { el.setPointerCapture(pointerId) } catch {}
      setCardDrag({ img: c.slot.img, x: c.startX, y: c.startY })
      try { (navigator as any).vibrate?.(15) } catch {}
    }, 160)
    cardDragRef.current = { page, idx, slot, startX: e.clientX, startY: e.clientY, active: false, pointerId, el, timer }
  }
  const cardPointerMove = (e: React.PointerEvent) => {
    const c = cardDragRef.current
    if (!c) return
    if (!c.active) {
      // bougé avant l'appui long → ce n'est pas une saisie de carte (swipe/scroll)
      if (Math.hypot(e.clientX - c.startX, e.clientY - c.startY) > 8) { clearTimeout(c.timer); cardDragRef.current = null }
      return
    }
    e.stopPropagation()
    setCardDrag({ img: c.slot.img, x: e.clientX, y: e.clientY })
    // Près d'un bord → tourne la page pour pouvoir déposer sur une autre page
    const rect = openSpreadRef.current?.getBoundingClientRect()
    if (rect && !flip && Date.now() > flipCooldownRef.current) {
      if (e.clientX > rect.right - 28 && canNext) { flipCooldownRef.current = Date.now() + 800; clickFlip('next') }
      else if (e.clientX < rect.left + 28 && canPrev) { flipCooldownRef.current = Date.now() + 800; clickFlip('prev') }
    }
  }
  const cardPointerUp = (e: React.PointerEvent) => {
    const c = cardDragRef.current
    cardDragRef.current = null
    if (!c) return
    clearTimeout(c.timer)
    if (!c.active) return // appui simple → l'onClick ouvre la carte
    suppressClickUntil.current = Date.now() + 400
    setCardDrag(null)
    const target = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest('[data-pocket]') as HTMLElement | null
    if (target) {
      const tPage = Number(target.dataset.page), tIdx = Number(target.dataset.idx)
      if (!Number.isNaN(tPage) && !Number.isNaN(tIdx) && !(tPage === c.page && tIdx === c.idx)) {
        moveSlot(c.page, c.idx, tPage, tIdx)
      }
    }
  }
  const cardPointerCancel = () => {
    const c = cardDragRef.current
    cardDragRef.current = null
    if (c) clearTimeout(c.timer)
    setCardDrag(null)
    if (c?.active) suppressClickUntil.current = Date.now() + 400
  }

  // Bornes de navigation : feuillets [g, g+1] avec g pair (0 = couverture + page 1)
  const canNext = selected ? pageIndex + 2 <= selected.page_count : false
  const canPrev = pageIndex > 0

  // Termine le feuilletage : rotation continue jusqu'à ±180° puis validation
  const finishFlip = (dir: 'next' | 'prev') => {
    setFlip(s => ({ dir, angle: dir === 'next' ? -180 : 180, anim: true, ...(s ? {} : {}) }))
    setTimeout(() => {
      setPageIndex(p => dir === 'next' ? p + 2 : Math.max(0, p - 2))
      setFlip(null)
    }, FLIP_MS)
  }

  const cancelFlip = () => {
    setFlip(s => s && { ...s, angle: 0, anim: true })
    setTimeout(() => setFlip(null), FLIP_MS)
  }

  const clickFlip = (dir: 'next' | 'prev') => {
    if (!selected || flip) return
    if (dir === 'next' && !canNext) return
    if (dir === 'prev' && !canPrev) return
    // Neutralise les clics pendant toute l'animation (sinon on sélectionne une
    // carte de la page révélée dessous en cours de feuilletage)
    suppressClickUntil.current = Date.now() + FLIP_MS + 150
    setFlip({ dir, angle: 0, anim: false })
    requestAnimationFrame(() => finishFlip(dir))
  }

  // ── Swipe pour tourner la page : UN seul détecteur sur toute la scène ──
  // Ne démarre que sur un glissé nettement horizontal (> vertical), ce qui le
  // distingue d'un tap sur pochette. Les cartes pleines gèrent leur propre glissé
  // (stopPropagation) et ne déclenchent donc pas le swipe de page.
  const swipeRef = useRef<{ startX: number; startY: number; active: boolean; dir: 'next' | 'prev' | null; pointerId: number; angle: number } | null>(null)

  const spreadPointerDown = (e: React.PointerEvent) => {
    if (flip || pendingCard) return
    swipeRef.current = { startX: e.clientX, startY: e.clientY, active: false, dir: null, pointerId: e.pointerId, angle: 0 }
  }
  const spreadPointerMove = (e: React.PointerEvent) => {
    if (cardDragRef.current?.active) return // une carte est en cours de déplacement → pas de swipe
    const s = swipeRef.current
    if (!s) return
    const dx = e.clientX - s.startX, dy = e.clientY - s.startY
    if (!s.active) {
      // exige un mouvement horizontal dominant avant de considérer un swipe
      if (Math.abs(dx) < 12 || Math.abs(dx) <= Math.abs(dy)) return
      const dir: 'next' | 'prev' = dx < 0 ? 'next' : 'prev'
      if (dir === 'next' && !canNext) { swipeRef.current = null; return }
      if (dir === 'prev' && !canPrev) { swipeRef.current = null; return }
      s.active = true
      s.dir = dir
      suppressClickUntil.current = Date.now() + 100000
      try { openSpreadRef.current?.setPointerCapture(s.pointerId) } catch {}
      setFlip({ dir, angle: 0, anim: false })
    }
    const progress = Math.max(0, Math.min(1, (s.dir === 'next' ? -dx : dx) / (pageW * 0.6)))
    s.angle = (s.dir === 'next' ? -180 : 180) * progress
    setFlip(f => f && { ...f, angle: s.angle })
  }
  // Fin du swipe — appelé par pointerup ET pointercancel (sinon geste resté « bloqué »
  // quand le navigateur annule le pointeur, ce qui figeait la page et tous les clics)
  const endSwipe = () => {
    const s = swipeRef.current
    swipeRef.current = null
    if (!s || !s.active || !s.dir) return // simple tap → laisse le clic ouvrir la carte
    suppressClickUntil.current = Date.now() + 400
    if (Math.abs(s.angle) > 45) finishFlip(s.dir)
    else cancelFlip()
  }

  // Bande de reliure perforée (façon pochette Ultra Pro), sur le bord intérieur
  const BindingStrip = () => {
    const small = pageW < 180
    const hole = (oval: boolean) => (
      <div style={{
        width: small ? 6 : 8, height: oval ? (small ? 14 : 18) : (small ? 6 : 8),
        borderRadius: oval ? (small ? 3 : 4) : '50%',
        background: 'radial-gradient(circle at 40% 35%, #cfd6dd, #aeb7c0)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.35)',
      }} />
    )
    return (
      <div style={{
        width: small ? 14 : 18, flexShrink: 0, alignSelf: 'stretch',
        background: 'linear-gradient(90deg, rgba(255,255,255,0.75), rgba(228,236,244,0.55))',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-around', alignItems: 'center',
        padding: '10px 0',
      }}>
        {hole(true)}{hole(false)}{hole(true)}
      </div>
    )
  }

  const renderPocketGrid = (page: number, side: 'left' | 'right') => {
    if (!selected) return null
    if (page < 1 || page > selected.page_count) return <div style={{ visibility: 'hidden' }} />
    const n = selected.layout
    const cols = COLS[n] || 3
    const small = pageW < 180
    const grid = (
      <div style={{ flex: 1, minWidth: 0, display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: small ? 5 : 8, alignContent: 'center', padding: small ? '6px 4px' : '10px 6px' }}>
        {Array.from({ length: n }).map((_, idx) => {
          const k = slotKey(page, idx)
          const slot = slots.get(k)
          if (slot) {
            return (
              <div key={idx} data-pocket data-page={page} data-idx={idx}
                className={`binder-slot-card${justInserted === k ? ' binder-slot-card-enter' : ''}`}
                style={{ aspectRatio: '2.5/3.5', overflow: 'hidden', boxShadow: '0 0 0 1px rgba(150,165,180,0.4)', touchAction: 'none', opacity: cardDrag && cardDragRef.current?.active && cardDragRef.current?.page === page && cardDragRef.current?.idx === idx ? 0.35 : 1 }}
                onPointerDown={cardPointerDown(page, idx, slot)}
                onPointerMove={cardPointerMove}
                onPointerUp={cardPointerUp}
                onPointerCancel={cardPointerCancel}
                onClick={() => {
                  if (flip || clickSuppressed()) return
                  if (!onOpenCard || !onOpenCard(slot.img)) setViewerSlot(slot)
                }}
                title={isOwner ? 'Appui long pour déplacer · clic pour ouvrir' : (slot.nom || '')}
              >
                <img src={slot.img} alt={slot.nom || ''} loading="lazy" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
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
          // Pochette plastique vide : cellule translucide avec soudure
          return (
            <div key={idx} data-pocket data-page={page} data-idx={idx}
              onClick={async () => {
                if (!isOwner) return
                if (flip || clickSuppressed()) return
                if (pendingCard) { await placeCard(page, idx, pendingCard); onPlaced?.() }
                else setPickerTarget({ page, idx })
              }}
              style={{
                aspectRatio: '2.5/3.5', background: 'rgba(255,255,255,0.35)',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.8), 0 0 0 1px rgba(150,165,180,0.45)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: isOwner ? 'pointer' : 'default', color: 'rgba(90,110,130,0.5)', fontSize: 18,
              }}
            >
              {isOwner ? '+' : ''}
            </div>
          )
        })}
      </div>
    )
    return (
      <div style={{ display: 'flex', flexDirection: side === 'left' ? 'row' : 'row-reverse', height: '100%', width: '100%' }}>
        {grid}
        <BindingStrip />
      </div>
    )
  }

  // Page = feuille plastique transparente (Ultra Pro) : léger voile bleuté + brillance
  const pageShellStyle = (side: 'left' | 'right'): React.CSSProperties => ({
    width: pageW, height: pageH, boxSizing: 'border-box',
    background: 'linear-gradient(135deg, #f0f4f8 0%, #e4ebf2 55%, #eef3f8 100%)',
    borderTop: '1px solid rgba(255,255,255,0.7)', borderBottom: '1px solid rgba(150,165,180,0.3)',
    borderRadius: side === 'left' ? '4px 2px 2px 4px' : '2px 4px 4px 2px',
    position: 'relative', overflow: 'hidden',
  })

  // ── Formulaire création / édition (partagé) ──
  const binderForm = formOpen !== null && (
    <div onClick={() => setFormOpen(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, maxHeight: '88vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>📔 {formOpen === 'create' ? 'Nouveau classeur' : 'Modifier le classeur'}</h3>

        {/* Aperçu couverture */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
          <div style={{ width: 90, height: 122, borderRadius: 8, overflow: 'hidden', flexShrink: 0, position: 'relative', background: fColor, boxShadow: '0 2px 8px rgba(0,0,0,0.15)' }}>
            {fCover && <img src={fCover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 45%, rgba(0,0,0,0.5))' }} />
            <div style={{ position: 'absolute', left: 4, right: 4, bottom: 6, textAlign: 'center' }}>
              <span style={{ display: 'inline-block', maxWidth: '92%', background: 'rgba(255,255,255,0.95)', color: '#111', borderRadius: 4, padding: '3px 5px', fontSize: 9, fontWeight: 900, lineHeight: 1.1, wordBreak: 'break-word' }}>{fName || 'Nom'}</span>
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => coverInputRef.current?.click()} className="btn-main btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }}>
              {uploadingCover ? '...' : fCover ? '🖼️ Changer la couverture' : '🖼️ Ajouter une couverture'}
            </button>
            {fCover && (
              <button onClick={() => setFCover(null)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12, textAlign: 'left' }}>Retirer l'image</button>
            )}
            <input ref={coverInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files?.[0]; if (f) uploadCover(f); e.target.value = '' }} />
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Nom</label>
          <input value={fName} onChange={e => setFName(e.target.value)} placeholder="Ex : Rookies 2024" autoFocus />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Sous-titre (optionnel)</label>
          <input value={fSubtitle} onChange={e => setFSubtitle(e.target.value)} placeholder="Ex : Panini Prizm" />
        </div>

        {formOpen === 'create' && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Pochettes par page</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {LAYOUTS.map(n => (
                <button key={n} onClick={() => setFLayout(n)} style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer', fontWeight: 800, fontSize: 13,
                  border: fLayout === n ? `2px solid ${accent}` : '2px solid #e0e0e0',
                  background: fLayout === n ? accent : 'white', color: fLayout === n ? 'white' : '#333',
                }}>{n}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#888', display: 'block', marginBottom: 6 }}>Couleur</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {BINDER_COLORS.map(c => (
              <button key={c} onClick={() => setFColor(c)} style={{
                width: 30, height: 30, borderRadius: '50%', cursor: 'pointer', background: c,
                border: fColor === c ? `3px solid ${accent}` : '3px solid transparent',
                boxShadow: fColor === c ? 'none' : '0 0 0 1px #ddd',
              }} />
            ))}
          </div>
        </div>

        <button onClick={saveForm} disabled={!fName.trim()} className="btn-main btn-primary">
          {formOpen === 'create' ? 'Créer' : 'Enregistrer'}
        </button>
      </div>
    </div>
  )

  if (loading) return <p style={{ textAlign: 'center', padding: 40, color: '#999' }}>Chargement...</p>

  // ── Vue étagère ──
  if (!selected) {
    const items: (Binder | 'new')[] = [...binders]
    if (isOwner) items.push('new')
    const rows: (Binder | 'new')[][] = []
    for (let i = 0; i < items.length; i += SHELF_ROW_SIZE) rows.push(items.slice(i, i + SHELF_ROW_SIZE))
    if (rows.length === 0) rows.push([])
    return (
      <div>
        {pendingCard && (
          <div style={{ background: '#f0f4ff', border: `1px solid ${accent}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src={pendingCard.img} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 3 }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Choisis un classeur pour ranger « {pendingCard.nom} »</span>
          </div>
        )}
        <div style={{ background: 'linear-gradient(180deg, #6b4a32, #4e3623)', borderRadius: 16, boxShadow: '0 6px 24px rgba(0,0,0,0.18)', padding: '18px 14px 4px' }}>
          {rows.map((row, ri) => (
            <div key={ri} style={{ marginBottom: 16 }}>
              <div style={{
                display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 6px 10px',
                overflowX: 'auto', WebkitOverflowScrolling: 'touch', minHeight: 190,
              }}>
                {row.map(b => b === 'new' ? (
                  <div key="new" onClick={openCreateForm} title="Nouveau classeur" style={{
                    width: 40, height: 184, cursor: 'pointer', border: '2px dashed rgba(255,255,255,0.35)', borderRadius: '4px 4px 0 0',
                    background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: 'rgba(255,255,255,0.6)', fontSize: 20,
                  }}>+</div>
                ) : (
                  <div key={b.id} data-binder-spine={b.id}
                    onClick={() => { if (clickSuppressed()) return; openBinder(b) }}
                    onPointerDown={shelfPointerDown(b)}
                    onPointerMove={shelfPointerMove}
                    onPointerUp={shelfPointerUp}
                    title={isOwner ? `${b.name} — glisser pour réorganiser` : b.name}
                    style={{
                      width: 40, height: 184, cursor: isOwner ? 'grab' : 'pointer', flexShrink: 0,
                      background: b.color || accent, borderRadius: '4px 4px 0 0',
                      boxShadow: 'inset 4px 0 0 rgba(255,255,255,0.2), inset -4px 0 0 rgba(0,0,0,0.28), 2px 2px 5px rgba(0,0,0,0.4)',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', touchAction: isOwner ? 'none' : 'auto',
                      transition: 'transform 0.15s', position: 'relative', overflow: 'hidden',
                      opacity: reorderingId === b.id ? 0.4 : 1,
                    }}
                    onMouseEnter={e => { if (!reorderingId) e.currentTarget.style.transform = 'translateY(-12px)' }}
                    onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                  >
                    {b.cover_img && (
                      <div style={{ width: '100%', height: 46, flexShrink: 0, overflow: 'hidden', borderBottom: '1px solid rgba(0,0,0,0.2)' }}>
                        <img src={b.cover_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                    <div style={{ flex: 1 }} />
                    {/* étiquette blanche imprimée comme sur les vrais classeurs */}
                    <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 2, margin: '0 4px 14px', padding: '10px 2px', boxShadow: '0 1px 3px rgba(0,0,0,0.25)', display: 'flex', justifyContent: 'center', maxHeight: 120 }}>
                      <span style={{
                        writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 10, fontWeight: 800,
                        color: '#333', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        maxHeight: 100, letterSpacing: '0.02em',
                      }}>{b.name}</span>
                    </div>
                  </div>
                ))}
              </div>
              {/* planche en bois de l'étagère */}
              <div style={{ height: 12, background: 'linear-gradient(180deg, #3a281a, #2a1d12)', borderRadius: 2, boxShadow: '0 4px 8px rgba(0,0,0,0.4)' }} />
            </div>
          ))}
        </div>

        {binders.length === 0 && !isOwner && (
          <p style={{ textAlign: 'center', color: '#bbb', padding: 40 }}>Aucun classeur pour l'instant.</p>
        )}

        {/* Aperçu flottant de la tranche pendant la réorganisation */}
        {reorderDrag && createPortal(
          <div style={{
            position: 'fixed', left: reorderDrag.x, top: reorderDrag.y, width: 40, height: 150,
            transform: 'translate(-50%, -50%) rotate(-3deg)', zIndex: 3000, pointerEvents: 'none',
            background: reorderDrag.binder.color || accent, borderRadius: '4px 4px 0 0',
            boxShadow: '0 12px 28px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10,
          }}>
            <div style={{ background: 'rgba(255,255,255,0.95)', borderRadius: 2, padding: '8px 2px', maxHeight: 100 }}>
              <span style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', fontSize: 9, fontWeight: 800, color: '#333', whiteSpace: 'nowrap' }}>{reorderDrag.binder.name}</span>
            </div>
          </div>,
          document.body
        )}

        {binderForm}
      </div>
    )
  }

  // ── Vue classeur ouvert ──
  const flippingLeft = flip?.dir === 'prev'
  const flippingRight = flip?.dir === 'next'
  // Ombrage de la feuille qui tourne : nul à plat, max de profil (90°), nul retourné (180°)
  const shadowOpacity = flip ? Math.sin(Math.min(Math.abs(flip.angle), 180) * Math.PI / 180) * 0.7 : 0

  const wing = Math.max(10, Math.round(pageW * 0.05))
  const coverColor = selected.color || accent
  const coverW = Math.round(pageW * 1.12)
  const coverH = Math.round(pageH * 1.04)

  // Contenu de la couverture (réutilisé pour le classeur fermé et l'animation d'ouverture)
  const coverFace = (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: coverColor }}>
      {selected.cover_img && <img src={selected.cover_img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.06) 35%, rgba(0,0,0,0.5))' }} />
      <div style={{ position: 'absolute', top: 12, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.8)', fontSize: 10, letterSpacing: '0.2em', fontWeight: 700 }}>MEMORABILIUS</div>
      <div style={{ position: 'absolute', left: 14, right: 14, bottom: '14%', textAlign: 'center' }}>
        <div style={{ display: 'inline-block', maxWidth: '90%', background: 'rgba(255,255,255,0.96)', color: '#111', borderRadius: 8, padding: pageW < 200 ? '8px 12px' : '12px 16px', boxShadow: '0 3px 12px rgba(0,0,0,0.35)' }}>
          <div style={{ fontWeight: 900, fontSize: pageW < 200 ? 15 : 19, lineHeight: 1.15, wordBreak: 'break-word' }}>{selected.name}</div>
          {selected.subtitle && <div style={{ fontSize: pageW < 200 ? 11 : 13, color: '#666', marginTop: 3 }}>{selected.subtitle}</div>}
        </div>
      </div>
      <PlasticSheen />
    </div>
  )

  // Intérieur de couverture (carton) : montré à gauche à l'ouverture (page 0) et
  // à droite après la dernière page, comme les 2e/3e de couverture d'un vrai classeur.
  const insideCoverFace = (side: 'left' | 'right') => (
    <div style={{
      width: pageW, height: pageH, boxSizing: 'border-box',
      background: `linear-gradient(${side === 'left' ? '135deg' : '225deg'}, ${coverColor}, rgba(0,0,0,0.45))`,
      borderRadius: side === 'left' ? '4px 2px 2px 4px' : '2px 4px 4px 2px',
      position: 'relative', overflow: 'hidden',
      boxShadow: 'inset 0 0 45px rgba(0,0,0,0.45)',
    }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.22)', fontSize: 11, letterSpacing: '0.25em', fontWeight: 800, transform: 'rotate(-90deg)', whiteSpace: 'nowrap' }}>MEMORABILIUS</div>
      <PlasticSheen />
    </div>
  )

  // Rend un côté statique du feuillet : page plastique si la page existe, sinon
  // intérieur de couverture (page 0 à gauche, au-delà de page_count à droite).
  const renderStaticSide = (page: number, side: 'left' | 'right') => {
    if (page < 1 || page > selected.page_count) {
      return <div style={{ zIndex: 2 }}>{insideCoverFace(side)}</div>
    }
    return <div style={{ ...pageShellStyle(side), zIndex: 2 }}>{renderPocketGrid(page, side)}</div>
  }

  // Ouvre le classeur : la couverture fermée pivote comme un vrai plat de classeur,
  // puis on affiche les pages.
  const openTheBinder = () => {
    if (isOpen || coverAnimating) return
    setPageIndex(0)
    setCoverAnimating(true)
    requestAnimationFrame(() => requestAnimationFrame(() => setCoverAngle(-115)))
    setTimeout(() => { setIsOpen(true); setCoverAnimating(false); setCoverAngle(0) }, 520)
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => setSelected(null)} className="btn-main btn-secondary" style={{ padding: '8px 16px', fontSize: 13 }}>
          ← Retour {pendingCard ? 'aux classeurs' : 'à la bibliothèque'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontWeight: 900, fontSize: 15 }}>{selected.name}</span>
          {isOwner && !pendingCard && (
            <>
              <button onClick={() => setMultiPicker(true)} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>＋ Ajouter des cartes</button>
              <button onClick={() => openEditForm(selected)} style={{ background: 'none', border: 'none', color: accent, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>✏️ Modifier</button>
              <button onClick={() => deleteBinder(selected.id)} style={{ background: 'none', border: 'none', color: '#e74c3c', cursor: 'pointer', fontSize: 12 }}>🗑️</button>
            </>
          )}
        </div>
      </div>

      {pendingCard && (
        <div style={{ background: '#f0f4ff', border: `1px solid ${accent}44`, borderRadius: 10, padding: '10px 14px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={pendingCard.img} alt="" style={{ width: 28, height: 40, objectFit: 'cover', borderRadius: 3 }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Clique une pochette vide pour ranger « {pendingCard.nom} »</span>
        </div>
      )}

      <div ref={stageRef} style={{ background: 'linear-gradient(180deg, #e9e7e2, #dedbd3)', borderRadius: 16, padding: '34px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: coverH + 40, perspective: 1600 }}>
        {!isOpen ? (
          /* ── Classeur fermé : on voit la couverture (pivote à l'ouverture) ── */
          <div onClick={openTheBinder} title="Ouvrir le classeur" style={{
            width: coverW, height: coverH, cursor: 'pointer', position: 'relative', display: 'flex',
            borderRadius: '6px 10px 10px 6px', overflow: 'hidden',
            boxShadow: '0 14px 30px rgba(0,0,0,0.3)',
            transformOrigin: 'left center', transformStyle: 'preserve-3d',
            transform: coverAnimating ? `rotateY(${coverAngle}deg)` : 'none',
            opacity: coverAnimating ? 0.9 : 1,
            transition: 'transform 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s',
          }}>
            {/* tranche/reliure à gauche */}
            <div style={{ width: 20, flexShrink: 0, background: `linear-gradient(90deg, rgba(0,0,0,0.35), ${coverColor})`, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', alignItems: 'center' }}>
              {[0, 1, 2].map(i => <div key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.5)' }} />)}
            </div>
            {/* plat de couverture */}
            <div style={{ flex: 1, position: 'relative' }}>{coverFace}</div>
          </div>
        ) : (
          /* ── Classeur ouvert : deux feuilles plastique + rabats de couverture ── */
          <div ref={openSpreadRef}
            onPointerDown={spreadPointerDown} onPointerMove={spreadPointerMove} onPointerUp={endSwipe} onPointerCancel={endSwipe}
            style={{ display: 'flex', position: 'relative', perspective: 2200, touchAction: 'none', filter: 'drop-shadow(0 14px 26px rgba(0,0,0,0.22))' }}>
            {/* rabats de couverture (le classeur ouvert à plat) */}
            <div style={{ position: 'absolute', left: -wing, top: -6, bottom: -6, width: wing + 8, background: `linear-gradient(90deg, ${coverColor}, rgba(0,0,0,0.25))`, borderRadius: '8px 0 0 8px', zIndex: 1 }} />
            <div style={{ position: 'absolute', left: 2 * pageW - 8, top: -6, bottom: -6, width: wing + 8, background: `linear-gradient(90deg, rgba(0,0,0,0.25), ${coverColor})`, borderRadius: '0 8px 8px 0', zIndex: 1 }} />

            {renderStaticSide(flippingLeft ? pageIndex - 2 : pageIndex, 'left')}
            {renderStaticSide(flippingRight ? pageIndex + 3 : pageIndex + 1, 'right')}

            {/* creux central */}
            <div style={{ position: 'absolute', left: pageW - 3, top: 0, bottom: 0, width: 6, background: 'linear-gradient(90deg, rgba(0,0,0,0.14), transparent, rgba(0,0,0,0.14))', zIndex: 14, pointerEvents: 'none' }} />

            {/* Feuille qui tourne — deux faces, rotation continue 0 → ±180° */}
            {flip && (
              <div style={{
                position: 'absolute', top: 0,
                left: flip.dir === 'next' ? pageW : 0,
                width: pageW, height: pageH,
                transformStyle: 'preserve-3d',
                transformOrigin: flip.dir === 'next' ? 'left center' : 'right center',
                transform: `rotateY(${flip.angle}deg)`,
                transition: flip.anim ? `transform ${FLIP_MS}ms cubic-bezier(0.33,0,0.30,1)` : 'none',
                zIndex: 30,
              }}>
                <div style={{ ...pageShellStyle(flip.dir === 'next' ? 'right' : 'left'), position: 'absolute', inset: 0, width: '100%', height: '100%', backfaceVisibility: 'hidden' }}>
                  {renderPocketGrid(flip.dir === 'next' ? pageIndex + 1 : pageIndex, flip.dir === 'next' ? 'right' : 'left')}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(0,0,0,0.28)', opacity: shadowOpacity }} />
                </div>
                <div style={{ ...pageShellStyle(flip.dir === 'next' ? 'left' : 'right'), position: 'absolute', inset: 0, width: '100%', height: '100%', backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                  {renderPocketGrid(flip.dir === 'next' ? pageIndex + 2 : pageIndex - 1, flip.dir === 'next' ? 'left' : 'right')}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(0,0,0,0.28)', opacity: shadowOpacity }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        {!isOpen ? (
          <>
            <span />
            <button onClick={openTheBinder} className="btn-main btn-primary" style={{ padding: '8px 18px', fontSize: 13 }}>📖 Ouvrir le classeur</button>
            <span />
          </>
        ) : (
          <>
            <button
              onClick={() => canPrev ? clickFlip('prev') : setIsOpen(false)}
              disabled={!!flip} className="btn-main btn-secondary"
              style={{ padding: '8px 14px', fontSize: 13 }} aria-label={canPrev ? 'Page précédente' : 'Fermer'}>
              ←<span className="binder-nav-label"> {canPrev ? 'Page précédente' : 'Fermer'}</span>
            </button>
            <span style={{ fontSize: 12, color: '#999', whiteSpace: 'nowrap' }}>
              {(() => {
                const l = pageIndex, r = pageIndex + 1, cnt = selected.page_count
                const lOk = l >= 1 && l <= cnt, rOk = r >= 1 && r <= cnt
                const label = lOk && rOk ? `Pages ${l}–${r}` : rOk ? `Page ${r}` : lOk ? `Page ${l}` : 'Couverture'
                return `${label} / ${cnt}`
              })()}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              {isOwner && !canNext && (
                <button onClick={addPage} className="btn-main btn-secondary" style={{ padding: '8px 12px', fontSize: 12 }} aria-label="Ajouter une page">
                  +<span className="binder-nav-label"> Ajouter une page</span>
                </button>
              )}
              <button onClick={() => clickFlip('next')} disabled={!canNext || !!flip} className="btn-main btn-primary"
                style={{ padding: '8px 14px', fontSize: 13, opacity: !canNext ? 0.4 : 1 }} aria-label="Page suivante">
                <span className="binder-nav-label">Page suivante </span>→
              </button>
            </div>
          </>
        )}
      </div>

      {pickerTarget && (
        <CardPicker
          userId={userId}
          excludeKeys={new Set([...slots.values()].map(s => s.card_key))}
          onClose={() => setPickerTarget(null)}
          onSelect={card => placeCard(pickerTarget.page, pickerTarget.idx, card)}
        />
      )}

      {multiPicker && (
        <CardPicker
          userId={userId}
          multi
          excludeKeys={new Set([...slots.values()].map(s => s.card_key))}
          onClose={() => setMultiPicker(false)}
          onSelectMany={async cards => { await placeMany(cards); setMultiPicker(false) }}
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

      {/* Aperçu de la carte pendant le glisser-déplacer, collé au pointeur */}
      {cardDrag && createPortal(
        <div style={{
          position: 'fixed', left: cardDrag.x, top: cardDrag.y, width: 74, aspectRatio: '2.5/3.5',
          transform: 'translate(-50%, -50%) rotate(-4deg)', zIndex: 3000, pointerEvents: 'none',
          boxShadow: '0 12px 28px rgba(0,0,0,0.4)', overflow: 'hidden', borderRadius: 2,
        }}>
          <img src={cardDrag.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </div>,
        document.body
      )}

      {binderForm}
    </div>
  )
}
