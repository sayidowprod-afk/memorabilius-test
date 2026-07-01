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

// Normalise pour comparaison insensible aux accents, ponctuation et casse
// "O.G. Anunoby" → "og anunoby" | "Nikola Jokić" → "nikola jokic"
function norm(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

async function fetchEspnMap(query: string, sport = 'nba'): Promise<Map<string, string>> {
  const espnSport = SPORT_MAP[sport] || 'basketball'
  // Map double : clé exacte lowercase ET clé normalisée → même URL
  const result = new Map<string, string>()
  try {
    const url = `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(query)}&limit=20&type=player&sport=${espnSport}`
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit)
    if (!r.ok) return result
    const data = await r.json()
    for (const section of data.results ?? []) {
      for (const a of section.contents ?? []) {
        const photo: string | undefined = a.image?.default
        if (a.displayName && photo) {
          const name = a.displayName as string
          result.set(name.toLowerCase(), photo)
          result.set(norm(name), photo) // clé normalisée en plus
        }
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
    // ESPN d'abord — headshots corrects pour les joueurs actuels
    const espnMap = await fetchEspnMap(query, sport)
    if (espnMap.size > 0) return espnMap

    // Fallback NBA CDN pour les joueurs retraités absents d'ESPN
    const map = await getNbaPlayerMap()
    const result = new Map<string, string>()
    const q = query.toLowerCase()
    for (const [name, id] of map) {
      if (name.includes(q)) {
        result.set(name, `https://cdn.nba.com/headshots/nba/latest/1040x760/${id}.png`)
      }
    }
    return result
  }
  return fetchEspnMap(query, sport)
}

export async function fetchEspnHeadshot(name: string, sport = 'nba'): Promise<string | null> {
  // ESPN d'abord (headshots propres pour joueurs actuels)
  const espnMap = await fetchEspnMap(name, sport)
  const espnHit = espnMap.get(name.toLowerCase()) ?? espnMap.get(norm(name)) ?? null
  if (espnHit) return espnHit

  // Fallback NBA CDN pour les retraités (Jordan, Kobe…)
  if (sport === 'nba') {
    const nba = await fetchNbaHeadshot(name)
    if (nba) return nba
  }
  return null
}

// ── Bio ESPN (date de naissance, lieu, historique d'équipes) ──────────────────
const LEAGUE_MAP: Record<string, string> = { nba: 'nba', nfl: 'nfl', nhl: 'nhl', mlb: 'mlb' }

export interface EspnPlayerBio {
  birthDate: string | null
  birthPlace: string | null
  teams: string[]
}

async function findEspnAthleteId(name: string, sport: string): Promise<string | null> {
  const espnSport = SPORT_MAP[sport] || 'basketball'
  try {
    const url = `https://site.api.espn.com/apis/search/v2?query=${encodeURIComponent(name)}&limit=20&type=player&sport=${espnSport}`
    const r = await fetch(url, { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit)
    if (!r.ok) return null
    const data = await r.json()
    const target = norm(name)
    for (const section of data.results ?? []) {
      for (const a of section.contents ?? []) {
        if (a.displayName && norm(a.displayName) === target && a.uid) {
          const m = /a:(\d+)/.exec(a.uid)
          if (m) return m[1]
        }
      }
    }
  } catch { /* ESPN unavailable */ }
  return null
}

export async function fetchEspnPlayerBio(name: string, sport = 'nba'): Promise<EspnPlayerBio | null> {
  const league = LEAGUE_MAP[sport] || 'nba'
  const espnSport = SPORT_MAP[sport] || 'basketball'
  const id = await findEspnAthleteId(name, sport)
  if (!id) return null

  let birthDate: string | null = null
  let birthPlace: string | null = null
  try {
    const r = await fetch(
      `https://sports.core.api.espn.com/v2/sports/${espnSport}/leagues/${league}/athletes/${id}?lang=en&region=us`,
      { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit
    )
    if (r.ok) {
      const data = await r.json()
      birthDate = data.dateOfBirth ? String(data.dateOfBirth).slice(0, 10) : null
      const bp = data.birthPlace
      birthPlace = bp ? [bp.city, bp.state || bp.country].filter(Boolean).join(', ') : null
    }
  } catch { /* ESPN unavailable */ }

  let teams: string[] = []
  try {
    const r = await fetch(
      `https://sports.core.api.espn.com/v2/sports/${espnSport}/leagues/${league}/athletes/${id}/statisticslog?lang=en&region=us`,
      { signal: AbortSignal.timeout(3000), next: { revalidate: 86400 } } as RequestInit
    )
    if (r.ok) {
      const data = await r.json()
      const teamIds = new Set<string>()
      for (const entry of data.entries ?? []) {
        for (const s of entry.statistics ?? []) {
          const ref: string | undefined = s?.team?.$ref
          const m = ref ? /\/teams\/(\d+)/.exec(ref) : null
          if (m) teamIds.add(m[1])
        }
      }
      const names = await Promise.all([...teamIds].map(async tid => {
        try {
          const tr = await fetch(
            `https://sports.core.api.espn.com/v2/sports/${espnSport}/leagues/${league}/teams/${tid}?lang=en&region=us`,
            { signal: AbortSignal.timeout(2500), next: { revalidate: 86400 } } as RequestInit
          )
          if (!tr.ok) return null
          const td = await tr.json()
          return td.displayName as string | undefined
        } catch { return null }
      }))
      teams = names.filter((n): n is string => !!n)
    }
  } catch { /* ESPN unavailable */ }

  return { birthDate, birthPlace, teams }
}
