'use client'
import { useEffect, useState, use } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Entry {
  id: number
  card_number: string | null
  player_name: string
  team: string | null
  variation: string | null
  is_rc: boolean
  owned: boolean
  manually_checked: boolean
  completion_id: string | null
}

interface VariationMeta {
  name: string
  count: number
  owned: number
  loaded: boolean
  entries: Entry[]
}

interface CardSet {
  id: number
  name: string
  year: number | null
  brand: string | null
  sport: string
  total_cards: number
}

export default function SetDetailPage({ params }: { params: Promise<{ setId: string }> }) {
  const { setId } = use(params)
  const [set, setSet] = useState<CardSet | null>(null)
  const [variations, setVariations] = useState<VariationMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'owned' | 'missing'>('all')
  const [filterTeam, setFilterTeam] = useState('')
  const [saving, setSaving] = useState<number | null>(null)
  const [openVariations, setOpenVariations] = useState<Set<string>>(new Set(['Base']))
  const [totalOwned, setTotalOwned] = useState(0)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  useEffect(() => { loadSet() }, [setId, userId])

  async function loadSet() {
    setLoading(true)
    const { data: setData } = await supabase.from('card_sets').select('*').eq('id', setId).single()
    if (!setData) { setLoading(false); return }
    setSet(setData)

    // Charger les counts par variation via RPC (évite la limite max_rows)
    const { data: varData } = await supabase.rpc('get_set_variations', { p_set_id: parseInt(setId) })
    if (!varData) { setLoading(false); return }

    const counts = new Map<string, number>()
    for (const row of varData) {
      const v = row.variation ?? 'Base'
      counts.set(v, Number(row.cnt))
    }

    // Récupérer les completions de l'user pour ce set (juste entry_id)
    let completedEntryIds = new Set<number>()
    let completionDetails = new Map<number, { id: string; manually_checked: boolean }>()
    let galleryCards: { nom: string; annee: string; marque: string; collection: string; collection_tag: string; variation: string }[] = []

    if (userId) {
      // Charger tous les entry_ids du set (pagination pour dépasser max_rows=1000)
      const allEntries: { id: number; player_name: string; variation: string | null }[] = []
      const PAGE = 1000
      for (let from = 0; ; from += PAGE) {
        const { data: page } = await supabase
          .from('card_set_entries')
          .select('id, player_name, variation')
          .eq('set_id', setId)
          .range(from, from + PAGE - 1)
        if (!page || page.length === 0) break
        allEntries.push(...page)
        if (page.length < PAGE) break
      }

      if (allEntries) {
        const entryIds = allEntries.map(e => e.id)

        // Charger les completions en chunks (évite 400 si trop d'entry_ids)
        const allCompletions: { id: string; entry_id: number; manually_checked: boolean }[] = []
        const CHUNK = 500
        for (let i = 0; i < entryIds.length; i += CHUNK) {
          const { data: chunk } = await supabase
            .from('user_set_completion')
            .select('id, entry_id, manually_checked')
            .eq('user_id', userId)
            .in('entry_id', entryIds.slice(i, i + CHUNK))
          if (chunk) allCompletions.push(...chunk)
        }

        if (allCompletions.length) {
          for (const c of allCompletions) {
            completedEntryIds.add(c.entry_id)
            completionDetails.set(c.entry_id, { id: c.id, manually_checked: c.manually_checked })
          }
        }

        // Auto-match galerie
        const { data: gc } = await supabase
          .from('cartes_manuelles')
          .select('nom, annee, marque, collection, collection_tag, variation')
          .eq('user_id', userId)
        galleryCards = gc || []

        if (galleryCards.length && setData.year) {
          const norm = (s: string) => s?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
          const words = (s: string) => s?.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2) || []

          const y = setData.year!
          const yearStr = String(y), yearNext = `${y}-${String(y+1).slice(2)}`, yearPrev = `${y-1}-${yearStr.slice(2)}`
          const cardsThisYear = (galleryCards as any[]).filter(c => {
            const cy = (c.annee||'').trim()
            return cy === yearStr || cy === yearNext || cy === yearPrev
          })
          console.log('[automatch] set:', setData.year, setData.brand, setData.name)
          console.log('[automatch] entries:', allEntries?.length, '| galerie this year:', cardsThisYear.length)
          for (const c of cardsThisYear) {
            const nb = norm(c.marque||''), ns = norm(setData.brand||'')
            const brandOk = !setData.brand || !c.marque || nb.includes(ns) || ns.includes(nb)
            const collToTest2 = c.collection || c.collection_tag || ''
            const userWords2 = words(collToTest2)
            const setNorm2 = norm(setData.name)
            const collOk = !collToTest2 || userWords2.length === 0 || userWords2.some((w: string) => setNorm2.includes(w))
            console.log(`  [${c.nom}] annee:${c.annee} coll:"${c.collection}" tag:"${c.collection_tag}" var:"${c.variation}" → brand:${brandOk} coll:${collOk}`)
          }

          for (const e of allEntries) {
            if (completedEntryIds.has(e.id)) continue

            const matched = (galleryCards as any[]).some(card => {
              // 1. Joueur (normalisé)
              if (norm(card.nom) !== norm(e.player_name)) return false

              // 2. Année : "2023", "2023-24", ou "2022-23" pour un set year=2023
              const y = setData.year!
              const yearStr = String(y)                                    // "2023"
              const yearNext = `${y}-${String(y + 1).slice(2)}`           // "2023-24"
              const yearPrev = `${y - 1}-${yearStr.slice(2)}`             // "2022-23"
              const cardYear = (card.annee || '').trim()
              if (cardYear !== yearStr && cardYear !== yearNext && cardYear !== yearPrev) return false

              // 3. Marque (fuzzy : l'un contient l'autre — ignoré si l'un des deux est vide)
              if (setData.brand && card.marque) {
                const nb = norm(card.marque), ns = norm(setData.brand)
                if (!nb.includes(ns) && !ns.includes(nb)) return false
              }

              // 4. Collection (fuzzy : au moins 1 mot clé en commun — ignoré si vide)
              // On teste collection ET collection_tag contre le nom du set
              const collToTest = card.collection || card.collection_tag || ''
              if (collToTest) {
                const userWords = words(collToTest)
                const setNorm = norm(setData.name)
                if (userWords.length > 0 && !userWords.some(w => setNorm.includes(w))) return false
              }

              // 5. Variation : base vs parallèle
              const cardVar = (card.variation || '').trim()
              const entryVar = (e.variation || '').trim()

              if (!cardVar) {
                // Carte sans variation → seulement les entrées base (variation null)
                return !entryVar
              } else {
                // Carte avec variation → fuzzy match (l'un contient l'autre ou mots en commun)
                if (!entryVar) return false
                const nc = norm(cardVar), ne = norm(entryVar)
                return nc.includes(ne) || ne.includes(nc) || words(cardVar).some(w => ne.includes(w))
              }
            })

            if (matched) {
              completedEntryIds.add(e.id)
              const matchCard = (galleryCards as any[]).find(card => {
                const y = setData.year!
                const yearStr = String(y), yearNext = `${y}-${String(y+1).slice(2)}`, yearPrev = `${y-1}-${yearStr.slice(2)}`
                const norm2 = (s: string) => s?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
                const cardYear = (card.annee||'').trim()
                return norm2(card.nom) === norm2(e.player_name) && (cardYear === yearStr || cardYear === yearNext || cardYear === yearPrev)
              })
              console.log('[automatch] MATCH:', e.player_name, e.variation||'(base)', '←', matchCard?.nom, matchCard?.annee, matchCard?.coll, matchCard?.var)
            }
          }
        }

        setTotalOwned(completedEntryIds.size)
      }
    }

    // Construire les variations meta (sans les cartes)
    const varNames = ['Base', ...Array.from(counts.keys()).filter(v => v !== 'Base').sort()]
    const varMetas: VariationMeta[] = varNames.map(name => ({
      name,
      count: counts.get(name) || 0,
      owned: 0, // sera calculé au chargement
      loaded: false,
      entries: [],
    }))

    setVariations(varMetas)
    setLoading(false)

    // Charger la variation Base immédiatement
    loadVariation('Base', varMetas, setData, completedEntryIds, completionDetails)
  }

  async function loadVariation(
    varName: string,
    currentVariations?: VariationMeta[],
    currentSet?: CardSet | null,
    completedIds?: Set<number>,
    completionDets?: Map<number, { id: string; manually_checked: boolean }>
  ) {
    const vars = currentVariations || variations
    const setInfo = currentSet || set
    const v = vars.find(v => v.name === varName)
    if (!v || v.loaded) return

    const isBase = varName === 'Base'
    const q = isBase
      ? supabase.from('card_set_entries').select('*').eq('set_id', setId).is('variation', null)
      : supabase.from('card_set_entries').select('*').eq('set_id', setId).eq('variation', varName)
    const { data: finalData } = await q

    if (!finalData) return

    const usedIds = completedIds || new Set<number>()
    const usedDets = completionDets || new Map<number, { id: string; manually_checked: boolean }>()

    const entries: Entry[] = finalData
      .sort((a, b) => {
        const na = parseInt(a.card_number || '9999')
        const nb = parseInt(b.card_number || '9999')
        return na - nb
      })
      .map(e => {
        const det = usedDets.get(e.id)
        return {
          ...e,
          owned: usedIds.has(e.id),
          manually_checked: det?.manually_checked || false,
          completion_id: det?.id || null,
        }
      })

    const ownedCount = entries.filter(e => e.owned).length

    setVariations(prev => prev.map(v =>
      v.name === varName ? { ...v, loaded: true, entries, owned: ownedCount } : v
    ))
  }

  async function toggleVariation(varName: string) {
    const isOpen = openVariations.has(varName)
    setOpenVariations(prev => {
      const next = new Set(prev)
      isOpen ? next.delete(varName) : next.add(varName)
      return next
    })
    if (!isOpen) {
      const v = variations.find(v => v.name === varName)
      if (v && !v.loaded) loadVariation(varName)
    }
  }

  async function toggleOwned(entry: Entry, varName: string) {
    if (!userId) return
    setSaving(entry.id)

    if (entry.owned && entry.completion_id) {
      await supabase.from('user_set_completion').delete().eq('id', entry.completion_id)
      setVariations(prev => prev.map(v =>
        v.name === varName ? {
          ...v,
          owned: v.owned - 1,
          entries: v.entries.map(e => e.id === entry.id ? { ...e, owned: false, completion_id: null } : e)
        } : v
      ))
      setTotalOwned(p => p - 1)
    } else {
      const { data } = await supabase.from('user_set_completion')
        .insert({ user_id: userId, entry_id: entry.id, manually_checked: true })
        .select('id').single()
      setVariations(prev => prev.map(v =>
        v.name === varName ? {
          ...v,
          owned: v.owned + 1,
          entries: v.entries.map(e => e.id === entry.id ? { ...e, owned: true, manually_checked: true, completion_id: data?.id || null } : e)
        } : v
      ))
      setTotalOwned(p => p + 1)
    }
    setSaving(null)
  }

  const pct = set?.total_cards ? Math.round((totalOwned / set.total_cards) * 100) : 0

  // Équipes disponibles depuis toutes les variations chargées
  const allTeams = Array.from(new Set(
    variations.flatMap(v => v.entries.map(e => e.team)).filter(Boolean) as string[]
  )).sort()

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Chargement...</div>
  if (!set) return <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Set introuvable.</div>

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <Link href="/setlist" style={{ color: '#003DA6', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>← Setlist NBA</Link>
      </div>

      {/* Header */}
      <div style={{ background: 'white', borderRadius: 16, padding: '24px 28px', boxShadow: '0 4px 20px rgba(0,0,0,0.08)', marginBottom: 24 }}>
        <h1 style={{ fontWeight: 900, fontSize: 26, marginBottom: 8 }}>{set.name}</h1>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: userId ? 16 : 0 }}>
          {set.year && <span style={{ fontSize: 13, color: '#888', fontWeight: 700 }}>{set.year}</span>}
          {set.brand && <span style={{ fontSize: 13, color: '#003DA6', fontWeight: 700, background: '#f0f4ff', borderRadius: 6, padding: '2px 8px' }}>{set.brand}</span>}
          <span style={{ fontSize: 13, color: '#aaa' }}>{set.total_cards.toLocaleString()} cartes · {variations.length} variations</span>
        </div>
        {userId ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#333' }}>{totalOwned} / {set.total_cards.toLocaleString()} possédées</span>
              <span style={{ fontSize: 20, fontWeight: 900, color: pct === 100 ? '#2ecc71' : '#003DA6' }}>{pct}%</span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: '#f0f0f0', overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? '#2ecc71' : 'linear-gradient(90deg, #003DA6, #0057D9)', borderRadius: 5, transition: 'width 0.4s' }} />
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: '#888' }}>
            <Link href="/connexion" style={{ color: '#003DA6', fontWeight: 700 }}>Connectez-vous</Link> pour tracker votre complétion
          </div>
        )}
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher un joueur..."
          style={{ flex: '1 1 200px', minWidth: 160, padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
        <select value={filterTeam} onChange={e => setFilterTeam(e.target.value)}
          style={{ padding: '10px 14px', border: `1.5px solid ${filterTeam ? '#003DA6' : '#e0e0e0'}`, borderRadius: 8, fontSize: 13, background: 'white', cursor: 'pointer', fontWeight: filterTeam ? 700 : 400, color: filterTeam ? '#003DA6' : '#666', minWidth: 160 }}>
          <option value="">Toutes les équipes</option>
          {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
        {userId && (
          <div style={{ display: 'flex', gap: 4 }}>
            {(['all', 'owned', 'missing'] as const).map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ padding: '10px 16px', border: '1.5px solid', borderColor: filter === f ? '#003DA6' : '#e0e0e0', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: filter === f ? '#003DA6' : 'white', color: filter === f ? 'white' : '#333' }}>
                {f === 'all' ? 'Tout' : f === 'owned' ? '✓ Possédées' : '✗ Manquantes'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variations */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {variations.map(variation => {
          const isOpen = openVariations.has(variation.name)
          const varPct = variation.count ? Math.round((variation.owned / variation.count) * 100) : 0

          const displayEntries = variation.loaded
            ? variation.entries.filter(e => {
                if (search && !e.player_name.toLowerCase().includes(search.toLowerCase())) return false
                if (filterTeam && e.team !== filterTeam) return false
                if (filter === 'owned' && !e.owned) return false
                if (filter === 'missing' && e.owned) return false
                return true
              })
            : []

          if ((filter !== 'all' || search || filterTeam) && variation.loaded && displayEntries.length === 0) return null

          return (
            <div key={variation.name} style={{ background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', border: '1px solid #f0f0f0' }}>
              <button onClick={() => toggleVariation(variation.name)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#111', flex: 1 }}>{variation.name}</span>
                <span style={{ fontSize: 12, color: '#aaa', whiteSpace: 'nowrap' }}>{variation.count} cartes</span>
                {userId && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
                    <div style={{ flex: 1, height: 5, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${varPct}%`, background: varPct === 100 ? '#2ecc71' : 'linear-gradient(90deg, #003DA6, #0057D9)', borderRadius: 3 }} />
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: varPct === 100 ? '#2ecc71' : '#003DA6', minWidth: 32, textAlign: 'right' }}>{varPct}%</span>
                  </div>
                )}
                <span style={{ fontSize: 11, color: '#ccc', marginLeft: 4 }}>{isOpen ? '▲' : '▼'}</span>
              </button>

              {isOpen && (
                <div style={{ borderTop: '1px solid #f5f5f5' }}>
                  {!variation.loaded ? (
                    <div style={{ padding: '20px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>Chargement...</div>
                  ) : (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '52px 1fr 150px 36px', padding: '8px 18px', background: '#fafafa', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', color: '#bbb', letterSpacing: '0.5px' }}>
                        <span>#</span><span>Joueur</span><span>Équipe</span><span></span>
                      </div>
                      {displayEntries.length === 0 ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: '#ccc', fontSize: 13 }}>Aucune carte</div>
                      ) : displayEntries.map(entry => (
                        <div key={entry.id}
                          style={{ display: 'grid', gridTemplateColumns: '52px 1fr 150px 36px', padding: '9px 18px', borderTop: '1px solid #f5f5f5', background: entry.owned ? '#f5fff7' : 'white', alignItems: 'center' }}>
                          <span style={{ fontSize: 12, color: '#bbb', fontWeight: 700 }}>{entry.card_number || '—'}</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                            <span style={{ fontSize: 14, fontWeight: entry.owned ? 700 : 400, color: entry.owned ? '#111' : '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.player_name}</span>
                            {entry.is_rc && <span style={{ fontSize: 10, fontWeight: 900, background: '#e67e22', color: 'white', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>RC</span>}
                            {entry.manually_checked && <span style={{ fontSize: 10, color: '#2ecc71', fontWeight: 700, flexShrink: 0 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 12, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.team || '—'}</span>
                          {userId ? (
                            <button onClick={() => toggleOwned(entry, variation.name)} disabled={saving === entry.id}
                              style={{ width: 28, height: 28, borderRadius: '50%', border: '2px solid', borderColor: entry.owned ? '#2ecc71' : '#ddd', background: entry.owned ? '#2ecc71' : 'white', color: entry.owned ? 'white' : '#ccc', fontWeight: 900, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: saving === entry.id ? 0.5 : 1 }}>
                              ✓
                            </button>
                          ) : <span />}
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div style={{ textAlign: 'center', padding: '16px 0', fontSize: 12, color: '#aaa' }}>
        {set.total_cards.toLocaleString()} cartes · {variations.length} variations
      </div>
    </div>
  )
}
