'use client'
import { useEffect, useState, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import OnlineIndicator from '@/components/OnlineIndicator'
import GalerieExport from '@/components/GalerieExport'
import CollectionStats from '@/components/CollectionStats'
import PublicWishlist from '@/components/PublicWishlist'
import GalerieComments from '@/components/GalerieComments'
import {
  DndContext, closestCenter, PointerSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent
} from '@dnd-kit/core'
import { SortableContext, useSortable, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const Viewer3D = dynamic(() => import('@/components/Viewer3D'), { ssr: false })
import { useLang } from '@/lib/LangContext'
import { getSpeciality, getTeamById } from '@/lib/sportsTeams'
import { cardDisplayRatio, isHorizontalFormat, getFormat } from '@/lib/cardFormats'
import TeamBadge from '@/components/TeamBadge'

function SortableCard({ id, disabled, children, className, style, onClick }: {
  id: string; disabled: boolean; children: React.ReactNode
  className?: string; style?: React.CSSProperties; onClick?: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id, disabled })
  return (
    <div
      ref={setNodeRef}
      className={className}
      style={{ ...style, transform: CSS.Transform.toString(transform), transition, zIndex: isDragging ? 999 : undefined }}
      onClick={onClick}
      {...attributes}
    >
      {!disabled && (
        <div
          {...listeners}
          style={{
            position: 'absolute', bottom: 6, right: 6, zIndex: 10,
            width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.45)', borderRadius: 6, cursor: 'grab',
            touchAction: 'none', color: 'white', fontSize: 16, lineHeight: 1,
            userSelect: 'none',
          }}
        >
          ⠿
        </div>
      )}
      {children}
    </div>
  )
}

const PAGE_SIZE = 48

