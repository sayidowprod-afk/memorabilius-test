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
  const [activeSeason, setActiveSeason] = useState<number | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(0)
  const [syncStats, setSyncStats] = useState<{ newMatches: number; total: number } | null>(null)
  const [showMissing, setShowMissing] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id || null))
  }, [])

  const loadSets = useCallback(async () => {
    setLoading(true)
    const { data: setsData } = await supabase
      .from('card_sets')
      .select('id, tcdb_id, name, year, brand, sport, total_cards')
      .eq('sport', 'nba')
      .order('year', { ascending: false })

    if (!setsData) { setLoading(false); return }

    if (!userId) {
      setSets(setsData.map(s => ({ ...s, owned: 0, pct: 0 })))
      // Sélectionner la saison la plus récente par défaut
      const mostRecent = setsData[0]?.year
      if (mostRecent) setActiveSeason(mostRecent)
      setLoading(false)
      return
    }

    const { data: completions } = await supabase
      .from('user_set_completion')
      .select('entry_id, card_set_entries(set_id)')
      .eq('user_id', userId)

    const countBySet = new Map<number, number>()
    completions?.forEach((c: any) => {
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
    if (mostRecent) setActiveSeason(mostRecent)
    setLoading(false)
  }, [userId])

  useEffect(() => { loadSets() }, [loadSets])

  const syncAll = async () => {
    if (!userId) return
    setSyncing(true); setSyncProgress(0); setSyncStats(null)
    const norm = (s: string) => s?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
    const words = (s: string) => s?.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 2) || []

    // 1. Galerie (manuelles + CSV)
    const { data: gc } = await supabase.from('cartes_manuelles').select('nom, annee, marque, collection, collection_tag, variation').eq('user_id', userId)
    let galleryCards: any[] = gc || []
    const { data: prof } = await supabase.from('profiles').select('lien_csv').eq('id', userId).single()
    if (prof?.lien_csv) {
      try {
        const r = await fetch(prof.lien_csv + '&t=' + Date.now(), { signal: AbortSignal.timeout(8000) })
        const txt = await r.text()
        const csvCards = txt.split(/\r?\n/).slice(4).map(row => {
          const c = row.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/)
          if (!c[0]?.includes('http')) return null
          return { nom: c[2]?.trim() || '', annee: c[4]?.trim() || '', marque: c[5]?.trim() || '', collection: c[6]?.trim() || '', collection_tag: '', variation: c[7]?.trim() || '' }
        }).filter(Boolean)
        galleryCards = [...galleryCards, ...csvCards]
      } catch {}
    }
    if (!galleryCards.length) { setSyncing(false); return }
    setSyncProgress(10)

    // 2. Tous les sets
    const { data: allSetsData } = await supabase.from('card_sets').select('id, name, year, brand').eq('sport', 'nba')
    const setsMap = new Map((allSetsData || []).map(s => [s.id, s]))
    setSyncProgress(15)

    // 3. Entrées pour nos joueurs (par chunks de noms)
    const uniquePlayers = [...new Set(galleryCards.map((c: any) => c.nom as string).filter(Boolean))]
    const allEntries: { id: number; player_name: string; variation: string | null; set_id: number }[] = []
    const PCHUNK = 30
    for (let ci = 0; ci < uniquePlayers.length; ci += PCHUNK) {
      setSyncProgress(15 + Math.round((ci / uniquePlayers.length) * 55))
      const batch = uniquePlayers.slice(ci, ci + PCHUNK)
      let from = 0
      for (;;) {
        const { data: page } = await supabase.from('card_set_entries').select('id, player_name, variation, set_id').in('player_name', batch).range(from, from + 999)
        if (!page?.length) break
        allEntries.push(...page)
        if (page.length < 1000) break
        from += 1000
      }
    }
    setSyncProgress(70)

    // 4. Completions existantes (pour ne pas écraser)
    const existing = new Set<number>()
    for (let i = 0; i < allEntries.length; i += 500) {
      const { data: chunk } = await supabase.from('user_set_completion').select('entry_id').eq('user_id', userId).in('entry_id', allEntries.slice(i, i + 500).map(e => e.id))
      chunk?.forEach((c: any) => existing.add(c.entry_id))
    }
    setSyncProgress(80)

    // 5. Matching
    const newRows: { user_id: string; entry_id: number; manually_checked: boolean }[] = []
    for (const e of allEntries) {
      if (existing.has(e.id)) continue
      const set = setsMap.get(e.set_id)
      if (!set?.year) continue
      const y = set.year, ys = String(y), yn = `${y}-${String(y+1).slice(2)}`, yp = `${y-1}-${ys.slice(2)}`
      const matched = galleryCards.some((card: any) => {
        if (norm(card.nom) !== norm(e.player_name)) return false
        const cy = (card.annee || '').trim()
        if (cy !== ys && cy !== yn && cy !== yp) return false
        if (set.brand && card.marque) { const nb = norm(card.marque), ns = norm(set.brand); if (!nb.includes(ns) && !ns.includes(nb)) return false }
        const coll = card.collection || card.collection_tag || ''
        if (coll) { const uw = words(coll); if (uw.length > 0 && !uw.some((w: string) => norm(set.name).includes(w))) return false }
        const cv = (card.variation || '').trim(), ev = (e.variation || '').trim()
        if (!cv) return !ev
        if (!ev) return false
        const nc = norm(cv), ne = norm(ev)
        return nc.includes(ne) || ne.includes(nc) || words(cv).some((w: string) => ne.includes(w))
      })
      if (matched) newRows.push({ user_id: userId, entry_id: e.id, manually_checked: false })
    }
    setSyncProgress(90)

    // 6. Sauvegarde
    for (let i = 0; i < newRows.length; i += 500)
      await supabase.from('user_set_completion').upsert(newRows.slice(i, i+500), { onConflict: 'user_id,entry_id', ignoreDuplicates: true })

    setSyncProgress(100)
    await loadSets()
    const totalOwned2 = sets.reduce((a, s) => a + (s.owned || 0), 0) + newRows.length
    setSyncStats({ newMatches: newRows.length, total: totalOwned2 })
    setSyncing(false)
  }

  // Saisons disponibles (triées desc)
  const seasons = Array.from(new Set(sets.map(s => s.year).filter(Boolean) as number[])).sort((a, b) => b - a)
  const seasonSets = sets.filter(s => s.year === activeSeason).sort((a, b) => a.name.localeCompare(b.name))

  const totalOwned = seasonSets.reduce((acc, s) => acc + (s.owned || 0), 0)
  const totalCards = seasonSets.reduce((acc, s) => acc + s.total_cards, 0)
  const seasonPct = totalCards > 0 ? Math.round((totalOwned / totalCards) * 100) : 0

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
              style={{ padding: '11px 22px', borderRadius: 12, border: 'none', background: syncing ? '#e0e0e0' : '#003DA6', color: syncing ? '#999' : 'white', fontWeight: 800, fontSize: 14, cursor: syncing ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
            >
              {syncing ? `Synchronisation... ${syncProgress}%` : '🔄 Synchroniser ma galerie'}
            </button>
            {syncing && (
              <div style={{ width: 240, height: 6, borderRadius: 3, background: '#f0f0f0', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${syncProgress}%`, background: '#003DA6', borderRadius: 3, transition: 'width 0.3s' }} />
              </div>
            )}
            {syncStats && !syncing && (
              <div style={{ background: '#f0f4ff', borderRadius: 12, padding: '12px 18px', fontSize: 14, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 240 }}>
                <div style={{ fontWeight: 800, color: '#003DA6' }}>
                  ✅ {syncStats.newMatches} nouvelle{syncStats.newMatches !== 1 ? 's' : ''} carte{syncStats.newMatches !== 1 ? 's' : ''} cochée{syncStats.newMatches !== 1 ? 's' : ''}
                </div>
                <div style={{ color: '#555', fontSize: 13 }}>
                  {sets.reduce((a,s) => a+(s.owned||0), 0).toLocaleString()} cartes validées au total dans {sets.filter(s => (s.owned||0) > 0).length} setlists
                </div>
                <button
                  onClick={() => setShowMissing(true)}
                  style={{ marginTop: 4, padding: '7px 14px', borderRadius: 8, border: '1.5px solid #003DA6', background: 'white', color: '#003DA6', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}
                >
                  Voir les cartes manquantes →
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Boutons de saison */}
      {!loading && (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 32 }}>
          {seasons.map(year => {
            const isActive = activeSeason === year
            const ssets = sets.filter(s => s.year === year)
            const sOwned = ssets.reduce((a, s) => a + (s.owned || 0), 0)
            const sTotal = ssets.reduce((a, s) => a + s.total_cards, 0)
            const sPct = sTotal > 0 ? Math.round((sOwned / sTotal) * 100) : 0
            return (
              <button key={year} onClick={() => setActiveSeason(year)} style={{
                padding: '14px 22px', borderRadius: 14, border: '2.5px solid',
                borderColor: isActive ? '#003DA6' : '#e0e0e0',
                background: isActive ? '#003DA6' : 'white',
                cursor: 'pointer', transition: 'all 0.15s',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                minWidth: 90,
              }}>
                <span style={{ fontSize: 17, fontWeight: 900, color: isActive ? 'white' : '#111' }}>
                  {seasonLabel(year)}
                </span>
                <span style={{ fontSize: 11, color: isActive ? 'rgba(255,255,255,0.75)' : '#aaa', fontWeight: 600 }}>
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

      {/* Modal cartes manquantes */}
      {showMissing && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={() => setShowMissing(false)}>
          <div style={{ background: 'white', borderRadius: 18, padding: '28px 24px', maxWidth: 600, width: '100%', maxHeight: '80vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 900, fontSize: 20, margin: 0 }}>Cartes manquantes par setlist</h2>
              <button onClick={() => setShowMissing(false)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: '#aaa' }}>✕</button>
            </div>
            {sets.filter(s => (s.owned || 0) > 0 && (s.owned || 0) < s.total_cards).sort((a, b) => (a.pct || 0) - (b.pct || 0)).map(s => {
              const missing = s.total_cards - (s.owned || 0)
              return (
                <a key={s.id} href={`/setlist/${s.id}`} style={{ textDecoration: 'none', display: 'block', padding: '12px 0', borderBottom: '1px solid #f0f0f0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: '#111' }}>{s.name}</div>
                      <div style={{ fontSize: 12, color: '#aaa' }}>{s.year} · {s.brand}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 800, color: '#e74c3c', fontSize: 14 }}>{missing} manquante{missing !== 1 ? 's' : ''}</div>
                      <div style={{ fontSize: 12, color: '#aaa' }}>{s.owned}/{s.total_cards}</div>
                    </div>
                  </div>
                </a>
              )
            })}
            {sets.filter(s => (s.owned || 0) > 0 && (s.owned || 0) < s.total_cards).length === 0 && (
              <div style={{ textAlign: 'center', color: '#888', padding: 30 }}>Aucune setlist en cours 🎉</div>
            )}
          </div>
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
