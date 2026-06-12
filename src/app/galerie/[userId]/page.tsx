'use client'
import { useEffect, useState, useRef, use, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Viewer3D from '@/components/Viewer3D'
import ShareButton from '@/components/ShareButton'
import OnlineIndicator from '@/components/OnlineIndicator'
import { useLang } from '@/lib/LangContext'

const PAGE_SIZE = 48

interface Card {
  id?: string; // Permet d'identifier la carte manuelle pour sa suppression
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
  isManuelle?: boolean; // Permet de savoir si la carte provient de la table manuelle
}

export default function Galerie({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const [profile, setProfile] = useState<any>(null)
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(null)
  const [cards, setCards] = useState<Card[]>([])
  const [filtered, setFiltered] = useState<Card[]>([])
  const [displayed, setDisplayed] = useState<Card[]>([])
  const [page, setPage] = useState(1)
  const [activeFilters, setActiveFilters] = useState({ rc: false, auto: false, num: false, patch: false })
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
  const [editMode, setEditMode] = useState(false)
  const loaderRef = useRef<HTMLDivElement>(null)

  const isOwner = currentUser === userId
  const { t, lang } = useLang()
  const [cartesManuellesCount, setCartesManuellesCount] = useState(0)

  useEffect(() => {
    const init = async () => {
      supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user?.id || null))
      
      let resolvedId = userId
      
      // Si ce n'est pas un UUID, chercher par slug
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      if (!uuidRegex.test(userId)) {
        const { data: p } = await supabase.from('profiles').select('id').eq('slug', userId).single()
        if (p) resolvedId = p.id
        else return
      }
      
      supabase.from('profiles').select('*').eq('id', resolvedId).single().then(({ data }) => {
        if (data) { setProfile(data); if (data.lien_csv) loadCSV(data.lien_csv) }
      })
    }
    init()
  }, [userId])

  // Charger les cartes privées — toujours, pas seulement pour le propriétaire
  useEffect(() => {
    supabase.from('cartes_privees').select('card_key').eq('user_id', userId)
      .then(({ data }) => {
        if (data) setPrivateCards(new Set(data.map((d: any) => d.card_key)))
      })
  }, [userId])

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

  // Fonction pour supprimer définitivement une carte manuelle
  const deleteManuelleCard = async (cardId: string, e: React.MouseEvent) => {
    e.stopPropagation() // Évite d'ouvrir le Viewer3D
    if (!confirm(lang === 'fr' ? 'Voulez-vous vraiment supprimer cette carte de votre galerie ?' : 'Are you sure you want to delete this card?')) return

    const { error } = await supabase.from('cartes_manuelles').delete().eq('id', cardId).eq('user_id', userId)
    if (error) {
      alert('Erreur lors de la suppression : ' + error.message)
    } else {
      // Filtrage instantané du state local
      setCards(prev => prev.filter(c => c.id !== cardId))
    }
  }

  const loadCSV = async (url: string) => {
    try {
      const r = await fetch(url + '&t=' + Date.now())
      const t = await r.text()
      const rows = t.split(/\r?\n/).slice(4)
      const parsed: Card[] = rows.map(row => {
        const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
        if (!c[0] || !c[0].includes('http')) return null
        return {
          f: c[0]?.trim(), b: c[1]?.trim() || c[0]?.trim(),
          n: c[2] || '', t: c[3] || '', y: c[4] || '',
          br: c[5] || '', s: c[6] || '', v: c[7] || '',
          num: c[8] || '', auto: c[9]?.toLowerCase().includes('oui') || false,
          rc: c[10]?.toLowerCase().includes('oui') || false,
          patch: c[11]?.toLowerCase().includes('oui') || false,
          g: c[12] || 'Raw',
          isManuelle: false
        }
      }).filter(Boolean) as Card[]

      // Charger les cartes manuelles
      const { data: manuelles } = await supabase.from('cartes_manuelles').select('*').eq('user_id', userId)
      const cartesM: Card[] = (manuelles || []).map((m: any) => ({
        id: m.id, // Garder l'id de Supabase
        f: m.image_recto || 'https://placehold.co/300x420?text=No+Image',
        b: m.image_verso || m.image_recto || 'https://placehold.co/300x420?text=No+Image',
        n: m.nom || '', t: m.equipe || '', y: m.annee || '',
        br: m.collection || '', s: m.collection || '', v: m.variation || '',
        num: m.num || '', auto: m.auto || false, rc: m.rc || false,
        patch: m.patch || false, g: m.grade || 'Raw',
        isManuelle: true
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
        (!activeFilters.num || d.num !== '')
      )
    })
    setFiltered(f)
    setPage(1)
    setDisplayed(f.slice(0, PAGE_SIZE))
  }, [cards, search, fTeam, fBrand, fYear, activeFilters, privateCards, isOwner])

  // Charger plus au scroll
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

  const getTags = (d: Card) => {
    const isRPA = d.rc && d.auto && d.patch
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 18 }}>
        {d.rc && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#e67e22', color: 'white' }}>RC</span>}
        {d.auto && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#2e7d32', color: 'white' }}>AUTO</span>}
        {d.num && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#7b1fa2', color: 'white' }}>/{d.num}</span>}
        {d.patch && <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 6px', borderRadius: 4, background: '#1976d2', color: 'white' }}>PATCH</span>}
      </div>
    )
  }

  const accent = profile?.couleur_bordure || '#003DA6'

  return (
    <>
      <div style={{ maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

        {/* Header profil */}
        <div style={{ background: 'white', borderRadius: 16, padding: '24px 30px', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          {/* Avatar */}
          <img
            src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, flexShrink: 0 }}
            alt={profile?.display_name}
          />
          {/* Infos */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{profile?.display_name || 'Collectionneur'}</h1>
              <OnlineIndicator lastSeen={profile?.last_seen} size={12} />
              {profile?.lien_logo && <img src={profile.lien_logo} style={{ maxHeight: 32, objectFit: 'contain' }} alt="logo" />}
              <ShareButton url={`/galerie/${userId}`} title={`Galerie de ${profile?.display_name || 'Collectionneur'} sur Memorabilius`} />
            </div>
            {/* Réseaux sociaux */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {profile?.instagram && (
                <a href={`https://instagram.com/${profile.instagram.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#E1306C', textDecoration: 'none', background: '#fce4ec', padding: '4px 10px', borderRadius: 20 }}>
                  <span>📸</span> {profile.instagram.startsWith('@') ? profile.instagram : `@${profile.instagram}`}
                </a>
              )}
              {profile?.twitter && (
                <a href={`https://x.com/${profile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#121212', textDecoration: 'none', background: '#f0f0f0', padding: '4px 10px', borderRadius: 20 }}>
                  <span>𝕏</span> {profile.twitter.startsWith('@') ? profile.twitter : `@${profile.twitter}`}
                </a>
              )}
              {profile?.discord && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, color: '#5865F2', background: '#eef0ff', padding: '4px 10px', borderRadius: 20 }}>
                  <span>🎮</span> {profile.discord}
                </span>
              )}
              {/* Bouton message */}
              {currentUser && currentUser !== userId && (
                <a href={`/messages?to=${userId}`} style={{
                  display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700,
                  color: 'white', background: accent, padding: '6px 14px', borderRadius: 20, textDecoration: 'none'
                }}>
                  {t('gallery_message')}
                </a>
              )}
            </div>
          </div>
          {/* Stats rapides */}
          {loaded && (
            <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
              {[
                { val: filtered.length, label: t('gallery_cards') },
                { val: filtered.filter(c => c.rc).length, label: 'RC', color: '#e67e22' },
                { val: filtered.filter(c => c.auto).length, label: 'Auto', color: '#2e7d32' },
                { val: filtered.filter(c => c.num).length, label: 'Num', color: '#7b1fa2' },
                { val: filtered.filter(c => c.patch).length, label: 'Patch', color: '#1976d2' },
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 900, color: s.color || accent }}>{s.val}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: '#999', textTransform: 'uppercase' }}>{s.label}</div>
                </div>
              ))}
              {isOwner && (
                <button onClick={() => setEditMode(!editMode)} style={{
                  background: editMode ? '#e74c3c' : '#f0f0f0',
                  color: editMode ? 'white' : '#333',
                  border: 'none', borderRadius: 8, padding: '8px 14px',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  marginLeft: 8,
                }}>
                  {editMode ? t('gallery_done') : t('gallery_privacy')}
                </button>
              )}
              {isOwner && !editMode && (
                <a href={`/galerie/${userId}/ajouter`} style={{
                  background: '#003DA6', color: 'white',
                  border: 'none', borderRadius: 8, padding: '8px 14px',
                  fontWeight: 700, fontSize: 12, cursor: 'pointer',
                  marginLeft: 4, textDecoration: 'none', display: 'inline-block',
                }}>
                  ➕ {lang === 'fr' ? 'Ajouter' : 'Add'}
                </a>
              )}
            </div>
          )}
        </div>

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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 5 }}>
            {(['rc', 'auto', 'num', 'patch'] as const).map(k => (
              <button key={k} onClick={() => toggleFilter(k)} style={{
                padding: '8px 2px', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                background: activeFilters[k] ? accent : '#f0f0f0', color: activeFilters[k] ? 'white' : '#333'
              }}>{k === 'num' ? '# NUM' : k.toUpperCase()}</button>
            ))}
          </div>
        </div>

        {!loaded && profile?.lien_csv && (
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
        {!loaded && !profile?.lien_csv && (
          <p style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>Ce collectionneur n'a pas encore lié sa galerie.</p>
        )}

        <style>{`
          .card-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 10px; }
          .card-item { flex: 0 0 calc(50% - 6px); max-width: calc(50% - 6px); }
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
              {/* Boutons d'administration en mode édition */}
              {editMode && isOwner && (
                <div style={{ position: 'absolute', top: 6, right: 6, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-end' }}>
                  <button onClick={e => { e.stopPropagation(); togglePrivate(d.f) }} style={{
                    background: privateCards.has(d.f) ? '#e74c3c' : '#003DA6',
                    color: 'white', border: 'none', borderRadius: 6,
                    padding: '4px 8px', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                  }}>
                    {privateCards.has(d.f) ? t('gallery_make_public') : t('gallery_make_private')}
                  </button>
                  
                  {/* Bouton de suppression : N'apparaît que si la carte est manuelle */}
                  {d.isManuelle && d.id && (
                    <button onClick={e => deleteManuelleCard(d.id!, e)} style={{
                      background: '#d32f2f', color: 'white', border: 'none', borderRadius: 6,
                      padding: '4px 8px', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}>
                      🗑️ {lang === 'fr' ? 'Supprimer' : 'Delete'}
                    </button>
                  )}
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
          <div style={{ textTransform: 'none', textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>
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