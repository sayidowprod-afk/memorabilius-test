'use client'
import { useEffect, useState, useRef, use, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import Viewer3D from '@/components/Viewer3D'

const PAGE_SIZE = 48

interface Card {
  f: string; b: string; n: string; t: string; y: string
  br: string; s: string; v: string; num: string
  auto: boolean; rc: boolean; patch: boolean; g: string
}

export default function Galerie({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = use(params)
  const [profile, setProfile] = useState<any>(null)
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

  // Vérification stricte du propriétaire
  const isOwner = currentUser === userId

  useEffect(() => {
    // Récupérer l'utilisateur connecté de manière fiable
    supabase.auth.getUser().then(({ data }) => setCurrentUser(data.user?.id || null))
    
    // Charger le profil et le CSV
    supabase.from('profiles').select('*').eq('id', userId).single().then(({ data }) => {
      if (data) { 
        setProfile(data); 
        if (data.lien_csv) loadCSV(data.lien_csv) 
      }
    })
  }, [userId])

  // Charger la liste des cartes privées depuis la base de données
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
          g: c[12] || 'Raw'
        }
      }).filter(Boolean) as Card[]
      setCards(parsed)
      setTeams([...new Set(parsed.map(d => d.t).filter(Boolean))].sort())
      setBrands([...new Set(parsed.map(d => d.s).filter(Boolean))].sort())
      setYears([...new Set(parsed.map(d => d.y).filter(Boolean))].sort())
      setLoaded(true)
    } catch (e) { console.error('CSV error', e) }
  }

  // SÉCURITÉ : Filtrage en temps réel des cartes affichées
  useEffect(() => {
    const f = cards.filter(d => {
      // BARRIÈRE : Si la carte est privée ET que la personne connectée n'est pas le propriétaire -> On l'efface immédiatement
      if (privateCards.has(d.f) && !isOwner) {
        return false
      }

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

  const getTags = (d: Card) => (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', minHeight: 14 }}>
      {d.rc && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', background: '#fff3e0', color: '#e67e22' }}>RC</span>}
      {d.auto && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', background: '#e8f5e9', color: '#2e7d32' }}>AUTO</span>}
      {d.num && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', background: '#f5f5f5', color: '#444' }}>#{d.num}</span>}
      {d.patch && <span style={{ fontSize: 8, fontWeight: 900, padding: '2px 5px', borderRadius: 2, textTransform: 'uppercase', background: '#e3f2fd', color: '#1976d2' }}>PATCH</span>}
    </div>
  )

  const accent = profile?.couleur_bordure || '#003DA6'

  return (
    <>
      <div style={{ maxWidth: 1400, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>

        {/* Header profil */}
        <div style={{ background: 'white', borderRadius: 16, padding: '24px 30px', marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <img
            src={profile?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.display_name || 'U')}&background=003DA6&color=fff&size=128`}
            style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${accent}`, flexShrink: 0 }}
            alt={profile?.display_name}
          />
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 6 }}>
              <h1 style={{ fontSize: 24, fontWeight: 900, margin: 0 }}>{profile?.display_name || 'Collectionneur'}</h1>
              {profile?.lien_logo && <img src={profile.lien_logo} style={{ maxHeight: 32, objectFit: 'contain' }} alt="logo" />}
            </div>
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
            </div>
          </div>
          {loaded && (
            <div style={{ display: 'flex', gap: 16, flexShrink: 0, alignItems: 'center' }}>
              {[
                { val: filtered.length, label: 'Cartes' },
                { val: filtered.filter(c => c.rc).length, label: 'RC', color: '#e67e22' },
                { val: filtered.filter(c => c.auto).length, label: 'Auto', color: '#2e7d32' },
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
                  {editMode ? '✓ Terminer' : '🔒 Gérer la confidentialité'}
                </button>
              )}
            </div>
          )}
        </div>

        <div style={{ background: '#fff', padding: 10, borderRadius: 8, marginBottom: 15, border: '1px solid #eee' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 8, marginBottom: 10 }}>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>Recherche</label>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Joueur..." /></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>Équipe</label>
              <select value={fTeam} onChange={e => setFTeam(e.target.value)}>
                <option value="">Toutes</option>{teams.map(t => <option key={t}>{t}</option>)}
              </select></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>Collection</label>
              <select value={fBrand} onChange={e => setFBrand(e.target.value)}>
                <option value="">Toutes</option>{brands.map(b => <option key={b}>{b}</option>)}
              </select></div>
            <div><label style={{ fontSize: 9, fontWeight: 800, textTransform: 'uppercase', color: '#888', display: 'block', marginBottom: 3 }}>Année</label>
              <select value={fYear} onChange={e => setFYear(e.target.value)}>
                <option value="">Toutes</option>{years.map(y => <option key={y}>{y}</option>)}
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

        {!loaded && <p style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>
          {profile?.lien_csv ? 'Chargement des cartes...' : 'Ce collectionneur n\'a pas encore lié sa galerie.'}
        </p>}

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
            }}>
              {isOwner && privateCards.has(d.f) && (
                <div style={{ position: 'absolute', top: 6, left: 6, background: '#e74c3c', color: 'white', fontSize: 9, fontWeight: 900, padding: '2px 6px', borderRadius: 4, zIndex: 2 }}>
                  🔒 PRIVÉ
                </div>
              )}
              {editMode && isOwner && (
                <button onClick={e => { e.stopPropagation(); togglePrivate(d.f) }} style={{
                  position: 'absolute', top: 6, right: 6, zIndex: 2,
                  background: privateCards.has(d.f) ? '#e74c3c' : '#003DA6',
                  color: 'white', border: 'none', borderRadius: 6,
                  padding: '4px 8px', fontSize: 10, fontWeight: 900, cursor: 'pointer',
                }}>
                  {privateCards.has(d.f) ? '🔓 Rendre public' : '🔒 Rendre privé'}
                </button>
              )}
              <div style={{ width: '100%', aspectRatio: '2.5/3.5', marginBottom: 8, overflow: 'hidden' }}>
                <img src={d.f} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={d.n} />
              </div>
              {getTags(d)}
              <p style={{ fontWeight: 800, fontSize: 13, margin: '4px 0 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.n}</p>
              <p style={{ fontSize: 10, color: accent, fontWeight: 700, margin: '2px 0', fontStyle: 'italic' }}>{d.v}</p>
              <p style={{ fontSize: 10, color: '#999', marginTop: 2 }}>{d.y} {d.br} {d.s}</p>
            </div>
          ))}
        </div>

        {loaded && (
          <div style={{ textAlign: 'center', padding: '20px 0', color: '#999', fontSize: 13 }}>
            {displayed.length < filtered.length ? (
              <div ref={loaderRef} style={{ padding: 20 }}>
                <div style={{ display: 'inline-block', width: 24, height: 24, border: '3px solid #eee', borderTopColor: '#003DA6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            ) : filtered.length > 0 ? (
              <p style={{ color: '#bbb', fontSize: 12 }}>{filtered.length} carte{filtered.length > 1 ? 's' : ''} au total</p>
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
//test