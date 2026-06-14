'use client'
import { useEffect, useState, useRef, use } from 'react'
import { supabase } from '@/lib/supabase'
import dynamic from 'next/dynamic'
import OnlineIndicator from '@/components/OnlineIndicator'
import GalerieExport from '@/components/GalerieExport'

const Viewer3D = dynamic(() => import('@/components/Viewer3D'), { ssr: false })
import { useLang } from '@/lib/LangContext'

const PAGE_SIZE = 48

interface Card {
  id_manuelle?: string; // Identifiant unique pour la suppression en BDD
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
  isManuelle?: boolean; // Permet de distinguer l'origine de la carte
}

export default function Galerie({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const [profile, setProfile] = useState<any>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [filtered, setFiltered] = useState<Card[]>([])
  const [displayed, setDisplayed] = useState<Card[]>([])
  const [page, setPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState({ rc: false, auto: false, num: false, patch: false })
  const [filterPrivate, setFilterPrivate] = useState(false)
  const [sortBy, setSortBy] = useState<'default' | 'n' | 'n_desc' | 't' | 'y' | 'y_desc' | 's' | 'v' | 'g' | 'valeur' | 'valeur_desc'>('default')
  const [search, setSearch] = useState('')
  const [fTeam, setFTeam] = useState('')
  const [fBrand, setFBrand] = useState('')
  const [fYear, setFYear] = useState('')
  const [teams, setTeams] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [years, setYears] = useState<string[]>([])
  const [popup, setPopup] = useState<Card | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [privateCards, setPrivateCards] = useState<Set<string>>(new Set())
  const [cardValues, setCardValues] = useState<Map<string, number>>(new Map())
  const [editMode, setEditMode] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  const isOwner = currentUser === userId
  const { t, lang } = useLang()

  useEffect(() => {
    const init = async () => {
      supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user?.id || null))
      
      let resolvedId = userId
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
        if (p) resolvedId = p.id
        else return
      }
      
      supabase.from('profiles').select('*').eq('id', resolvedId).single().then(({ data }) => {
        if (data) { setProfile(data); loadCSV(data.lien_csv ?? null) }
      })
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
      // 1. Suppression de la table des cartes manuelles
      const { error } = await supabase.from('cartes_manuelles').delete().eq('id', idManuelle).eq('user_id', userId)
      if (error) throw error

      // 2. Nettoyage de sa visibilité si elle était en mode privé
      await supabase.from('cartes_privees').delete().eq('user_id', userId).eq('card_key', cardKey)
      
      // 3. Mise à jour de l'état local pour faire disparaître l'élément instantanément
      setCards(prev => prev.filter(c => c.id_manuelle !== idManuelle))
      setPrivateCards(prev => { const s = new Set(prev); s.delete(cardKey); return s })
    } catch (e: any) {
      alert('Erreur lors de la suppression : ' + e.message)
    }
  }

  const loadCSV = async (url: string | null) => {
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
            g: c[12] || 'Raw', isManuelle: false
          }
        }).filter(Boolean) as Card[]
      }

      const { data: manuelles } = await supabase.from('cartes_manuelles').select('*').eq('user_id', userId)
      const cartesM: Card[] = (manuelles || []).map((m: any) => ({
        id_manuelle: m.id,
        f: m.image_recto || 'https://placehold.co/300x420?text=No+Image',
        b: m.image_verso || m.image_recto || 'https://placehold.co/300x420?text=No+Image',
        n: m.nom || '', t: m.equipe || '', y: m.annee || '',
        br: m.collection || '', s: m.collection || '', v: m.variation || '',
        num: m.num || '', auto: m.auto || false, rc: m.rc || false,
        patch: m.patch || false, g: m.grade || 'Raw', isManuelle: true
      }))

      const allCards = [...parsed, ...cartesM]
      setCards(allCards)
      setTeams([...new Set(allCards.map(d => d.t).filter(Boolean))].sort())
      setBrands([...new Set(allCards.map(d => d.s).filter(Boolean))].sort())
      setYears([...new Set(allCards.map(d => d.y).filter(Boolean))].sort())
      setLoaded(true)
    } catch (e) { console.error('CSV error', e); setLoaded(true) }
  }

  useEffect(() => {
    const f = cards.filter(d => {
      if (!isOwner && privateCards.has(d.f)) return false
      return (
        d.n.toLowerCase().includes(search.toLowerCase()) &&
        (!fTeam || d.t === fTeam) &&
        (!fBrand || d.s === fBrand) &&
        (!fYear || d.y === fYear) &&
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
        default:           return 0
      }
    })

    setFiltered(sorted)
    setPage(1)
    setDisplayed(sorted.slice(0, PAGE_SIZE))
  }, [cards, search, fTeam, fBrand, fYear, activeFilters, filterPrivate, privateCards, isOwner, sortBy, cardValues])

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

  const toggleFilter = (k: keyof typeof activeFilters) => setActiveFilters(p => ({ ...p, [k]: !p[k] }))

  const isOneOfOne = (num: string) => /^(1\/1|\/1)$/i.test(num.trim())

  const getTags = (d: Card) => {
    const oon = d.num && isOneOfOne(d.num)
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 18 }}>
        {d.rc && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#e67e22', color: 'white' }}>RC</span>}
        {d.auto && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#2e7d32', color: 'white' }}>AUTO</span>}
        {d.num && !oon && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>{d.num}</span>}
        {oon && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: 'linear-gradient(90deg,#b8860b,#ffd700,#fffacd,#ffd700,#b8860b)', color: '#3d2600', backgroundSize: '200% 100%', animation: 'goldshine 2s linear infinite', boxShadow: '0 0 6px 2px rgba(255,215,0,0.5)' }}>✨ 1/1</span>}
        {d.patch && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: 'white' }}>PATCH</span>}
        <style>{`@keyframes goldshine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }`}</style>
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
                <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{profile?.display_name || 'Collectionneur'}</h1>
                <OnlineIndicator lastSeen={profile?.last_seen} size={12} />
                {profile?.lien_logo && <img src={profile.lien_logo} style={{ maxHeight: 32, objectFit: 'contain' }} alt="logo" />}
              </div>
              
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
                  <button onClick={() => setEditMode(!editMode)} style={{
                    background: editMode ? '#e74c3c' : '#f0f0f0',
                    color: editMode ? 'white' : '#333',
                    border: 'none', borderRadius: 8, padding: '10px 16px',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer', flex: '1 1 auto', textAlign: 'center', minWidth: 150
                  }}>
                    {editMode ? t('gallery_done') : t('gallery_privacy')}
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
              {cardValues.size > 0 && <>
                <option value="valeur">{lang === 'fr' ? 'Valeur ↓ (plus cher en 1er)' : 'Value ↓ (highest first)'}</option>
                <option value="valeur_desc">{lang === 'fr' ? 'Valeur ↑ (moins cher en 1er)' : 'Value ↑ (lowest first)'}</option>
              </>}
            </select>
          </div>
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
        `}</style>
        
        <div className="card-grid">
          {displayed.map((d, i) => (
            <div key={i} className="card-item" onClick={() => !editMode && setPopup(d)} style={{
              border: `2px solid ${privateCards.has(d.f) && isOwner ? '#e74c3c' : accent}`,
              borderRadius: 8, padding: 8,
              background: 'white', cursor: editMode ? 'default' : 'pointer',
              boxSizing: 'border-box',
              opacity: privateCards.has(d.f) && isOwner ? 0.7 : 1,
              position: 'relative',
              overflow: 'visible',
            }}>
              {isOwner && privateCards.has(d.f) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: '#e74c3c', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, zIndex: 2 }}>
                  {t('gallery_private')}
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
              <div style={{ width: '100%', aspectRatio: '2.5/3.5', marginBottom: 8, overflow: 'hidden', position: 'relative' }}>
                <img src={d.f} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} alt={d.n} />
              </div>
              {getTags(d)}
              <p style={{ fontWeight: 800, fontSize: 13, margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.n}</p>
              <p style={{ fontSize: 10, color: accent, fontWeight: 700, margin: '2px 0', fontStyle: 'italic' }}>{d.v}</p>
              <p style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{d.y} {d.br} {d.s}</p>
            </div>
          ))}
        </div>

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
            ) : null}
          </div>
        )}
      </div>

      {popup && (
        <Viewer3D popup={popup} accent={accent} onClose={() => setPopup(null)} getTags={getTags} />
      )}
    </>
  )
}