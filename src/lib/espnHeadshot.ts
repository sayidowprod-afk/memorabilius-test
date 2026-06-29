// ── NBA CDN (tous les joueurs, actifs + retraités) ────────────────────────────
// stats.nba.com peut être bloqué en dev local mais fonctionne sur Vercel

let nbaMapCache: Map<string, number> | null = null
let nbaMapExpiry = 0

async function getNbaPlayerMap(): Promise<Map<string, number>> {
  if (nbaMapCache && Date.now() < nbaMapExpiry) return nbaMapCache
  try {
    const r = await fetch(
      'https://stats.nba.com/stats/commonallplayers?LeagueID=00&Season=2024-25&IsOnlyCurrentSeason=0',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.nba.com/',
          'Accept': 'application/json, text/plain, */*',
          'Accept-Language': 'en-US,en;q=0.9',
          'x-nba-stats-origin': 'stats',
          'x-nba-stats-token': 'true',
        },
        signal: AbortSignal.timeout(2500),
        next: { revalidate: 86400 },
      } as RequestInit
    )
    if (!r.ok) return nbaMapCache ?? new Map()
    const data = await r.json()
    const rows: any[][] = data?.resultSets?.[0]?.rowSet ?? []
    const map = new Map<string, number>()
    for (const row of rows) {
      const id: number = row[0]
      const name: string = row[2] // DISPLAY_FIRST_LAST e.g. "Michael Jordan"
      if (id && name) map.set(name.toLowerCase(), id)
    }
    nbaMapCache = map
    nbaMapExpiry = Date.now() + 86400_000
    return map
  } catch {
    return nbaMapCache ?? new Map()
  }
}

async function fetchNbaHeadshot(name: string): Promise<string | null> {
  const map = await getNbaPlayerMap()
  if (map.size === 0) return null
  const lower = name.toLowerCase()
  let id = map.get(lower)
  if (!id) {
    for (const [k, v] of map) {
      if (k.includes(lower) || lower.includes(k)) { id = v; break }
    }
  }
  if (!id) return null
  return `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`
}

// ── ESPN search/v2 (fallback pour sports non-NBA et joueurs non matchés) ──────
const SPORT_MAP: Record<string, string> = {
  nba: 'basketball', nfl: 'football', nhl: 'hockey', mlb: 'baseball', football: 'soccer',
}

async function fetchEspnMap(query: string, sport = 'nba'): Promise<Map<string, string>> {
  const espnSport = SPORT_MAP[sport] || 'basketball'
  const result = new Map<string, string>()
  try {
    const url = `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&limit=20&type=player&sport=${espnSport}`
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit)
    if (!r.ok) return result
    const data = await r.json()
    for (const section of data.results ?? []) {
      for (const a of section.contents ?? []) {
        const photo: string | undefined = a.image?.default
        if (a.displayName && photo) result.set((a.displayName as string).toLowerCase(), photo)
      }
    }
  } catch { /* ESPN unavailable */ }
  return result
}

// ── API publique ───────────────────────────────────────────────────────────────

export async function fetchEspnHeadshots(
  query: string,
  sport = 'nba'
): Promise<Map<string, string>> {
  if (sport === 'nba') {
    // NBA: essaie le CDN NBA d'abord (couvre actifs + retraités), ESPN en complément
    const [nbaMap, espnMap] = await Promise.all([
      // on appelle getNbaPlayerMap() puis on filtre par query pour ne pas tout parcourir
      (async () => {
        const map = await getNbaPlayerMap()
        const result = new Map<string, string>()
        const q = query.toLowerCase()
        for (const [name, id] of map) {
          if (name.includes(q) || q.includes(name.split(' ')[0])) {
            result.set(name, `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`)
          }
        }
        return result
      })(),
      fetchEspnMap(query, sport),
    ])
    // merge: NBA CDN prioritaire
    const merged = new Map(espnMap)
    for (const [k, v] of nbaMap) merged.set(k, v)
    return merged
  }
  return fetchEspnMap(query, sport)
}

export async function fetchEspnHeadshot(name: string, sport = 'nba'): Promise<string | null> {
  if (sport === 'nba') {
    const nba = await fetchNbaHeadshot(name)
    if (nba) return nba
  }
  const map = await fetchEspnMap(name, sport)
  const lower = name.toLowerCase()
  // Exact match d'abord, puis commence-par, puis contient
  return (
    map.get(lower) ??
    [...map.entries()].find(([k]) => k === lower)?.[1] ??
    [...map.entries()].find(([k]) => k.startsWith(lower) || lower.startsWith(k))?.[1] ??
    null
  )
}
