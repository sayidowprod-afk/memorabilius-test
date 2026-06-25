'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface CardSet {
  id: number
  tcdb_id: number | null
  name: string
  year: number | null
  brand: string | null
  sport: string
  total_cards: number
  owned?: number
  pct?: number
}

interface GalleryCard {
  nom: string; annee: string; marque: string; collection: string; collection_tag: string; variation: string; card_number?: string
}

interface SetCandidate {
  setId: number; setName: string; setYear: number | null; entryId: number
}

interface UnmatchedCard extends GalleryCard {
  candidates: SetCandidate[]
}

function CompletionBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? '#2ecc71' : pct >= 40 ? '#f39c12' : pct > 0 ? '#3498db' : '#e0e0e0'
  return (
    <div style={{ height: 5, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden', marginTop: 6 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  )
}

function seasonLabel(year: number) {
  return `${year}-${String(year + 1).slice(2)}`
}

export default function SetlistPage() {
  const [sets, setSets] = useState<CardSet[]>([])
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [activeSeason, setActiveSeason] = useState<number | null>(null)
  const [activeDecade, setActiveDecade] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncDone, setSyncDone] = useState(false)
  const [newMatchCount, setNewMatchCount] = useState(0)
  const [unmatchedCards, setUnmatchedCards] = useState<UnmatchedCard[]>([])
  const [showMissing, setShowMissing] = useState(false)
  const [showAddManual, setShowAddManual] = useState(false)
  const [manualForm, setManualForm] = useState({ nom: '', annee: '', marque: '', collection: '', variation: '' })
  const [placingIdx, setPlacingIdx] = useState<number | null>(null)
  const [gotoPickerIdx, setGotoPickerIdx] = useState<number | null>(null)
  const [gotoSetId, setGotoSetId] = useState<string>('')
  const [gotoAllSets, setGotoAllSets] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null)
      setAuthReady(true)
    })
  }, [])

  // Restaurer la liste des cartes non placées depuis le stockage local
  useEffect(() => {
    if (!userId) return
    try {
      const raw = localStorage.getItem(`setlist_unmatched_${userId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed?.cards)) {
          setUnmatchedCards(parsed.cards)
          setSyncDone(true)
        }
      }
    } catch {}
  }, [userId])

  const saveUnmatched = useCallback((cards: UnmatchedCard[]) => {
    if (!userId) return
    try {
      localStorage.setItem(`setlist_unmatched_${userId}`, JSON.stringify({ cards, syncedAt: Date.now() }))
    } catch {}
  }, [userId])

  const cardFingerprint = (c: Pick<UnmatchedCard, 'nom' | 'annee' | 'collection' | 'variation'>) =>
    `${c.nom}|${c.annee}|${c.collection}|${c.variation || ''}`

  const getDismissed = useCallback((): Set<string> => {
    if (!userId) return new Set()
    try { return new Set(JSON.parse(localStorage.getItem(`setlist_dismissed_${userId}`) || '[]')) } catch { return new Set() }
  }, [userId])

  const saveDismissed = useCallback((s: Set<string>) => {
    if (!userId) return
    try { localStorage.setItem(`setlist_dismissed_${userId}`, JSON.stringify([...s])) } catch {}
  }, [userId])

  const dismissCard = useCallback(async (idx: number) => {
    const card = unmatchedCards[idx]
    const dismissed = getDismissed()
    dismissed.add(cardFingerprint(card))
    saveDismissed(dismissed)
    const updated = unmatchedCards.filter((_, i) => i !== idx)
    setUnmatchedCards(updated)
    saveUnmatched(updated)
    await fetchAndCacheSets(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unmatchedCards, getDismissed, saveDismissed, saveUnmatched])

  const SETS_CACHE_KEY = userId ? `setlist_sets_v2_${userId}` : null

  // Charge les sets depuis Supabase et met à jour le cache
  const fetchAndCacheSets = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)

    const allRaw: any[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from('card_sets')
        .select('id, tcdb_id, name, year, brand, sport, total_cards')
        .eq('sport', 'nba')
        .order('year', { ascending: false })
        .range(from, from + 999)
      if (!page?.length) break
      allRaw.push(...page)
      if (page.length < 1000) break
    }
    const setsData = allRaw.length ? allRaw : null
    if (!setsData) { if (!silent) setLoading(false); return }

    if (!userId) {
      const result = setsData.map(s => ({ ...s, owned: 0, pct: 0 }))
      setSets(result)
      const mostRecent = setsData[0]?.year
      if (mostRecent) setActiveSeason(prev => prev ?? mostRecent)
      if (!silent) setLoading(false)
      return
    }

    const allCompletions: { entry_id: number; card_set_entries: { set_id: number } | null }[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase
        .from('user_set_completion')
        .select('entry_id, card_set_entries(set_id)')
        .eq('user_id', userId)
        .range(from, from + 999)
      if (!page?.length) break
      allCompletions.push(...(page as any))
      if (page.length < 1000) break
    }

    const countBySet = new Map<number, number>()
    allCompletions.forEach((c: any) => {
      const setId = c.card_set_entries?.set_id
      if (setId) countBySet.set(setId, (countBySet.get(setId) || 0) + 1)
    })

    const enriched = setsData.map(s => {
      const owned = countBySet.get(s.id) || 0
      const pct = s.total_cards > 0 ? Math.round((owned / s.total_cards) * 100) : 0
      return { ...s, owned, pct }
    })

    setSets(enriched)
    const mostRecent = setsData[0]?.year
    if (mostRecent) setActiveSeason(prev => prev ?? mostRecent)
    if (!silent) setLoading(false)

    // Mettre en cache pour la prochaine visite
    if (SETS_CACHE_KEY) {
      try { localStorage.setItem(SETS_CACHE_KEY, JSON.stringify({ sets: enriched, ts: Date.now() })) } catch {}
    }
  }, [userId, SETS_CACHE_KEY])

  const loadSets = useCallback(async () => {
    // 1. Charger le cache instantanément si disponible
    if (SETS_CACHE_KEY) {
      try {
        const raw = localStorage.getItem(SETS_CACHE_KEY)
        if (raw) {
          const { sets: cached, ts } = JSON.parse(raw)
          if (Array.isArray(cached) && cached.length) {
            setSets(cached)
            const mostRecent = cached.find((s: CardSet) => s.year)?.year
            if (mostRecent) setActiveSeason(prev => prev ?? mostRecent)
            setLoading(false)
            // Rafraîchir silencieusement si le cache a + de 5 min
            if (Date.now() - ts > 5 * 60 * 1000) fetchAndCacheSets(true)
            return
          }
        }
      } catch {}
    }
    // 2. Pas de cache → chargement normal
    await fetchAndCacheSets(false)
  }, [SETS_CACHE_KEY, fetchAndCacheSets])

  // N'appelle loadSets qu'une fois l'auth résolue — évite le flash owned=0
  useEffect(() => { if (authReady) loadSets() }, [loadSets, authReady])

  const syncAll = async () => {
    if (!userId) return
    setSyncing(true); setSyncProgress(0); setSyncDone(false)
    // Normalise les diacritiques avant suppression : Jokić→Jokic, Dončić→Doncic, Šarić→Saric…
    const stripD = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '')
    const norm = (s: string) => s ? stripD(s).toLowerCase().replace(/[^a-z0-9]/g, '') : ''
    const words = (s: string) => s ? stripD(s).toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2) : []

    // Sous-marques Panini/Topps : "Panini" doit matcher un set dont brand="Hoops", "Prizm", etc.
    const BRAND_PARENT: Record<string, string> = {
      hoops: 'panini', prizm: 'panini', select: 'panini', donruss: 'panini',
      optic: 'panini', mosaic: 'panini', chronicles: 'panini', contenders: 'panini',
      spectra: 'panini', noir: 'panini', obsidian: 'panini', immaculate: 'panini',
      revolution: 'panini', eminence: 'panini', illusions: 'panini', nbahoops: 'panini',
      flagship: 'topps', finest: 'topps', bowman: 'topps',
    }
    const normBrand = (b: string) => { const n = norm(b); return BRAND_PARENT[n] ?? n }

    // Alias de noms de collection : "Flagship" ↔ "Topps Flagship" ↔ "Topps", "NBA Hoops" ↔ "Hoops"
    const COLL_ALIASES: Record<string, string[]> = {
      topps:        ['toppsflagship', 'flagship'],
      toppsflagship: ['topps', 'flagship'],
      flagship:     ['topps', 'toppsflagship'],
      nbahoops:     ['hoops'],
      hoops:        ['nbahoops'],
    }
    const collWords = (coll: string) => {
      const base = words(coll)
      const extra = COLL_ALIASES[norm(coll)] || []
      return [...new Set([...base, ...extra])]
    }

    // 1. Galerie (manuelles + CSV)
    const { data: gc } = await supabase.from('cartes_manuelles')
      .select('nom, annee, marque, collection, collection_tag, variation, card_number').eq('user_id', userId)
    let galleryCards: GalleryCard[] = (gc || []) as GalleryCard[]

    const { data: prof } = await supabase.from('profiles').select('lien_csv').eq('id', userId).single()
    if (prof?.lien_csv) {
      try {
        const r = await fetch(prof.lien_csv + '&t=' + Date.now(), { signal: AbortSignal.timeout(8000) })
        const txt = await r.text()
        const csvCards = txt.split(/\r?\n/).slice(4).map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          if (!c[0]?.includes('http')) return null
          return { nom: c[2]?.trim() || '', annee: c[4]?.trim() || '', marque: c[5]?.trim() || '', collection: c[6]?.trim() || '', collection_tag: '', variation: c[7]?.trim() || '' } as GalleryCard
        }).filter(Boolean) as GalleryCard[]
        galleryCards = [...galleryCards, ...csvCards]
      } catch {}
    }
    if (!galleryCards.length) { setSyncing(false); return }

    // Charger les entry_ids déjà en base (toutes les cartes déjà placées, auto ou manuelles)
    // → on ne les recrée pas, et on ne les supprime jamais lors d'une sync
    const existingEntryIds = new Set<number>()
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase.from('user_set_completion')
        .select('entry_id').eq('user_id', userId).range(from, from + 999)
      if (!page?.length) break
      page.forEach((r: any) => existingEntryIds.add(r.entry_id))
      if (page.length < 1000) break
    }
    setSyncProgress(10)

    // 2. Tous les sets (métadonnées) — paginé pour dépasser la limite max_rows=1000
    const allSetsData: { id: number; name: string; year: number | null; brand: string | null }[] = []
    for (let from = 0; ; from += 1000) {
      const { data: page } = await supabase.from('card_sets').select('id, name, year, brand').eq('sport', 'nba').range(from, from + 999)
      if (!page?.length) break
      allSetsData.push(...page)
      if (page.length < 1000) break
    }
    const setsMap = new Map(allSetsData.map(s => [s.id, s]))
    setSyncProgress(15)

    // 3. Entrées pour nos joueurs (par chunks de 30 noms)
    const uniquePlayers = [...new Set(galleryCards.map(c => c.nom).filter(Boolean))]
    const allEntries: { id: number; player_name: string; variation: string | null; set_id: number; card_number: string | null }[] = []
    const PCHUNK = 30
    for (let ci = 0; ci < uniquePlayers.length; ci += PCHUNK) {
      setSyncProgress(15 + Math.round((ci / uniquePlayers.length) * 50))
      const batch = uniquePlayers.slice(ci, ci + PCHUNK)
      let from = 0
      for (;;) {
        const { data: page } = await supabase.from('card_set_entries')
          .select('id, player_name, variation, set_id, card_number').in('player_name', batch).range(from, from + 999)
        if (!page?.length) break
        allEntries.push(...page)
        if (page.length < 1000) break
        from += 1000
      }
    }
    setSyncProgress(65)

    setSyncProgress(75)

    // 5. Matching : UNE carte galerie → AU PLUS UNE entrée setlist (la plus précise)
    // On itère par carte galerie, pas par entrée, pour garantir max 1 match par carte.
    // Index inversé entry_id → set pour marquer les cartes dont l'entrée est déjà en base
    const existingSetIds = new Set<number>()
    for (const e of allEntries) { if (existingEntryIds.has(e.id)) existingSetIds.add(e.id) }

    const matchedGalleryIdx = new Set<number>()
    const newRows: { user_id: string; entry_id: number; manually_checked: boolean }[] = []

    // Index des entrées par nom de joueur normalisé pour accès rapide
    const entriesByPlayer = new Map<string, typeof allEntries>()
    for (const e of allEntries) {
      const key = norm(e.player_name)
      if (!entriesByPlayer.has(key)) entriesByPlayer.set(key, [])
      entriesByPlayer.get(key)!.push(e)
    }

    for (let gi = 0; gi < galleryCards.length; gi++) {
      const card = galleryCards[gi]
      const coll = (card.collection || card.collection_tag || '').trim()
      if (!coll) continue  // collection obligatoire

      const playerEntries = entriesByPlayer.get(norm(card.nom)) || []
      if (!playerEntries.length) continue

      // Si une entrée de ce joueur est déjà placée en DB → carte considérée comme matchée
      if (playerEntries.some(e => existingEntryIds.has(e.id))) {
        matchedGalleryIdx.add(gi)
        continue
      }

      const uw = collWords(coll)
      if (!uw.length) continue

      // Trouver toutes les entrées candidates pour cette carte
      const candidates: { entryId: number; extraWords: number }[] = []

      for (const e of playerEntries) {
        const set = setsMap.get(e.set_id)
        if (!set?.year) continue
        const y = set.year, ys = String(y), yn = `${y}-${String(y+1).slice(2)}`, yp = `${y-1}-${ys.slice(2)}`

        const cy = (card.annee || '').trim()
        if (!cy) continue
        // Formats acceptés : "2024", "2024-25", "2024-2025", "2023-24" (prev season)
        const yn2 = `${y}-${y+1}`
        if (cy !== ys && cy !== yn && cy !== yp && cy !== yn2 && cy !== `${y-1}-${y}`) continue

        // La collection doit matcher le nom du set
        if (!uw.some(w => norm(set.name).includes(w))) continue

        // Brand optionnel — avec résolution des sous-marques (Hoops→Panini, Flagship→Topps…)
        if (card.marque && set.brand) {
          const nb = normBrand(card.marque), ns = normBrand(set.brand)
          if (!nb.includes(ns) && !ns.includes(nb)) continue
        }

        // Variation : base↔base = parfait ; carte a variation mais entrée n'en a pas = match faible
        // (gap de scraping) ; entrée a variation mais carte n'en a pas = impossible
        const cv = (card.variation || '').trim(), ev = (e.variation || '').trim()
        let varScore = 0
        if (!cv && !ev) {
          varScore = 0
        } else if (!cv && ev) {
          continue  // carte base ne peut pas matcher un insert
        } else if (cv && !ev) {
          varScore = 1  // insert dont la variation n'a pas été scrapée → match faible
        } else {
          const varOk = norm(cv).includes(norm(ev)) || norm(ev).includes(norm(cv)) || words(cv).some(w => norm(ev).includes(w))
          if (!varOk) continue
          varScore = 0
        }

        // Score : mots extra dans le set + mots manquants + pénalité variation
        // Bonus -1 si card_number correspond (renforce la correspondance exacte)
        const sn = norm(set.name)
        const extraWords = words(set.name).filter(w => !uw.includes(w) && w.length > 3).length
        const missedWords = uw.filter(w => w.length > 3 && !sn.includes(w)).length
        const cn = (card.card_number || '').trim(), en = (e.card_number || '').trim()
        const cardNumBonus = cn && en && norm(cn) === norm(en) ? -1 : 0
        candidates.push({ entryId: e.id, extraWords: extraWords + missedWords + varScore + cardNumBonus })
      }

      if (!candidates.length) continue

      // Garder uniquement l'entrée du set le plus précis (le moins de mots extra)
      candidates.sort((a, b) => a.extraWords - b.extraWords)
      const best = candidates[0]

      matchedGalleryIdx.add(gi)
      if (!best.entryId) continue
      if (existingEntryIds.has(best.entryId)) continue  // déjà placée, on ne touche pas
      newRows.push({ user_id: userId, entry_id: best.entryId, manually_checked: false })
    }
    setSyncProgress(88)

    // 6. Cartes galerie NON placées : on construit pour chacune les setlists candidats
    // (même joueur + même année), pour permettre un placement manuel via menu déroulant.
    const yearMatchesSet = (cardYear: string, setYear: number | null) => {
      if (!setYear) return false
      const ys = String(setYear), yn = `${setYear}-${String(setYear+1).slice(2)}`, yp = `${setYear-1}-${ys.slice(2)}`
      const cy = (cardYear || '').trim()
      return cy === ys || cy === yn || cy === yp
    }

    const unmatched: UnmatchedCard[] = []
    for (let gi = 0; gi < galleryCards.length; gi++) {
      if (matchedGalleryIdx.has(gi)) continue
      const card = galleryCards[gi]
      const playerEntries = entriesByPlayer.get(norm(card.nom)) || []
      const coll = (card.collection || card.collection_tag || '').trim()
      const uw = collWords(coll)

      // Une entrée par set (on garde celle dont la variation colle le mieux)
      const bySet = new Map<number, { entryId: number; varMatch: boolean }>()
      for (const e of playerEntries) {
        const set = setsMap.get(e.set_id)
        if (!set) continue
        if (!yearMatchesSet(card.annee, set.year)) continue
        const cv = (card.variation || '').trim(), ev = (e.variation || '').trim()
        const varMatch = !cv ? !ev : !!ev && (norm(cv).includes(norm(ev)) || norm(ev).includes(norm(cv)) || words(cv).some(w => norm(ev).includes(w)))
        const prev = bySet.get(e.set_id)
        // priorité : entrée dont la variation matche, sinon entrée de base (ev vide), sinon la première
        if (!prev || (varMatch && !prev.varMatch) || (!ev && !prev.varMatch)) {
          bySet.set(e.set_id, { entryId: e.id, varMatch })
        }
      }

      const candidates: SetCandidate[] = [...bySet.entries()].map(([setId, v]) => {
        const set = setsMap.get(setId)!
        return { setId, setName: set.name, setYear: set.year, entryId: v.entryId }
      })

      // Tri : sets dont le nom contient un mot de la collection en premier, puis alphabétique
      candidates.sort((a, b) => {
        const am = uw.some(w => norm(a.setName).includes(w)) ? 0 : 1
        const bm = uw.some(w => norm(b.setName).includes(w)) ? 0 : 1
        if (am !== bm) return am - bm
        return a.setName.localeCompare(b.setName)
      })

      unmatched.push({ ...card, candidates })
    }
    // Filtrer les cartes déjà ignorées par l'utilisateur
    const dismissed = getDismissed()
    const filteredUnmatched = unmatched.filter(c => !dismissed.has(cardFingerprint(c)))
    setUnmatchedCards(filteredUnmatched)
    saveUnmatched(filteredUnmatched)

    // 7. Sauvegarde des nouveaux matches
    for (let i = 0; i < newRows.length; i += 500)
      await supabase.from('user_set_completion').upsert(newRows.slice(i, i + 500), { onConflict: 'user_id,entry_id', ignoreDuplicates: true })

    setSyncProgress(100)
    setNewMatchCount(newRows.length)
    setSyncDone(true)
    setSyncing(false)
    await fetchAndCacheSets(false)
  }

  // Placer manuellement une carte non placée dans un setlist choisi
  const placeCard = async (cardIdx: number, entryId: number) => {
    if (!userId) return
    setPlacingIdx(cardIdx)
    const { error } = await supabase.from('user_set_completion')
      .upsert({ user_id: userId, entry_id: entryId, manually_checked: true }, { onConflict: 'user_id,entry_id' })
    if (!error) {
      const updated = unmatchedCards.filter((_, i) => i !== cardIdx)
      setUnmatchedCards(updated)
      saveUnmatched(updated)
      await fetchAndCacheSets(false)
    }
    setPlacingIdx(null)
  }


  // Saisons disponibles (triées desc)
  const seasons = Array.from(new Set(sets.map(s => s.year).filter(Boolean) as number[])).sort((a, b) => b - a)
  const seasonSets = sets.filter(s => s.year === activeSeason).sort((a, b) => a.name.localeCompare(b.name))

  // Navigation par décennie
  const decades = Array.from(new Set(seasons.map(y => Math.floor(y / 10) * 10))).sort((a, b) => b - a)
  const resolvedDecade = activeDecade ?? (seasons.length ? Math.floor(seasons[0] / 10) * 10 : null)
  const decadeSeasons = resolvedDecade !== null ? seasons.filter(y => Math.floor(y / 10) * 10 === resolvedDecade) : []

  const totalOwned = seasonSets.reduce((acc, s) => acc + (s.owned || 0), 0)
  const totalCards = seasonSets.reduce((acc, s) => acc + s.total_cards, 0)
  const seasonPct = totalCards > 0 ? Math.round((totalOwned / totalCards) * 100) : 0
  const totalOwnedAllSets = sets.reduce((a, s) => a + (s.owned || 0), 0)
  const setsWithCards = sets.filter(s => (s.owned || 0) > 0).length

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 20px' }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontWeight: 900, fontSize: 32, marginBottom: 4 }}>Setlist NBA</h1>
          <p style={{ color: '#888', fontSize: 15 }}>{loading ? '...' : `${sets.length} collections disponibles`}</p>
        </div>
        {userId && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
            <button
              onClick={syncAll}
              disabled={syncing}
              style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: syncing ? '#ccc' : '#003DA6', color: syncing ? '#666' : 'white', fontWeight: 800, fontSize: 14, cursor: syncing ? 'default' : 'pointer' }}
            >
              {syncing ? `Synchronisation... ${syncProgress}%` : '🔄 Synchroniser ma galerie'}
            </button>
            {syncing && (
              <div style={{ width: 240, height: 6, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${syncProgress}%`, background: '#003DA6', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            )}
            {/* Stats toujours visibles dès que les sets sont chargés */}
            {!loading && (
              <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '12px 18px', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
                {syncDone && (
                  <div style={{ fontWeight: 800, color: '#2ecc71', marginBottom: 2 }}>
                    ✅ {newMatchCount} nouvelle{newMatchCount !== 1 ? 's' : ''} carte{newMatchCount !== 1 ? 's' : ''} cochée{newMatchCount !== 1 ? 's' : ''}
                  </div>
                )}
                <div style={{ fontWeight: 700, color: '#003DA6' }}>
                  {totalOwnedAllSets.toLocaleString()} cartes validées
                </div>
                <div style={{ color: '#666', fontSize: 13 }}>
                  dans {setsWithCards} setlist{setsWithCards !== 1 ? 's' : ''}
                </div>
                <button
                  onClick={async () => {
                    // Retire du localStorage les cartes déjà placées manuellement depuis la dernière synchro
                    if (userId && unmatchedCards.length > 0) {
                      const { data: placed } = await supabase
                        .from('user_set_completion')
                        .select('entry_id')
                        .eq('user_id', userId)
                      if (placed?.length) {
                        const placedIds = new Set(placed.map((r: any) => r.entry_id))
                        const stillUnmatched = unmatchedCards.filter(c =>
                          !c.candidates?.some((cd: any) => placedIds.has(cd.entryId))
                        )
                        if (stillUnmatched.length !== unmatchedCards.length) {
                          setUnmatchedCards(stillUnmatched)
                          saveUnmatched(stillUnmatched)
                        }
                      }
                    }
                    setShowMissing(true)
                  }}
                  style={{ marginTop: 4, padding: '7px 14px', borderRadius: 8, border: '1.5px solid #003DA6', background: 'white', color: '#003DA6', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  {syncDone ? `Voir les cartes non placées (${unmatchedCards.length})` : 'Voir les cartes non placées →'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal cartes galerie non placées */}
      {showMissing && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowMissing(false)}
        >
          <div
            style={{ background: 'white', borderRadius: 18, padding: '28px 24px', maxWidth: 620, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>
                Cartes non placées dans un setlist
              </h2>
              <button onClick={() => setShowMissing(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>✕</button>
            </div>
            {!syncDone && unmatchedCards.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#888', padding: '30px 0' }}>
                Lance une synchronisation pour voir quelles cartes de ta galerie ne sont pas dans un setlist.
              </div>
            ) : unmatchedCards.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#2ecc71', fontWeight: 700, padding: '30px 0', fontSize: 16 }}>
                Toutes tes cartes sont placées dans un setlist 🎉
              </div>
            ) : (
              <>
                <p style={{ color: '#888', fontSize: 13, marginBottom: 16 }}>
                  {unmatchedCards.length} carte{unmatchedCards.length !== 1 ? 's' : ''} sans correspondance. Choisis un setlist pour la placer.
                </p>
                {/* Ajout manuel d'une carte non trouvée */}
                <div style={{ marginBottom: 16 }}>
                  {!showAddManual ? (
                    <button
                      onClick={() => setShowAddManual(true)}
                      style={{ fontSize: 13, padding: '7px 14px', borderRadius: 8, border: '1.5px dashed #ccc', background: 'white', color: '#888', cursor: 'pointer', width: '100%' }}
                    >
                      + Ajouter une carte manuellement
                    </button>
                  ) : (
                    <div style={{ background: '#f8f8f8', borderRadius: 10, padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                        {(['nom', 'annee', 'marque', 'collection', 'variation'] as const).map(f => (
                          <input
                            key={f}
                            placeholder={{ nom: 'Joueur *', annee: 'Année (ex: 2024-25)', marque: 'Marque', collection: 'Collection', variation: 'Variation' }[f]}
                            value={manualForm[f]}
                            onChange={e => setManualForm(p => ({ ...p, [f]: e.target.value }))}
                            style={{ fontSize: 12, padding: '7px 10px', borderRadius: 7, border: '1px solid #ddd', gridColumn: f === 'nom' ? '1 / -1' : undefined }}
                          />
                        ))}
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          disabled={!manualForm.nom.trim()}
                          onClick={() => {
                            const card: UnmatchedCard = { nom: manualForm.nom.trim(), annee: manualForm.annee.trim(), marque: manualForm.marque.trim(), collection: manualForm.collection.trim(), collection_tag: '', variation: manualForm.variation.trim(), candidates: [] }
                            const fp = cardFingerprint(card)
                            const dismissed = getDismissed()
                            dismissed.delete(fp)
                            saveDismissed(dismissed)
                            const updated = [card, ...unmatchedCards]
                            setUnmatchedCards(updated)
                            saveUnmatched(updated)
                            setManualForm({ nom: '', annee: '', marque: '', collection: '', variation: '' })
                            setShowAddManual(false)
                          }}
                          style={{ flex: 1, fontSize: 13, padding: '8px', borderRadius: 8, border: 'none', background: manualForm.nom.trim() ? '#003DA6' : '#ccc', color: 'white', fontWeight: 700, cursor: manualForm.nom.trim() ? 'pointer' : 'default' }}
                        >
                          Ajouter
                        </button>
                        <button onClick={() => setShowAddManual(false)} style={{ fontSize: 13, padding: '8px 12px', borderRadius: 8, border: '1px solid #ccc', background: 'white', cursor: 'pointer', color: '#888' }}>Annuler</button>
                      </div>
                    </div>
                  )}
                </div>
                {unmatchedCards.map((card, i) => (
                  <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 180 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>
                        {card.nom || '—'}
                        {card.variation && <span style={{ fontWeight: 400, color: '#888', marginLeft: 6 }}>{card.variation}</span>}
                      </div>
                      <div style={{ fontSize: 12, color: '#aaa', marginTop: 2 }}>
                        {[card.annee, card.marque, card.collection].filter(Boolean).join(' · ')}
                      </div>
                    </div>
                    {placingIdx === i ? (
                      <span style={{ fontSize: 12, color: '#003DA6', fontWeight: 700 }}>Placement...</span>
                    ) : card.candidates && card.candidates.length > 0 && gotoPickerIdx !== i ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                        <select
                          defaultValue=""
                          onChange={e => { const v = Number(e.target.value); if (v) placeCard(i, v) }}
                          style={{ fontSize: 13, padding: '7px 10px', borderRadius: 8, border: '1.5px solid #003DA6', color: '#003DA6', fontWeight: 600, background: 'white', cursor: 'pointer', maxWidth: 160 }}
                        >
                          <option value="">Placer dans… ({card.candidates.length})</option>
                          {card.candidates.map(c => (
                            <option key={c.entryId} value={c.entryId}>{c.setName}</option>
                          ))}
                        </select>
                        <button
                          onClick={() => { setGotoPickerIdx(i); setGotoSetId('') }}
                          title="Choisir un autre set"
                          style={{ fontSize: 11, padding: '5px 8px', borderRadius: 6, border: '1px solid #ccc', background: 'white', cursor: 'pointer', color: '#888', whiteSpace: 'nowrap' }}
                        >
                          Autre
                        </button>
                        <button
                          onClick={() => dismissCard(i)}
                          title="Marquer comme traité"
                          style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700, background: '#f0fdf4', border: '1.5px solid #2ecc71', borderRadius: 6, padding: '4px 7px', cursor: 'pointer' }}
                        >
                          ✓
                        </button>
                      </div>
                    ) : gotoPickerIdx === i ? (
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                        <select
                          value={gotoSetId}
                          onChange={e => setGotoSetId(e.target.value)}
                          style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1.5px solid #888', maxWidth: 160 }}
                        >
                          <option value="">Choisir un set…</option>
                          {sets
                            .filter(s => gotoAllSets || !card.annee || String(s.year) === card.annee || `${s.year}-${String((s.year||0)+1).slice(2)}` === card.annee)
                            .sort((a, b) => (b.year || 0) - (a.year || 0) || a.name.localeCompare(b.name))
                            .map(s => <option key={s.id} value={s.id}>{s.name}</option>)
                          }
                        </select>
                        <button
                          onClick={() => { setGotoAllSets(v => !v); setGotoSetId('') }}
                          style={{ fontSize: 11, padding: '5px 7px', borderRadius: 6, border: '1px solid #ccc', background: gotoAllSets ? '#eee' : 'white', cursor: 'pointer', color: '#666' }}
                        >
                          {gotoAllSets ? 'Filtrés' : 'Tous'}
                        </button>
                        {gotoSetId && (
                          <Link href={`/setlist/${gotoSetId}`} onClick={() => setShowMissing(false)} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 8, background: '#003DA6', color: 'white', fontWeight: 700, textDecoration: 'none' }}>
                            Voir →
                          </Link>
                        )}
                        <button onClick={() => setGotoPickerIdx(null)} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 8, border: '1px solid #ccc', background: 'white', cursor: 'pointer', color: '#888' }}>✕</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <button
                          onClick={() => { setGotoPickerIdx(i); setGotoSetId('') }}
                          style={{ fontSize: 11, color: '#555', fontWeight: 700, background: '#f5f5f5', border: '1.5px solid #ddd', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          Voir le set
                        </button>
                        <button
                          onClick={() => dismissCard(i)}
                          title="Marquer comme traité"
                          style={{ fontSize: 11, color: '#2ecc71', fontWeight: 700, background: '#f0fdf4', border: '1.5px solid #2ecc71', borderRadius: 6, padding: '4px 9px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                        >
                          ✓ Fait
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation décennie → saison */}
      {!loading && (
        <div style={{ marginBottom: 32 }}>
          {/* Onglets décennie */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, borderBottom: '2px solid #f0f0f0', paddingBottom: 0 }}>
            {decades.map(decade => {
              const isAct = resolvedDecade === decade
              const label = `${String(decade).slice(2)}s`
              return (
                <button
                  key={decade}
                  onClick={() => {
                    setActiveDecade(decade)
                    const first = seasons.find(y => Math.floor(y / 10) * 10 === decade)
                    if (first) setActiveSeason(first)
                  }}
                  style={{
                    padding: '10px 22px', border: 'none', background: 'none', cursor: 'pointer',
                    fontWeight: 800, fontSize: 16, color: isAct ? '#003DA6' : '#aaa',
                    borderBottom: isAct ? '3px solid #003DA6' : '3px solid transparent',
                    marginBottom: -2, transition: 'all 0.15s',
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Boutons d'années dans la décennie */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', paddingTop: 8 }}>
            {decadeSeasons.map(year => {
              const isActive = activeSeason === year
              const ssets = sets.filter(s => s.year === year)
              const sOwned = ssets.reduce((a, s) => a + (s.owned || 0), 0)
              const sTotal = ssets.reduce((a, s) => a + s.total_cards, 0)
              const sPct = sTotal > 0 ? Math.round((sOwned / sTotal) * 100) : 0
              return (
                <button key={year} onClick={() => setActiveSeason(year)} style={{
                  padding: '10px 18px', borderRadius: 12, border: '2px solid',
                  borderColor: isActive ? '#003DA6' : '#e0e0e0',
                  background: isActive ? '#003DA6' : 'white',
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
                  minWidth: 80,
                }}>
                  <span style={{ fontSize: 15, fontWeight: 900, color: isActive ? 'white' : '#111' }}>
                    {seasonLabel(year)}
                  </span>
                  <span style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.7)' : '#aaa', fontWeight: 600 }}>
                    {ssets.length} sets
                  </span>
                  {userId && sPct > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: isActive ? '#7eb8ff' : '#003DA6' }}>
                      {sPct}%
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Header de la saison active */}
      {activeSeason && !loading && (
        <div style={{ marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <span style={{ fontWeight: 900, fontSize: 20, color: '#111' }}>Saison {seasonLabel(activeSeason)}</span>
            <span style={{ color: '#aaa', fontSize: 14, marginLeft: 10 }}>{seasonSets.length} collections · {totalCards.toLocaleString()} cartes</span>
          </div>
          {userId && totalCards > 0 && (
            <span style={{ fontWeight: 900, fontSize: 16, color: seasonPct === 100 ? '#2ecc71' : '#003DA6' }}>{seasonPct}% complété</span>
          )}
        </div>
      )}

      {/* Grille des sets */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Chargement...</div>
      ) : seasonSets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#888' }}>Aucune collection pour cette saison.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {seasonSets.map(set => (
            <Link key={set.id} href={`/setlist/${set.id}`} style={{ textDecoration: 'none' }}>
              <div
                style={{ background: 'white', borderRadius: 14, padding: '18px 20px', border: '1.5px solid #f0f0f0', cursor: 'pointer', transition: 'box-shadow 0.15s, border-color 0.15s', height: '100%', boxSizing: 'border-box' }}
                onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 18px rgba(0,0,0,0.10)'; (e.currentTarget as HTMLDivElement).style.borderColor = '#003DA6' }}
                onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; (e.currentTarget as HTMLDivElement).style.borderColor = '#f0f0f0' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ fontWeight: 800, fontSize: 15, color: '#111', lineHeight: 1.3, flex: 1, marginRight: 8 }}>
                    {set.name}
                  </div>
                  {set.pct !== undefined && set.pct > 0 && (
                    <span style={{ fontSize: 14, fontWeight: 900, color: set.pct === 100 ? '#2ecc71' : '#003DA6', whiteSpace: 'nowrap' }}>
                      {set.pct}%
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                  {set.brand && (
                    <span style={{ fontSize: 11, color: '#003DA6', fontWeight: 700, background: '#f0f4ff', borderRadius: 4, padding: '2px 7px' }}>
                      {set.brand}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#aaa' }}>{set.total_cards.toLocaleString()} cartes</span>
                </div>
                {userId && (
                  <>
                    <CompletionBar pct={set.pct || 0} />
                    <div style={{ fontSize: 11, color: '#999', marginTop: 4 }}>
                      {(set.owned || 0).toLocaleString()} / {set.total_cards.toLocaleString()} possédées
                    </div>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