function renderCardImage(card: { f: string; n: string; format?: string; is_horizontal?: boolean }) {
  const fmt = getFormat(card.format)
  const horiz = isHorizontalFormat(card.format, card.is_horizontal)
  const ratio = cardDisplayRatio(card.format, card.is_horizontal)

  if (fmt.isSlab) {
    return (
      <div style={{ aspectRatio: ratio, overflow: 'hidden', position: 'relative', background: '#111', borderRadius: 2 }}>
        <img src={card.f} alt={card.n} loading="lazy"
          style={{ display: 'block', objectFit: 'cover', margin: '5px 5px 0', width: 'calc(100% - 10px)', height: 'calc(100% - 24px)' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 19,
          background: 'linear-gradient(135deg, #c8a84b 0%, #f5d67a 45%, #c8a84b 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 7, fontWeight: 900, letterSpacing: '0.12em', color: '#1a1a1a' }}>SLAB</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ aspectRatio: ratio, overflow: 'hidden', position: 'relative' }}>
      <img src={card.f} alt={card.n} loading="lazy"
        style={horiz
          ? { position: 'absolute', width: '140%', height: '71.43%', left: '-20%', top: '14.286%', transform: 'rotate(90deg)', objectFit: 'cover', display: 'block' }
          : { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
    </div>
  )
}

interface Card {
  id_manuelle?: string;
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string; card_number?: string
  auto: boolean; rc: boolean; patch: boolean; g: string
  booklet?: boolean; is_horizontal?: boolean; format?: string; il?: string; ir?: string
  isManuelle?: boolean
  created_at?: string; position?: number; collection_tag?: string;
}

export default function GalerieClient({ userId, initialCardUrl }: { userId: string; initialCardUrl?: string }) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [filtered, setFiltered] = useState<Card[]>([])
  const [displayed, setDisplayed] = useState<Card[]>([])
  const [page, setPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState({ rc: false, auto: false, num: false, patch: false })
  const [filterPrivate, setFilterPrivate] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'n' | 'n_desc' | 't' | 'y' | 'y_desc' | 's' | 'v' | 'g' | 'valeur' | 'valeur_desc' | 'num_asc' | 'date_desc' | 'date_asc'>(searchParams.get('sort') as any || 'default')
  const [search, setSearch] = useState(searchParams.get('q') || '')
  const [fTeam, setFTeam] = useState(searchParams.get('team') || '')
  const [fBrand, setFBrand] = useState(searchParams.get('brand') || '')
  const [fYear, setFYear] = useState(searchParams.get('year') || '')
  const [fCollectionTag, setFCollectionTag] = useState(searchParams.get('tag') || '')
  const [teams, setTeams] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [years, setYears] = useState<string[]>([])
  const [collectionTags, setCollectionTags] = useState<string[]>([])
  const [tabSettings, setTabSettings] = useState<Map<string, { color: string; position: number }>>(new Map())
  const [draggedTag, setDraggedTag] = useState<string | null>(null)
  const [colorPickerTag, setColorPickerTag] = useState<string | null>(null)
  const [cardLikes, setCardLikes] = useState<Map<string, { count: number; liked: boolean }>>(new Map())
  const [deleteTagConfirm, setDeleteTagConfirm] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const isGradient = (c: string) => c.startsWith('linear-gradient')
  // Retourne les styles de bordure corrects pour couleur unie ou dégradé
  const coloredBorder = (color: string, width = 2): React.CSSProperties => {
    if (!color) return { border: `${width}px solid ${accent}` }
    if (isGradient(color)) return {
      background: color,
      border: 'none',
    }
    return { border: `${width}px solid ${color}` }
  }
  const [popup, setPopup] = useState<Card | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [privateCards, setPrivateCards] = useState<Set<string>>(new Set())
  const [cardValues, setCardValues] = useState<Map<string, number>>(new Map())
  const [editMode, setEditMode] = useState(false)
  const [activeTab, setActiveTab] = useState<'collection' | 'wishlist' | 'comments'>('collection')
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set())
  const [shareCopied, setShareCopied] = useState(false)
  const [bulkNewTag, setBulkNewTag] = useState('')
  const [showBulkNewTag, setShowBulkNewTag] = useState(false)
  const [monthlyBadges, setMonthlyBadges] = useState<string[]>([])
  const [csvTags, setCsvTags] = useState<Map<string, string>>(new Map())
  const [grailCards, setGrailCards] = useState<{ card_key: string; position: number }[]>([])
  const [grailSearch, setGrailSearch] = useState('')
  const [grailPickerOpen, setGrailPickerOpen] = useState(false)
  const [addedCards, setAddedCards] = useState<Set<string>>(new Set())
  const [showBackToTop, setShowBackToTop] = useState(false)
  const [showStats, setShowStats] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  const isOwner = currentUser === userId
  const { t, lang } = useLang()
  const cardParam = searchParams.get('card')

  useEffect(() => {
    const init = async () => {
      try {
        supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user?.id || null))

        let resolvedId = userId
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        if (!uuidRegex.test(userId)) {
          const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
          if (p) resolvedId = p.id
          else { setLoaded(true); return }
        }

        // Tags CSV et profil sont indépendants → en parallèle (le profil a
        // juste besoin de tagsMap une fois résolu, pas besoin d'attendre en série)
        const [{ data: tagsData }, { data: profileData }] = await Promise.all([
          supabase.from('carte_tags').select('card_key, collection_tag').eq('user_id', resolvedId),
          supabase.from('profiles').select('*').eq('id', resolvedId).single(),
        ])
        const tagsMap = new Map((tagsData || []).map((r: any) => [r.card_key, r.collection_tag]))
        setCsvTags(tagsMap)

        if (profileData) { setProfile(profileData); loadCSV(profileData.lien_csv ?? null, tagsMap, profileData.gallery_order || []) }
        else setLoaded(true)
        supabase.from('badges').select('mois').eq('user_id', resolvedId).eq('type', 'collectionneur_du_mois').order('mois', { ascending: false }).limit(6).then(({ data }) => {
          if (data) setMonthlyBadges(data.map((b: any) => b.mois))
        })
        supabase.from('collection_tab_settings').select('tag, color, position').eq('user_id', resolvedId).then(({ data }) => {
          if (data) setTabSettings(new Map(data.map((r: any) => [r.tag, { color: r.color, position: r.position }])))
        })
        supabase.from('grail_cards').select('card_key, position').eq('user_id', resolvedId).order('position').then(({ data }) => {
          if (data) setGrailCards(data)
        })
        // Charger les likes de la galerie + ceux de l'utilisateur connecté
        supabase.auth.getUser().then(async ({ data: authData }) => {
          const uid = authData.user?.id || null
          const { data: likesData } = await supabase.from('card_likes').select('card_key, liker_user_id').eq('gallery_user_id', resolvedId)
          if (likesData) {
            const map = new Map<string, { count: number; liked: boolean }>()
            for (const l of likesData) {
              const prev = map.get(l.card_key) || { count: 0, liked: false }
              map.set(l.card_key, { count: prev.count + 1, liked: prev.liked || l.liker_user_id === uid })
            }
            setCardLikes(map)
          }
        })
      } catch (e) {
        console.error('Gallery init error', e)
        setLoaded(true)
      }
    }
    init()
  }, [userId])

  useEffect(() => {
    supabase.from('cartes_privees').select('card_key').eq('user_id', userId)
      .then(({ data }) => {
        if (data) setPrivateCards(new Set(data.map((d: any) => d.card_key)))
      })
    supabase.from('card_values').select('card_key,valeur').eq('user_id', userId)
      .then(({ data }) => {
        if (data) setCardValues(new Map(data.map((d: any) => [d.card_key, d.valeur])))
      })
  }, [userId])

  const updateCardValue = async (cardKey: string, val: number | null) => {
    if (!currentUser || currentUser !== userId) return
    if (val === null || isNaN(val)) {
      await supabase.from('card_values').delete().eq('user_id', userId).eq('card_key', cardKey)
      setCardValues(prev => { const m = new Map(prev); m.delete(cardKey); return m })
    } else {
      await supabase.from('card_values').upsert({ user_id: userId, card_key: cardKey, valeur: val }, { onConflict: 'user_id,card_key' })
      setCardValues(prev => new Map(prev).set(cardKey, val))
    }
  }

  const togglePrivate = async (cardKey: string) => {
    if (!currentUser || currentUser !== userId) return
    if (privateCards.has(cardKey)) {
      await supabase.from('cartes_privees').delete().eq('user_id', userId).eq('card_key', cardKey)
      setPrivateCards(prev => { const s = new Set(prev); s.delete(cardKey); return s })
    } else {
      await supabase.from('cartes_privees').insert({ user_id: userId, card_key: cardKey })
      setPrivateCards(prev => new Set([...prev, cardKey]))
    }
  }

  // Nouvelle fonction pour supprimer définitivement une carte ajoutée à la main
  const handleDeleteCard = async (idManuelle: string, cardKey: string) => {
    if (!currentUser || currentUser !== userId) return
    const confirmation = window.confirm(lang === 'fr' ? 'Supprimer définitivement cette carte de votre galerie ?' : 'Permanently delete this card from your gallery?')
    if (!confirmation) return

    try {
      // 1. Mise à jour classement mensuel + stats_total (avant suppression pour lire created_at)
      fetch('/api/card-added', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId, cardId: idManuelle }) }).catch(() => {})

      // 2. Suppression de la table des cartes manuelles
      const { error } = await supabase.from('cartes_manuelles').delete().eq('id', idManuelle).eq('user_id', userId)
      if (error) throw error

      // 3. Nettoyage de sa visibilité si elle était en mode privé
      await supabase.from('cartes_privees').delete().eq('user_id', userId).eq('card_key', cardKey)
      
      // 3. Mise à jour de l'état local pour faire disparaître l'élément instantanément
      setCards(prev => prev.filter(c => c.id_manuelle !== idManuelle))
      setPrivateCards(prev => { const s = new Set(prev); s.delete(cardKey); return s })
    } catch (e: any) {
      alert('Erreur lors de la suppression : ' + e.message)
    }
  }

  const loadCSV = async (url: string | null, tagsMap?: Map<string, string>, galleryOrder: string[] = []) => {
    try {
      let parsed: Card[] = []
      if (url) {
        const r = await fetch(url + '&t=' + Date.now())
        const t = await r.text()
        const rows = t.split(/\r?\n/).slice(4)
        parsed = rows.map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          if (!c[0] || !c[0].includes('http')) return null
          return {
            f: c[0]?.trim(), b: c[1]?.trim() || c[0]?.trim(),
            n: c[2] || '', t: c[3] || '', y: c[4] || '',
            br: c[5] || '', s: c[6] || '', v: c[7] || '',
            num: c[8] || '', auto: c[9]?.toLowerCase().includes('oui') || false,
            rc: c[10]?.toLowerCase().includes('oui') || false,
            patch: c[11]?.toLowerCase().includes('oui') || false,
            g: c[12] || 'Raw', card_number: c[13]?.trim() || '', isManuelle: false,
            collection_tag: (tagsMap || csvTags).get(c[0]?.trim()) || ''
          }
        }).filter(Boolean) as Card[]
      }

      const { data: manuelles } = await supabase.from('cartes_manuelles').select('*').eq('user_id', userId)
      const cartesM: Card[] = (manuelles || []).map((m: any) => ({
        id_manuelle: m.id,
        f: m.image_recto || 'https://placehold.co/300x420?text=No+Image',
        b: m.image_verso || m.image_recto || 'https://placehold.co/300x420?text=No+Image',
        n: m.nom || '', t: m.equipe || '', y: m.annee || '',
        br: m.marque || '', s: m.collection || '', v: m.variation || '',
        num: m.num || '', card_number: m.card_number || '', auto: m.auto || false, rc: m.rc || false,
        patch: m.patch || false, g: m.grade || 'Raw', isManuelle: true,
        booklet: m.booklet || false, is_horizontal: m.is_horizontal || false, format: m.format || (m.is_horizontal ? 'horizontal' : 'standard'),
        il: m.image_interieur_gauche || '', ir: m.image_interieur_droite || '',
        created_at: m.created_at || '', position: m.position ?? 9999,
        collection_tag: m.collection_tag || ''
      }))

      // Trier les cartes manuelles par position sauvegardée (fallback sans gallery_order)
      cartesM.sort((a, b) => (a.position ?? 9999) - (b.position ?? 9999))
      const allCards = [...parsed, ...cartesM]

      // Appliquer l'ordre personnalisé global si défini
      if (galleryOrder.length > 0) {
        const orderMap = new Map(galleryOrder.map((key, idx) => [key, idx]))
        allCards.sort((a, b) => {
          const pa = orderMap.get(a.id_manuelle || a.f) ?? 99999
          const pb = orderMap.get(b.id_manuelle || b.f) ?? 99999
          return pa - pb
        })
      }
      setCards(allCards)
      setTeams([...new Set(allCards.map(d => d.t).filter(Boolean))].sort())
      setBrands([...new Set(allCards.map(d => d.s).filter(Boolean))].sort())
      setYears([...new Set(allCards.map(d => d.y).filter(Boolean))].sort())
      setCollectionTags([...new Set(allCards.map(d => d.collection_tag).filter(Boolean) as string[])].sort())
      setLoaded(true)
      // Auto-ouvre la carte depuis ?card= ou depuis initialCardUrl (route /[cardSlug])
      const target = initialCardUrl || (cardParam ? decodeURIComponent(cardParam) : null)
      if (target) {
        const match = allCards.find(c => c.f === target)
        if (match) setPopup(match)
      }
    } catch (e) { console.error('CSV error', e); setLoaded(true) }
  }

  useEffect(() => {
    const f = cards.filter(d => {
      if (!isOwner && privateCards.has(d.f)) return false
      return (
        (d.n.toLowerCase().includes(search.toLowerCase()) || d.v.toLowerCase().includes(search.toLowerCase())) &&
        (!fTeam || d.t === fTeam) &&
        (!fBrand || d.s === fBrand) &&
        (!fYear || d.y === fYear) &&
        (!fCollectionTag || d.collection_tag === fCollectionTag) &&
        (!activeFilters.rc || d.rc) &&
        (!activeFilters.auto || d.auto) &&
        (!activeFilters.patch || d.patch) &&
        (!activeFilters.num || d.num !== '') &&
        (!filterPrivate || privateCards.has(d.f))
      )
    })

    const cmp = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: 'base' })
    const val = (d: Card) => cardValues.get(d.f) ?? -Infinity
    const sorted = [...f].sort((a, b) => {
      switch (sortBy) {
        case 'n':          return cmp(a.n, b.n)
        case 'n_desc':     return cmp(b.n, a.n)
        case 't':          return cmp(a.t, b.t)
        case 'y':          return cmp(a.y, b.y)
        case 'y_desc':     return cmp(b.y, a.y)
        case 's':          return cmp(a.s, b.s)
        case 'v':          return cmp(a.v, b.v)
        case 'g':          return cmp(a.g, b.g)
        case 'valeur':     return val(b) - val(a)
        case 'valeur_desc':return val(a) - val(b)
        case 'num_asc': {
          const na = numValue(a.num) ?? Infinity
          const nb = numValue(b.num) ?? Infinity
          return na - nb
        }
        case 'date_desc': return (b.created_at || '').localeCompare(a.created_at || '')
        case 'date_asc':  return (a.created_at || '').localeCompare(b.created_at || '')
        default:           return 0
      }
    })

    setFiltered(sorted)
    setPage(1)
    setDisplayed(sorted.slice(0, PAGE_SIZE))
  }, [cards, search, fTeam, fBrand, fYear, fCollectionTag, activeFilters, filterPrivate, privateCards, isOwner, sortBy, cardValues])

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && displayed.length < filtered.length) {
        setPage(p => p + 1)
      }
    }, { threshold: 0.1 })
    if (loaderRef.current) observer.observe(loaderRef.current)
    return () => observer.disconnect()
  }, [displayed, filtered])

  useEffect(() => {
    setDisplayed(filtered.slice(0, page * PAGE_SIZE))
  }, [page, filtered])

  useEffect(() => {
    if (!loaded) return
    const sp = new URLSearchParams()
    if (search) sp.set('q', search)
    if (fTeam) sp.set('team', fTeam)
    if (fBrand) sp.set('brand', fBrand)
    if (fYear) sp.set('year', fYear)
    if (fCollectionTag) sp.set('tag', fCollectionTag)
    if (sortBy !== 'default') sp.set('sort', sortBy)
    const str = sp.toString()
    router.replace(str ? `?${str}` : window.location.pathname, { scroll: false })
  }, [loaded, search, fTeam, fBrand, fYear, fCollectionTag, sortBy])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!popup) return
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return
      // Don't steal arrows from inputs
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return
      e.preventDefault()
      const idx = filtered.findIndex(c => c.f === popup.f)
      if (idx === -1) return
      const next = e.key === 'ArrowRight' ? idx + 1 : idx - 1
      if (next >= 0 && next < filtered.length) setPopup(filtered[next])
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [popup, filtered])

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 500)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const toggleFilter = (k: keyof typeof activeFilters) => setActiveFilters(p => ({ ...p, [k]: !p[k] }))

  const getCardId = (c: Card) => c.id_manuelle || c.f

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  )

  const saveGalleryOrder = async (cardList: Card[]) => {
    if (!isOwner) return
    const order = cardList.map(getCardId)
    await supabase.from('profiles').update({ gallery_order: order }).eq('id', userId)
  }

  const toggleCardSelection = (cardId: string) => {
    setSelectedCards(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) next.delete(cardId); else next.add(cardId)
      return next
    })
  }

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    const movedId = active.id as string
    const targetId = over.id as string
    const isMulti = selectedCards.has(movedId) && selectedCards.size > 1

    if (isMulti) {
      // Retire toutes les cartes sélectionnées puis les réinsère après la cible
      const sel = new Set(selectedCards)
      const selList = cards.filter(c => sel.has(getCardId(c)))
      const rest = cards.filter(c => !sel.has(getCardId(c)))
      const insertAfter = rest.findIndex(c => getCardId(c) === targetId)
      const pos = insertAfter === -1 ? rest.length : insertAfter + 1
      const newCards = [...rest.slice(0, pos), ...selList, ...rest.slice(pos)]
      setCards(newCards)
      saveGalleryOrder(newCards)
      setSelectedCards(new Set())
    } else {
      const movedIdx = cards.findIndex(c => getCardId(c) === movedId)
      const targetIdx = cards.findIndex(c => getCardId(c) === targetId)
      if (movedIdx === -1 || targetIdx === -1) return
      const newCards = arrayMove(cards, movedIdx, targetIdx)
      setCards(newCards)
      saveGalleryOrder(newCards)
    }
  }

  const gridRef = useRef<HTMLDivElement>(null)

  const numValue = (num: string) => { const m = num.trim().match(/\/(\d+)$/); return m ? parseInt(m[1]) : null }
  const isOneOfOne = (num: string) => { const v = numValue(num); return v === 1 }
  const isLowNum = (num: string) => { const v = numValue(num); return v !== null && v >= 2 && v <= 10 }
  const isBronzeNum = (num: string) => { const v = numValue(num); return v !== null && v >= 11 && v <= 25 }

  const getTags = (d: Card) => {
    const oon = d.num && isOneOfOne(d.num)
    const low = d.num && !oon && isLowNum(d.num)
    const bronze = d.num && !oon && !low && isBronzeNum(d.num)
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 18 }}>
        {d.rc && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#e67e22', color: 'white' }}>RC</span>}
        {d.auto && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#2e7d32', color: 'white' }}>AUTO</span>}
        {d.num && !oon && !low && !bronze && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>{d.num}</span>}
        {bronze && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#6d3a00,#cd7f32,#f5cba7,#cd7f32,#6d3a00)', color: 'white', textShadow: '0 1px 2px rgba(0,0,0,0.6)', display: 'inline-block', animation: 'bro-anim 2.6s ease-in-out infinite', willChange: 'transform' }}>{d.num}</span>}
        {oon && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b)', color: '#3d2800', textShadow: '0 1px 0 rgba(255,255,255,0.4)', display: 'inline-block', animation: 'oon-anim 1.8s ease-in-out infinite', willChange: 'transform' }}>{d.num}</span>}
        {low && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(135deg,#555,#c0c0c0,#fff,#c0c0c0,#555)', color: '#111', display: 'inline-block', animation: 'low-anim 2.2s ease-in-out infinite', willChange: 'transform' }}>{d.num}</span>}
        {d.patch && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: 'white' }}>PATCH</span>}
      </div>
    )
  }

  const accent = profile?.couleur_bordure || '#003DA6'

  return (
    <>
      <div style={{ maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, sans-serif', padding: '0 10px' }}>

        {/* Header profil */}
        <div style={{ background: 'white', borderRadius: 16, padding: '24px 30px', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap', flex: '1 1 300px' }}>
            <img
              src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
              style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, flexShrink: 0 }}
              alt={profile?.display_name}
            />
            <div style={{ minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
                <h1 className={profile?.is_donor ? 'holo-name' : ''} style={{ fontSize: 24, fontWeight: 900, margin: 0, color: profile?.is_donor ? undefined : undefined }}>{profile?.display_name || 'Collectionneur'}</h1>
                <OnlineIndicator lastSeen={profile?.last_seen} size={12} />
                {monthlyBadges.length > 0 && (
                  <span className="sticker-badge" data-label={`Collectionneur du mois : ${monthlyBadges.join(', ')}`} style={{ fontSize: 26 }}>🏆</span>
                )}
                {profile?.is_donor && (
                  <span className="sticker-holo" data-label="Donateur Ko-fi" style={{ fontSize: 26 }}>☕</span>
                )}

                {(() => {
                  const teams: string[] = Array.isArray(profile?.favorite_teams) ? profile.favorite_teams : []
                  const stats = profile ? { total: profile.stats_total || 0, rc: profile.stats_rc || 0, auto: profile.stats_auto || 0, patch: profile.stats_patch || 0, num: profile.stats_num || 0 } : undefined
                  const spec = getSpeciality(stats)
                  return (<>
                    {teams.map(id => {
                      const team = getTeamById(id)
                      return (
                        <span key={id} className="sticker-team" data-label={team?.name ?? id}>
                          <TeamBadge teamId={id} size={28} />
                        </span>
                      )
                    })}
                    {spec.map((s, i) => (
                      <span key={i} className="sticker-badge" data-label={s.label.replace(/^\S+\s*/, '')} style={{ fontSize: 26 }}>
                        {s.label.match(/^\S+/)?.[0] ?? '⭐'}
                      </span>
                    ))}
                  </>)
                })()}
              </div>

              {profile?.bio && (
                <p style={{ fontSize: 13, color: '#555', margin: '0 0 10px', lineHeight: 1.5, maxWidth: 400 }}>{profile.bio}</p>
              )}

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {profile?.instagram && (
                  <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#E1306C', textDecoration: 'none', background: '#fce4ec', padding: '4px 10px', borderRadius: 20 }}>
                    <span>📸</span> {profile.instagram.startsWith('@') ? profile.instagram : `@${profile.instagram}`}
                  </a>
                )}
                {profile?.twitter && (
                  <a href={`https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#121212', textDecoration: 'none', background: '#f0f0f0', padding: '4px 10px', borderRadius: 20 }}>
                    <span>𝕏</span> {profile.twitter.startsWith('@') ? profile.twitter : `@${profile.twitter}`}
                  </a>
                )}
                {profile?.discord && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700, color: '#5865F2', background: '#eef0ff', padding: '4px 10px', borderRadius: 20 }}>
                    <span>🎮</span> {profile.discord}
                  </span>
                )}
                {currentUser && currentUser !== userId && (
                  <a href={`/messages?to=${userId}`} style={{
                    display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 700,
                    color: 'white', background: accent, padding: '5px 12px', borderRadius: 20, textDecoration: 'none'
                  }}>
                    {t('gallery_message')}
                  </a>
                )}
              </div>
            </div>
          </div>

          {loaded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-end', flexShrink: 0, minWidth: 260, marginLeft: 'auto' }} className="header-stats-block">
              <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end', width: '100%' }}>
                {[
                  { val: filtered.length, label: t('gallery_cards') },
                  { val: filtered.filter(c => c.rc).length, label: 'RC', color: '#e67e22' },
                  { val: filtered.filter(c => c.auto).length, label: 'Auto', color: '#2e7d32' },
                  { val: filtered.filter(c => c.num).length, label: 'Num', color: '#7b1fa2' },
                  { val: filtered.filter(c => c.patch).length, label: 'Patch', color: '#1976d2' },
                ].map(s => (
                  <div key={s.label} style={{ textAlign: 'center', minWidth: 45 }}>
                    <div style={{ fontSize: 22, fontWeight: 900, color: s.color || accent }}>{s.val}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, width: '100%', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                {isOwner && (
                  <button onClick={() => { setEditMode(m => !m); setSelectedCards(new Set()) }} style={{
                    background: editMode ? '#e74c3c' : '#f0f0f0',
                    color: editMode ? 'white' : '#333',
                    border: 'none', borderRadius: 8, padding: '10px 16px',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: '1 1 auto', textAlign: 'center', minWidth: 150
                  }}>
                    {editMode ? t('gallery_done') : t('gallery_privacy')}
                  </button>
                )}

                {/* Bouton partager la galerie */}
                {!editMode && (
                  <button onClick={() => {
                    const url = window.location.href
                    if (navigator.share) {
                      navigator.share({ title: `Galerie de ${profile?.display_name || 'Collectionneur'}`, url })
                    } else {
                      navigator.clipboard.writeText(url).then(() => {
                        setShareCopied(true)
                        setTimeout(() => setShareCopied(false), 2000)
                      })
                    }
                  }} style={{
                    background: shareCopied ? '#22c55e' : '#f0f0f0',
                    color: shareCopied ? 'white' : '#333',
                    border: 'none', borderRadius: 8, padding: '10px 16px',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: '1 1 auto', textAlign: 'center',
                    transition: '0.2s',
                  }}>
                    {shareCopied ? '✓ Copié !' : '↗ Partager'}
                  </button>
                )}

                {!editMode && (
                  <GalerieExport
                    cards={cards}
                    profileName={profile?.display_name || ''}
                    avatarUrl={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
                    accent={accent}
                    lang={lang}
                    cardValues={cardValues}
                    isOwner={isOwner}
                  />
                )}

                {!editMode && loaded && (
                  <button onClick={() => setShowStats(s => !s)} style={{
                    background: showStats ? accent : '#f0f0f0',
                    color: showStats ? 'white' : '#333',
                    border: 'none', borderRadius: 8, padding: '10px 16px',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: '1 1 auto', textAlign: 'center', minWidth: 100,
                    transition: '0.2s',
                  }}>
                    📊 Stats
                  </button>
                )}
                {isOwner && !editMode && (
                  <a href={`/galerie/${userId}/ajouter`} style={{
                    background: '#003DA6', color: 'white',
                    border: 'none', borderRadius: 8, padding: '10px 16px',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    textDecoration: 'none', display: 'inline-block', flex: '1 1 auto', textAlign: 'center', minWidth: 100
                  }}>
                    ➕ {lang === 'fr' ? 'Ajouter' : 'Add'}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Stats de collection */}
        {showStats && loaded && (
          <CollectionStats cards={cards} accent={accent} />
        )}

        {/* Grail Wall */}
        {(isOwner || grailCards.length > 0) && (() => {
          const grailMap = new Map(cards.map(c => [c.f, c]))
          const grailItems = grailCards.map(g => grailMap.get(g.card_key)).filter(Boolean) as Card[]
          const emptySlots = 5 - grailItems.length
          const grailSearchResults = grailSearch.trim().length > 0
            ? cards.filter(c =>
                !grailCards.some(g => g.card_key === c.f) &&
                (c.n.toLowerCase().includes(grailSearch.toLowerCase()) || c.v.toLowerCase().includes(grailSearch.toLowerCase()) || c.s.toLowerCase().includes(grailSearch.toLowerCase()))
              ).slice(0, 20)
            : []

          return (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ fontSize: 18 }}>💎</span>
                <span style={{ fontWeight: 900, fontSize: 15, color: '#121212', letterSpacing: 0.5 }}>Grail Wall</span>
                <span style={{ fontSize: 11, color: '#bbb', fontWeight: 600 }}>— {lang === 'fr' ? 'Les pièces maîtresses' : 'The crown jewels'}</span>
              </div>

              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
                {grailItems.map((card, i) => {
                  const tabColor = (card.collection_tag && tabSettings.get(card.collection_tag)?.color) || accent
                  const resolvedColor = isGradient(tabColor) ? (tabColor.match(/#[0-9a-fA-F]{6}/)?.[0] || accent) : tabColor
                  return (
                    <div key={i} onClick={() => setPopup(card)} style={{
                      flexShrink: 0, width: 120, cursor: 'pointer', position: 'relative',
                      background: tabColor, padding: 3, borderRadius: 10,
                      boxShadow: `0 4px 16px ${resolvedColor}44`, transition: 'transform 0.2s',
                    }}
                      onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-4px)')}
                      onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}
                    >
                      <div style={{ borderRadius: 8, overflow: 'hidden', background: 'white', position: 'relative' }}>
                      {isOwner && (
                        <button onClick={async e => {
                          e.stopPropagation()
                          await supabase.from('grail_cards').delete().eq('user_id', userId).eq('card_key', card.f)
                          setGrailCards(prev => prev.filter(g => g.card_key !== card.f))
                        }} style={{
                          position: 'absolute', top: 4, right: 4, zIndex: 3,
                          background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%',
                          width: 20, height: 20, color: 'white', fontSize: 10, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900,
                        }}>✕</button>
                      )}
                      {renderCardImage(card)}
                      <div style={{ padding: '6px 8px' }}>
                        <p style={{ fontWeight: 800, fontSize: 10, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.n}</p>
                        <p style={{ fontSize: 9, color: resolvedColor, fontWeight: 700, margin: '1px 0 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.v || card.s}</p>
                      </div>
                      </div>
                    </div>
                  )
                })}

                {/* Slots vides */}
                {isOwner && Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`}
                    onClick={() => { setGrailPickerOpen(true); setGrailSearch('') }}
                    style={{
                      flexShrink: 0, width: 120, border: `2px dashed ${accent}44`, borderRadius: 10,
                      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                      gap: 6, cursor: 'pointer', transition: '0.15s',
                      aspectRatio: '2.5/3.5',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = accent; (e.currentTarget as HTMLDivElement).style.background = accent + '08' }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = accent + '44'; (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 28, opacity: 0.3 }}>+</span>
                    <span style={{ fontSize: 10, color: '#bbb', fontWeight: 700, textAlign: 'center', lineHeight: 1.3, padding: '0 8px' }}>
                      {lang === 'fr' ? 'Ajouter une carte' : 'Add a card'}
                    </span>
                  </div>
                ))}

                {!isOwner && Array.from({ length: emptySlots }).map((_, i) => (
                  <div key={`empty-${i}`} style={{
                    flexShrink: 0, width: 120, border: `2px dashed #eee`, borderRadius: 10,
                    aspectRatio: '2.5/3.5',
                  }} />
                ))}
              </div>

              {/* Modal de recherche pour ajouter au grail */}
              {grailPickerOpen && (
                <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
                  onClick={() => setGrailPickerOpen(false)}>
                  <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>💎 {lang === 'fr' ? 'Choisir une carte' : 'Choose a card'}</h3>
                      <button onClick={() => setGrailPickerOpen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
                    </div>
                    <input
                      autoFocus
                      value={grailSearch}
                      onChange={e => setGrailSearch(e.target.value)}
                      placeholder={lang === 'fr' ? 'Rechercher dans ma collection…' : 'Search my collection…'}
                      style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, outline: 'none' }}
                    />
                    <div style={{ overflowY: 'auto', flex: 1 }}>
                      {grailSearch.trim().length === 0 ? (
                        <p style={{ color: '#bbb', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                          {lang === 'fr' ? 'Tapez le nom d\'un joueur, set ou variation…' : 'Type a player name, set or variation…'}
                        </p>
                      ) : grailSearchResults.length === 0 ? (
                        <p style={{ color: '#bbb', textAlign: 'center', marginTop: 24, fontSize: 13 }}>
                          {lang === 'fr' ? 'Aucun résultat' : 'No results'}
                        </p>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                          {grailSearchResults.map((card, i) => {
                            const tabColor = (card.collection_tag && tabSettings.get(card.collection_tag)?.color) || accent
                            return (
                              <div key={i} onClick={async () => {
                                const pos = grailCards.length
                                await supabase.from('grail_cards').upsert({ user_id: userId, card_key: card.f, position: pos }, { onConflict: 'user_id,card_key' })
                                setGrailCards(prev => [...prev, { card_key: card.f, position: pos }])
                                if (grailCards.length + 1 >= 5) setGrailPickerOpen(false)
                                setGrailSearch('')
                              }} style={{ cursor: 'pointer', ...coloredBorder(tabColor), borderRadius: 8, overflow: 'hidden', transition: '0.15s' }}
                                onMouseEnter={e => { if (!isGradient(tabColor)) e.currentTarget.style.borderColor = tabColor }}
                                onMouseLeave={e => { if (!isGradient(tabColor)) e.currentTarget.style.borderColor = tabColor + '55' }}
                              >
                                {renderCardImage(card)}
                                <div style={{ padding: '4px 6px', background: 'white' }}>
                                  <p style={{ fontWeight: 800, fontSize: 10, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.n}</p>
                                  <p style={{ fontSize: 9, color: '#999', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.s}</p>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })()}

        {/* Onglets Collection / Wishlist / Commentaires */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: '#f0f0f0', borderRadius: 10, padding: 4, width: 'fit-content' }}>
          {(['collection', 'wishlist', 'comments'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: '8px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontWeight: 800, fontSize: 13,
              background: activeTab === tab ? 'white' : 'transparent',
              color: activeTab === tab ? accent : '#999',
              boxShadow: activeTab === tab ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
              transition: '0.15s',
            }}>
              {tab === 'collection' ? '🃏 Collection' : tab === 'wishlist' ? '🎯 Wishlist' : '💬 Commentaires'}
            </button>
          ))}
        </div>

        {activeTab === 'wishlist' && <PublicWishlist userId={userId} accent={accent} isOwner={isOwner} />}
        {activeTab === 'comments' && <GalerieComments galerieUserId={userId} accent={accent} isOwner={isOwner} />}

        {activeTab === 'collection' && <>
        {/* Filtres de recherche */}
        <div style={{ background: '#fff', padding: 10, borderRadius: 8, marginBottom: 15, border: '1px solid #eee' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>{t('gallery_search_label')}</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('gallery_search')} /></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>{t('gallery_team_label')}</label>
              <select value={fTeam} onChange={e => setFTeam(e.target.value)}>
                <option value="">{t('gallery_all')}</option>{teams.map(team => <option key={team}>{team}</option>)}
              </select></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>{t('gallery_collection_label')}</label>
              <select value={fBrand} onChange={e => setFBrand(e.target.value)}>
                <option value="">{t('gallery_all')}</option>{brands.map(brand => <option key={brand}>{brand}</option>)}
              </select></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>{t('gallery_year_label')}</label>
              <select value={fYear} onChange={e => setFYear(e.target.value)}>
                <option value="">{t('gallery_all')}</option>{years.map(year => <option key={year}>{year}</option>)}
              </select></div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isOwner ? 'repeat(5,1fr)' : 'repeat(4,1fr)', gap: 5, marginBottom: 8 }}>
            {(['rc', 'auto', 'num', 'patch'] as const).map(k => (
              <button key={k} onClick={() => toggleFilter(k)} style={{
                padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                background: activeFilters[k] ? accent : '#f0f0f0', color: activeFilters[k] ? 'white' : '#333'
              }}>{k === 'num' ? '# NUM' : k.toUpperCase()}</button>
            ))}
            {isOwner && (
              <button onClick={() => setFilterPrivate(p => !p)} style={{
                padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                background: filterPrivate ? '#555' : '#f0f0f0', color: filterPrivate ? 'white' : '#333'
              }}>🔒 Privé</button>
            )}
          </div>
          <div>
            <label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>
              {lang === 'fr' ? 'Trier par' : 'Sort by'}
            </label>
            <select value={sortBy} onChange={e => setSortBy(e.target.value as typeof sortBy)}
              style={{ background: sortBy !== 'default' ? '#f0f4ff' : undefined, borderColor: sortBy !== 'default' ? '#003DA6' : undefined, color: sortBy !== 'default' ? '#003DA6' : undefined, fontWeight: sortBy !== 'default' ? 700 : undefined }}>
              <option value="default">{lang === 'fr' ? '— Ordre par défaut —' : '— Default order —'}</option>
              <optgroup label={lang === 'fr' ? 'Joueur' : 'Player'}>
                <option value="n">{lang === 'fr' ? 'Joueur A → Z' : 'Player A → Z'}</option>
                <option value="n_desc">{lang === 'fr' ? 'Joueur Z → A' : 'Player Z → A'}</option>
              </optgroup>
              <optgroup label={lang === 'fr' ? 'Année' : 'Year'}>
                <option value="y">{lang === 'fr' ? 'Année croissante' : 'Year asc'}</option>
                <option value="y_desc">{lang === 'fr' ? 'Année décroissante' : 'Year desc'}</option>
              </optgroup>
              <optgroup label={lang === 'fr' ? 'Équipe' : 'Team'}>
                <option value="t">{lang === 'fr' ? 'Équipe A → Z' : 'Team A → Z'}</option>
              </optgroup>
              <optgroup label={lang === 'fr' ? 'Collection' : 'Brand'}>
                <option value="s">{lang === 'fr' ? 'Collection A → Z' : 'Brand A → Z'}</option>
              </optgroup>
              <optgroup label={lang === 'fr' ? 'Numérotation' : 'Numbering'}>
                <option value="num_asc">{lang === 'fr' ? 'Numérotation basse → haute' : 'Numbering low → high'}</option>
              </optgroup>
              <optgroup label={lang === 'fr' ? 'Date d\'ajout' : 'Date added'}>
                <option value="date_desc">{lang === 'fr' ? 'Plus récent en 1er' : 'Newest first'}</option>
                <option value="date_asc">{lang === 'fr' ? 'Plus ancien en 1er' : 'Oldest first'}</option>
              </optgroup>
              {cardValues.size > 0 && <>
                <option value="valeur">{lang === 'fr' ? 'Valeur ↓ (plus cher en 1er)' : 'Value ↓ (highest first)'}</option>
                <option value="valeur_desc">{lang === 'fr' ? 'Valeur ↑ (moins cher en 1er)' : 'Value ↑ (lowest first)'}</option>
              </>}
            </select>
          </div>
          {collectionTags.length > 0 && (() => {
            const TAB_COLORS = [
              // Rouges
              '#E53935','#C62828','#AD1457','#880E4F',
              // Oranges
              '#F4511E','#E65100','#FF8F00','#F9A825',
              // Jaunes / Ors
              '#FDD835','#C8A23A','#A57C00','#FFD700',
              // Verts
              '#43A047','#2E7D32','#00796B','#006064',
              // Bleus clairs
              '#039BE5','#0288D1','#0277BD','#01579B',
              // Bleus foncés / Marines
              '#1565C0','#283593','#1A237E','#003DA6',
              // Violets
              '#7B1FA2','#6A1B9A','#4A148C','#512DA8',
              // Roses
              '#E91E63','#D81B60','#F06292','#F48FB1',
              // Neutres
              '#37474F','#455A64','#546E7A','#000000',
            ]
            const TAB_GRADIENTS = [
              { label: 'Sunset', value: 'linear-gradient(135deg,#f97316,#ec4899)' },
              { label: 'Ocean', value: 'linear-gradient(135deg,#0ea5e9,#6366f1)' },
              { label: 'Forest', value: 'linear-gradient(135deg,#16a34a,#0d9488)' },
              { label: 'Galaxy', value: 'linear-gradient(135deg,#7c3aed,#db2777)' },
              { label: 'Gold', value: 'linear-gradient(135deg,#f59e0b,#b45309)' },
              { label: 'Ice', value: 'linear-gradient(135deg,#38bdf8,#818cf8)' },
              { label: 'Lava', value: 'linear-gradient(135deg,#dc2626,#f97316)' },
              { label: 'Midnight', value: 'linear-gradient(135deg,#1e3a5f,#7c3aed)' },
              { label: 'Rose', value: 'linear-gradient(135deg,#f43f5e,#fb923c)' },
              { label: 'Matrix', value: 'linear-gradient(135deg,#14532d,#22c55e)' },
            ]
            const resolveColor = (c: string) => isGradient(c) ? c.match(/#[0-9a-fA-F]{6}/)?.[0] || accent : c
            const orderedTags = [...collectionTags].sort((a, b) => {
              const pa = tabSettings.get(a)?.position ?? 999
              const pb = tabSettings.get(b)?.position ?? 999
              return pa !== pb ? pa - pb : a.localeCompare(b)
            })
            const saveTabSetting = async (tag: string, patch: { color?: string; position?: number }) => {
              const cur = tabSettings.get(tag) || { color: accent, position: 0 }
              const next = { ...cur, ...patch }
              setTabSettings(prev => new Map(prev).set(tag, next))
              await supabase.from('collection_tab_settings').upsert({ user_id: userId, tag, ...next }, { onConflict: 'user_id,tag' })
            }
            const handleDragOver = (e: React.DragEvent, overTag: string) => {
              e.preventDefault()
              if (!draggedTag || draggedTag === overTag) return
              const fromPos = tabSettings.get(draggedTag)?.position ?? orderedTags.indexOf(draggedTag)
              const toPos = tabSettings.get(overTag)?.position ?? orderedTags.indexOf(overTag)
              // Swap positions
              const newMap = new Map(tabSettings)
              newMap.set(draggedTag, { ...(newMap.get(draggedTag) || { color: accent }), position: toPos })
              newMap.set(overTag, { ...(newMap.get(overTag) || { color: accent }), position: fromPos })
              setTabSettings(newMap)
            }
            const handleDragEnd = async () => {
              if (!draggedTag) return
              // Persist all positions
              const allUpdates = orderedTags.map((tag, i) => ({
                user_id: userId, tag,
                color: tabSettings.get(tag)?.color || accent,
                position: tabSettings.get(tag)?.position ?? i,
              }))
              await supabase.from('collection_tab_settings').upsert(allUpdates, { onConflict: 'user_id,tag' })
              setDraggedTag(null)
            }
            return (
              <div style={{ marginTop: 8 }} onClick={() => colorPickerTag && setColorPickerTag(null)}>
                <label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 5 }}>
                  {lang === 'fr' ? 'Ma collection' : 'My collection'}
                  {isOwner && <span style={{ fontSize: 8, color: '#bbb', marginLeft: 6, fontWeight: 600 }}>
                    {lang === 'fr' ? '· glisser pour réordonner' : '· drag to reorder'}
                  </span>}
                </label>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <button onClick={() => setFCollectionTag('')} style={{
                    padding: '5px 12px', border: 'none', borderRadius: 20, cursor: 'pointer',
                    fontSize: 11, fontWeight: 700,
                    background: !fCollectionTag ? accent : '#f0f0f0',
                    color: !fCollectionTag ? 'white' : '#555',
                  }}>
                    {lang === 'fr' ? 'Tout' : 'All'}
                  </button>
                  {orderedTags.map(tag => {
                    const settings = tabSettings.get(tag)
                    const tabColor = settings?.color || accent
                    const isActive = fCollectionTag === tag
                    const isDragging = draggedTag === tag
                    return (
                      <div key={tag} style={{ position: 'relative', display: 'inline-flex' }}>
                        <button
                          onClick={(e) => { e.stopPropagation(); setFCollectionTag(isActive ? '' : tag); setColorPickerTag(null) }}
                          draggable={isOwner}
                          onDragStart={() => setDraggedTag(tag)}
                          onDragOver={(e) => handleDragOver(e, tag)}
                          onDragEnd={handleDragEnd}
                          style={{
                            padding: '5px 10px', borderRadius: 20, cursor: isOwner ? 'grab' : 'pointer',
                            fontSize: 11, fontWeight: 700, transition: '0.15s',
                            opacity: isDragging ? 0.4 : 1,
                            background: isActive ? tabColor : '#f0f0f0',
                            color: isActive ? 'white' : '#555',
                            border: `2px solid ${isActive ? tabColor : tabColor + '55'}`,
                          }}
                        >
                          {!isActive && <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: tabColor, marginRight: 5, verticalAlign: 'middle', flexShrink: 0 }} />}
                          {tag}
                        </button>
                        {isOwner && (
                          <button
                            onClick={(e) => { e.stopPropagation(); setColorPickerTag(colorPickerTag === tag ? null : tag); setRenameValue(tag); setDeleteTagConfirm(null) }}
                            title="Couleur"
                            style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: '50%', background: tabColor, border: '2px solid white', cursor: 'pointer', padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.3)', zIndex: 1 }}
                          />
                        )}
                        {colorPickerTag === tag && (
                          <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', top: '110%', left: 0, background: 'white', borderRadius: 12, padding: 10, boxShadow: '0 8px 30px rgba(0,0,0,0.18)', zIndex: 100, width: 220 }}>
                            {/* Nom éditable */}
                            <input
                              value={renameValue}
                              onChange={e => setRenameValue(e.target.value)}
                              onKeyDown={async e => {
                                if (e.key === 'Escape') { setColorPickerTag(null); return }
                                if (e.key !== 'Enter') return
                                const newName = renameValue.trim()
                                if (!newName || newName === tag) { setColorPickerTag(null); return }
                                await Promise.all([
                                  supabase.from('cartes_manuelles').update({ collection_tag: newName }).eq('user_id', userId).eq('collection_tag', tag),
                                  supabase.from('carte_tags').update({ collection_tag: newName }).eq('user_id', userId).eq('collection_tag', tag),
                                ])
                                const cur = tabSettings.get(tag)
                                await supabase.from('collection_tab_settings').delete().eq('user_id', userId).eq('tag', tag)
                                if (cur) await supabase.from('collection_tab_settings').upsert({ user_id: userId, tag: newName, ...cur }, { onConflict: 'user_id,tag' })
                                setTabSettings(prev => { const m = new Map(prev); if (cur) m.set(newName, cur); m.delete(tag); return m })
                                setCollectionTags(prev => prev.map(t => t === tag ? newName : t).sort())
                                setCards(prev => prev.map(c => c.collection_tag === tag ? { ...c, collection_tag: newName } : c))
                                if (fCollectionTag === tag) setFCollectionTag(newName)
                                setColorPickerTag(null)
                              }}
                              style={{ width: '100%', marginBottom: 8, padding: '5px 10px', borderRadius: 8, border: `2.5px solid ${isGradient(tabColor) ? 'transparent' : tabColor}`, fontSize: 11, fontWeight: 700, color: '#333', textAlign: 'center', outline: 'none', boxSizing: 'border-box', fontFamily: 'Inter, sans-serif', background: 'white' }}
                            />
                            {/* Couleurs unies */}
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                              {TAB_COLORS.map(c => (
                                <button key={c} onClick={() => { saveTabSetting(tag, { color: c }); setColorPickerTag(null) }}
                                  style={{ width: 20, height: 20, borderRadius: '50%', background: c, border: tabColor === c ? '2.5px solid #111' : '2px solid transparent', cursor: 'pointer', padding: 0, boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
                              ))}
                            </div>
                            {/* Dégradés */}
                            <div style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#aaa', marginBottom: 5 }}>Dégradés</div>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                              {TAB_GRADIENTS.map(g => (
                                <button key={g.value} onClick={() => { saveTabSetting(tag, { color: g.value }); setColorPickerTag(null) }}
                                  title={g.label}
                                  style={{ width: 36, height: 20, borderRadius: 4, background: g.value, border: tabColor === g.value ? '2.5px solid #111' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
                              ))}
                            </div>
                            {/* Supprimer la collection */}
                            {deleteTagConfirm === tag ? (
                              <div style={{ borderTop: '1px solid #f0f0f0', paddingTop: 8 }}>
                                <p style={{ fontSize: 10, color: '#e53935', fontWeight: 700, margin: '0 0 6px' }}>Supprimer "{tag}" ? Les cartes ne seront pas supprimées.</p>
                                <div style={{ display: 'flex', gap: 6 }}>
                                  <button onClick={async () => {
                                    await supabase.from('cartes_manuelles').update({ collection_tag: null }).eq('user_id', userId).eq('collection_tag', tag)
                                    await supabase.from('carte_tags').update({ collection_tag: null }).eq('user_id', userId).eq('collection_tag', tag)
                                    await supabase.from('collection_tab_settings').delete().eq('user_id', userId).eq('tag', tag)
                                    setTabSettings(prev => { const m = new Map(prev); m.delete(tag); return m })
                                    setCollectionTags(prev => prev.filter(t => t !== tag))
                                    setCards(prev => prev.map(c => c.collection_tag === tag ? { ...c, collection_tag: '' } : c))
                                    setColorPickerTag(null); setDeleteTagConfirm(null)
                                  }} style={{ flex: 1, background: '#e53935', color: 'white', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 10, fontWeight: 800, cursor: 'pointer' }}>
                                    Confirmer
                                  </button>
                                  <button onClick={() => setDeleteTagConfirm(null)} style={{ flex: 1, background: '#f0f0f0', color: '#555', border: 'none', borderRadius: 6, padding: '5px 0', fontSize: 10, fontWeight: 700, cursor: 'pointer' }}>
                                    Annuler
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <button onClick={() => setDeleteTagConfirm(tag)} style={{ width: '100%', border: 'none', background: 'none', color: '#e53935', fontSize: 10, fontWeight: 700, cursor: 'pointer', paddingTop: 6, borderTop: '1px solid #f5f5f5', textAlign: 'left' }}>
                                🗑 Supprimer cette collection
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>

        {!loaded && (
          <div className="card-grid">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="card-item" style={{ borderRadius: 8, overflow: 'hidden', background: '#f0f0f0' }}>
                <div style={{ width: '100%', aspectRatio: '2.5/3.5', background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)', backgroundSize: '200% 100%', animation: 'shimmer 1.5s infinite' }} />
                <div style={{ padding: 8 }}>
                  <div style={{ height: 10, background: '#e0e0e0', borderRadius: 4, marginBottom: 6, width: '80%' }} />
                  <div style={{ height: 8, background: '#e8e8e8', borderRadius: 4, width: '60%' }} />
                </div>
              </div>
            ))}
            <style>{`@keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }`}</style>
          </div>
        )}

        <style>{`
          .card-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
          .card-item { flex: 0 0 calc(50% - 5px); max-width: calc(50% - 5px); }
          @media (max-width: 768px) {
            .header-stats-block { width: 100% !important; align-items: center !important; }
          }
          @media (min-width: 900px) { .card-item { flex: 0 0 calc(20% - 10px); max-width: calc(20% - 10px); } }

          .sticker-badge {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: default;
            line-height: 1;
            filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 4px white);
            transition: transform 0.15s;
          }
          .sticker-badge:hover { transform: scale(1.15); }
          .sticker-badge::after {
            content: attr(data-label);
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.82);
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 8px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
            z-index: 20;
            font-family: inherit;
          }
          .sticker-badge:hover::after { opacity: 1; }

          .sticker-team {
            position: relative;
            display: inline-flex;
            cursor: default;
            filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 4px white);
            transition: transform 0.15s;
          }
          .sticker-team:hover { transform: scale(1.15); }
          .sticker-team::after {
            content: attr(data-label);
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.82);
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 8px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
            z-index: 20;
            font-family: inherit;
          }
          .sticker-team:hover::after { opacity: 1; }

          .sticker-holo {
            position: relative;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            cursor: default;
            line-height: 1;
            transition: transform 0.15s;
            animation: holo-glow 3s linear infinite;
          }
          .sticker-holo:hover { transform: scale(1.15); }
          .sticker-holo::after {
            content: attr(data-label);
            position: absolute;
            bottom: calc(100% + 8px);
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.82);
            color: white;
            font-size: 12px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 8px;
            white-space: nowrap;
            pointer-events: none;
            opacity: 0;
            transition: opacity 0.15s;
            z-index: 20;
            font-family: inherit;
          }
          .sticker-holo:hover::after { opacity: 1; }
          @keyframes holo-glow {
            0%   { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #ff6b6b) drop-shadow(0 0 14px #ff6b6b); }
            16%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #ffd93d) drop-shadow(0 0 14px #ffd93d); }
            33%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #6bcb77) drop-shadow(0 0 14px #6bcb77); }
            50%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #4d96ff) drop-shadow(0 0 14px #4d96ff); }
            66%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #c77dff) drop-shadow(0 0 14px #c77dff); }
            83%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #ff6b9d) drop-shadow(0 0 14px #ff6b9d); }
            100% { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 3px white) drop-shadow(0 0 8px #ff6b6b) drop-shadow(0 0 14px #ff6b6b); }
          }
          .holo-name {
            background: linear-gradient(90deg,#ff0080,#ff8c00,#ffee00,#00e676,#00b0ff,#e040fb,#ff0080);
            background-size: 300% 100%;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
            animation: holo-text 10s linear infinite;
          }
          @keyframes holo-text {
            0%   { background-position: 0% 50%; }
            100% { background-position: 300% 50%; }
          }
          @media (max-width: 600px) {
            .holo-name { animation: none; background-position: 30% 50%; }
          }
        `}</style>
        
        {editMode && isOwner && selectedCards.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, background: '#003DA6', color: 'white', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700, flexWrap: 'wrap' }}>
            <span style={{ flex: '1 1 120px' }}>{selectedCards.size} carte{selectedCards.size > 1 ? 's' : ''} sélectionnée{selectedCards.size > 1 ? 's' : ''}</span>
            {/* Assigner collection tag en masse */}
            {showBulkNewTag ? (
              <>
              <input
                autoFocus
                value={bulkNewTag}
                onChange={e => setBulkNewTag(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === 'Escape') { setShowBulkNewTag(false); setBulkNewTag(''); return }
                  if (e.key !== 'Enter') return
                  const tag = bulkNewTag.trim()
                  if (!tag) { setShowBulkNewTag(false); return }
                  const ids = [...selectedCards]
                  await Promise.all(ids.map(async (id) => {
                    const card = cards.find(c => (c.isManuelle ? c.id_manuelle : c.f) === id)
                    if (!card) return
                    if (card.isManuelle && card.id_manuelle) {
                      await supabase.from('cartes_manuelles').update({ collection_tag: tag }).eq('id', card.id_manuelle)
                    } else {
                      await supabase.from('carte_tags').upsert({ user_id: currentUser!, card_key: card.f, collection_tag: tag }, { onConflict: 'user_id,card_key' })
                    }
                  }))
                  setCards(prev => prev.map(c => { const id = c.isManuelle ? c.id_manuelle : c.f; return id && selectedCards.has(id) ? { ...c, collection_tag: tag } : c }))
                  if (!collectionTags.includes(tag)) setCollectionTags(prev => [...prev, tag].sort())
                  setBulkNewTag(''); setShowBulkNewTag(false)
                }}
                placeholder="Nom de la collection… (Entrée)"
                style={{ background: 'white', border: 'none', borderRadius: 6, color: '#111', padding: '5px 10px', fontSize: 12, fontWeight: 700, flexShrink: 0, width: 180, outline: 'none' }}
              />
              <button
                onMouseDown={e => e.preventDefault()}
                onClick={() => { setShowBulkNewTag(false); setBulkNewTag('') }}
                style={{ background: 'rgba(255,255,255,0.25)', border: 'none', borderRadius: 4, color: 'white', padding: '4px 8px', fontSize: 11, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >✕</button>
              </>
            ) : (
              <select
                value=""
                onChange={async (e) => {
                  const tag = e.target.value
                  if (!tag) return
                  if (tag === '__new__') { setShowBulkNewTag(true); return }
                  const applyTag = tag === '__none__' ? '' : tag
                  const ids = [...selectedCards]
                  await Promise.all(ids.map(async (id) => {
                    const card = cards.find(c => (c.isManuelle ? c.id_manuelle : c.f) === id)
                    if (!card) return
                    if (card.isManuelle && card.id_manuelle) {
                      await supabase.from('cartes_manuelles').update({ collection_tag: applyTag || null }).eq('id', card.id_manuelle)
                    } else {
                      if (applyTag) {
                        await supabase.from('carte_tags').upsert({ user_id: currentUser!, card_key: card.f, collection_tag: applyTag }, { onConflict: 'user_id,card_key' })
                      } else {
                        await supabase.from('carte_tags').delete().eq('user_id', currentUser!).eq('card_key', card.f)
                      }
                    }
                  }))
                  setCards(prev => prev.map(c => { const id = c.isManuelle ? c.id_manuelle : c.f; return id && selectedCards.has(id) ? { ...c, collection_tag: applyTag } : c }))
                }}
                style={{ background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, color: 'white', padding: '4px 8px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >
                <option value="" style={{ color: '#333' }}>🏷 Collection…</option>
                <option value="__new__" style={{ color: '#003DA6', fontWeight: 900 }}>✚ Créer une nouvelle…</option>
                <option value="__none__" style={{ color: '#333' }}>— Aucune —</option>
                {collectionTags.map(tag => (
                  <option key={tag} value={tag} style={{ color: '#333' }}>{tag}</option>
                ))}
              </select>
            )}
            <button onClick={() => setSelectedCards(new Set())} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 6, color: 'white', padding: '4px 10px', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
              ✕ Désélectionner
            </button>
          </div>
        )}

        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={e => setActiveDragId(e.active.id as string)}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={displayed.map(getCardId)} strategy={rectSortingStrategy}>
          <div ref={gridRef} className="card-grid">
          {displayed.map((d) => (
            <SortableCard
              key={getCardId(d)}
              id={getCardId(d)}
              disabled={!editMode || !isOwner || sortBy !== 'default'}
              className="card-item"
              onClick={() => editMode && isOwner ? toggleCardSelection(getCardId(d)) : (!editMode && setPopup(d))}
              style={{
              borderRadius: 8, padding: 8,
              background: selectedCards.has(getCardId(d)) ? '#e8f0fe' : 'white',
              outline: selectedCards.has(getCardId(d)) ? '2px solid #003DA6' : 'none',
              cursor: editMode && isOwner && sortBy === 'default' ? 'pointer' : editMode ? 'default' : 'pointer',
              ...((privateCards.has(d.f) && isOwner)
                ? { border: '2px solid #e74c3c' }
                : coloredBorder((d.collection_tag && tabSettings.get(d.collection_tag)?.color) || accent)),
              boxSizing: 'border-box',
              opacity: activeDragId === getCardId(d) ? 0.4 : privateCards.has(d.f) && isOwner ? 0.7 : 1,
              position: 'relative',
              transition: 'opacity 0.15s',
              overflow: 'visible',
            }}>
              {isOwner && privateCards.has(d.f) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: '#e74c3c', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, zIndex: 2 }}>
                  {t('gallery_private')}
                </div>
              )}
              {editMode && isOwner && selectedCards.has(getCardId(d)) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: '#003DA6', color: 'white', fontSize: 13, width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3, fontWeight: 900 }}>
                  ✓
                </div>
              )}

              {/* Actions du mode édition (Confidentialité + Valeur + Suppression) */}
              {editMode && isOwner && (
                <div style={{ position: 'absolute', top: 4, left: 0, right: 0, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 4, padding: '0 4px' }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button onClick={e => { e.stopPropagation(); togglePrivate(d.f) }} style={{
                      flex: 1, background: privateCards.has(d.f) ? '#e74c3c' : '#003DA6',
                      color: 'white', border: 'none', borderRadius: 6,
                      padding: '4px 4px', fontSize: 9, fontWeight: 900, cursor: 'pointer',
                    }}>
                      {privateCards.has(d.f) ? t('gallery_make_public') : t('gallery_make_private')}
                    </button>
                    {d.isManuelle && d.id_manuelle && (<>
                      <button onClick={e => { e.stopPropagation(); window.location.href = `/galerie/${userId}/editer/${d.id_manuelle}` }} style={{
                        background: '#f59e0b', color: 'white', border: 'none', borderRadius: 6,
                        padding: '4px 6px', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                      }} title={lang === 'fr' ? 'Modifier la carte' : 'Edit card'}>
                        ✏️
                      </button>
                      <button onClick={e => { e.stopPropagation(); handleDeleteCard(d.id_manuelle!, d.f) }} style={{
                        background: '#e74c3c', color: 'white', border: 'none', borderRadius: 6,
                        padding: '4px 6px', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                      }} title={lang === 'fr' ? 'Supprimer la carte' : 'Delete card'}>
                        🗑️
                      </button>
                    </>)}
                  </div>
                  {/* Valeur estimée (privée) */}
                  <div onClick={e => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.75)', borderRadius: 6, padding: '3px 6px', gap: 4 }}>
                    <span style={{ color: '#ffd700', fontSize: 10, fontWeight: 800, flexShrink: 0 }}>€</span>
                    <input
                      type="number" min="0" step="0.01" placeholder="valeur"
                      defaultValue={cardValues.get(d.f) ?? ''}
                      onBlur={e => updateCardValue(d.f, e.target.value === '' ? null : parseFloat(e.target.value))}
                      onClick={e => e.stopPropagation()}
                      style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: 'white', fontSize: 11, fontWeight: 700 }}
                    />
                  </div>
                </div>
              )}
              <div style={{ width: '100%', marginBottom: 8 }}>{renderCardImage(d)}</div>
              {getTags(d)}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4, marginTop: 4 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 800, fontSize: 13, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.n}</p>
                  <p style={{ fontSize: 10, color: accent, fontWeight: 700, margin: '2px 0', fontStyle: 'italic', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.v}</p>
                  <p style={{ fontSize: 10, color: '#999', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.y} {d.br} {d.s}</span>
                    {d.card_number && <span style={{ flexShrink: 0, fontWeight: 800, color: '#555', background: '#f0f0f0', borderRadius: 4, padding: '1px 5px', fontSize: 9 }}>#{d.card_number}</span>}
                  </p>
                </div>
                {/* Bouton like */}
                {!editMode && (() => {
                  const likeInfo = cardLikes.get(d.f) || { count: 0, liked: false }
                  return (
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        if (!currentUser) return
                        const isLiked = likeInfo.liked
                        setCardLikes(prev => {
                          const m = new Map(prev)
                          m.set(d.f, { count: likeInfo.count + (isLiked ? -1 : 1), liked: !isLiked })
                          return m
                        })
                        if (isLiked) {
                          await supabase.from('card_likes').delete().eq('card_key', d.f).eq('gallery_user_id', userId).eq('liker_user_id', currentUser)
                        } else {
                          await supabase.from('card_likes').upsert({ card_key: d.f, gallery_user_id: userId, liker_user_id: currentUser }, { onConflict: 'card_key,gallery_user_id,liker_user_id' })
                          // Notifier le propriétaire de la carte (pas soi-même)
                          if (currentUser !== userId) {
                            const { data: liker } = await supabase.from('profiles').select('username').eq('id', currentUser).single()
                            await supabase.from('notifications').insert({
                              user_id: userId,
                              type: 'like',
                              content: `${liker?.username || 'Quelqu\'un'} a aimé votre carte ${d.f}`,
                              link: `/galerie/${userId}`,
                              lu: false,
                            })
                          }
                        }
                      }}
                      style={{
                        background: 'none', border: 'none', cursor: currentUser ? 'pointer' : 'default',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
                        padding: '2px 4px', flexShrink: 0,
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1, transition: '0.15s', transform: likeInfo.liked ? 'scale(1.2)' : 'scale(1)' }}>
                        {likeInfo.liked ? '❤️' : '🤍'}
                      </span>
                      {likeInfo.count > 0 && <span style={{ fontSize: 9, fontWeight: 800, color: likeInfo.liked ? '#e53935' : '#bbb' }}>{likeInfo.count}</span>}
                    </button>
                  )
                })()}
              </div>
          </SortableCard>
          ))}
          </div>
          </SortableContext>
        </DndContext>

        {/* Scroll infini */}
        {loaded && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>
            {displayed.length < filtered.length ? (
              <div ref={loaderRef} style={{ padding: 20 }}>
                <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #eee', borderTopColor: '#003DA6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            ) : filtered.length > 0 ? (
              <p style={{ color: '#bbb', fontSize: 12 }}>{filtered.length} {t('gallery_total')}</p>
            ) : cards.length === 0 ? (
              <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🃏</div>
                {isOwner ? (
                  <>
                    <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Ta galerie est vide</p>
                    <p style={{ color: '#999', fontSize: 13, marginBottom: 20 }}>Ajoute ta première carte ou connecte ton Google Sheets depuis le profil.</p>
                    <a href={`/galerie/${userId}/ajouter`} style={{ background: '#003DA6', color: 'white', padding: '12px 24px', borderRadius: 50, fontWeight: 800, fontSize: 14, textDecoration: 'none', display: 'inline-block' }}>+ Ajouter une carte</a>
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 800, fontSize: 16, marginBottom: 8 }}>Galerie vide</p>
                    <p style={{ color: '#999', fontSize: 13 }}>Ce collectionneur n'a pas encore ajouté de cartes.</p>
                  </>
                )}
              </div>
            ) : null}
          </div>
        )}
        </>}
      </div>

      {popup && (
        <Viewer3D popup={popup} accent={accent} onClose={() => setPopup(null)} getTags={getTags} userId={userId} userSlug={profile?.slug || userId}
          isOwner={isOwner} currentUserId={currentUser ?? undefined}
          onNext={() => {
            if (!popup) return
            const idx = filtered.findIndex(c => c.f === popup.f)
            if (idx < filtered.length - 1) setPopup(filtered[idx + 1])
          }}
          onPrev={() => {
            if (!popup) return
            const idx = filtered.findIndex(c => c.f === popup.f)
            if (idx > 0) setPopup(filtered[idx - 1])
          }}
          onAddToMyGallery={!isOwner && currentUser ? async () => {
            if (addedCards.has(popup.f)) return 'duplicate'
            let dupQuery = supabase.from('cartes_manuelles')
              .select('id').eq('user_id', currentUser).eq('nom', popup.n).eq('collection', popup.s || '')
            if (popup.v) dupQuery = dupQuery.eq('variation', popup.v)
            else dupQuery = (dupQuery as any).is('variation', null)
            const { data: existing } = await dupQuery.limit(1)
            if (existing && existing.length > 0) {
              setAddedCards(prev => new Set(prev).add(popup.f))
              return 'duplicate'
            }
            const verso = popup.b !== popup.f ? popup.b : null
            await supabase.from('cartes_manuelles').insert({
              user_id: currentUser,
              nom: popup.n || null, equipe: popup.t || null, annee: popup.y || null,
              marque: popup.br || null, collection: popup.s || null, variation: popup.v || null,
              num: popup.num || null, card_number: popup.card_number || null,
              auto: popup.auto, rc: popup.rc, patch: popup.patch, booklet: popup.booklet || false,
              grade: popup.g || 'Raw',
              image_recto: popup.f || null, image_verso: verso,
            })
            setAddedCards(prev => new Set(prev).add(popup.f))
            return 'added'
          } : undefined}
          initialAddState={addedCards.has(popup.f) ? 'added' : 'idle'}
          onCollectionTagChange={async (card, tag) => {
            if (card.isManuelle && card.id_manuelle) {
              await supabase.from('cartes_manuelles').update({ collection_tag: tag || null }).eq('id', card.id_manuelle)
            } else {
              if (tag) {
                await supabase.from('carte_tags').upsert({ user_id: currentUser!, card_key: card.f, collection_tag: tag }, { onConflict: 'user_id,card_key' })
              } else {
                await supabase.from('carte_tags').delete().eq('user_id', currentUser!).eq('card_key', card.f)
              }
            }
            setCards(prev => prev.map(c => c.f === card.f ? { ...c, collection_tag: tag } : c))
            setPopup(prev => prev ? { ...prev, collection_tag: tag } : null)
          }}
        />
      )}

      {showBackToTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          style={{
            position: 'fixed', bottom: 24, right: 24, zIndex: 9000,
            width: 44, height: 44, borderRadius: '50%',
            background: accent, color: 'white', border: 'none',
            fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
            transition: 'opacity 0.2s',
          }}
          aria-label="Retour en haut"
        >↑</button>
      )}
    </>
  )
}