export const NBA_TEAMS = [
  { abbr: 'ATL', name: 'Atlanta Hawks',           color: '#E03A3E' },
  { abbr: 'BOS', name: 'Boston Celtics',           color: '#007A33' },
  { abbr: 'BKN', name: 'Brooklyn Nets',            color: '#000000' },
  { abbr: 'CHA', name: 'Charlotte Hornets',        color: '#00788C' },
  { abbr: 'CHI', name: 'Chicago Bulls',            color: '#CE1141' },
  { abbr: 'CLE', name: 'Cleveland Cavaliers',      color: '#860038' },
  { abbr: 'DAL', name: 'Dallas Mavericks',         color: '#00538C' },
  { abbr: 'DEN', name: 'Denver Nuggets',           color: '#0E2240' },
  { abbr: 'DET', name: 'Detroit Pistons',          color: '#C8102E' },
  { abbr: 'GSW', name: 'Golden State Warriors',    color: '#1D428A' },
  { abbr: 'HOU', name: 'Houston Rockets',          color: '#CE1141' },
  { abbr: 'IND', name: 'Indiana Pacers',           color: '#002D62' },
  { abbr: 'LAC', name: 'LA Clippers',              color: '#C8102E' },
  { abbr: 'LAL', name: 'Los Angeles Lakers',       color: '#552583' },
  { abbr: 'MEM', name: 'Memphis Grizzlies',        color: '#5D76A9' },
  { abbr: 'MIA', name: 'Miami Heat',               color: '#98002E' },
  { abbr: 'MIL', name: 'Milwaukee Bucks',          color: '#00471B' },
  { abbr: 'MIN', name: 'Minnesota Timberwolves',   color: '#0C2340' },
  { abbr: 'NOP', name: 'New Orleans Pelicans',     color: '#0C2340' },
  { abbr: 'NYK', name: 'New York Knicks',          color: '#006BB6' },
  { abbr: 'OKC', name: 'Oklahoma City Thunder',    color: '#007AC1' },
  { abbr: 'ORL', name: 'Orlando Magic',            color: '#0077C0' },
  { abbr: 'PHI', name: 'Philadelphia 76ers',       color: '#006BB6' },
  { abbr: 'PHX', name: 'Phoenix Suns',             color: '#1D1160' },
  { abbr: 'POR', name: 'Portland Trail Blazers',   color: '#E03A3E' },
  { abbr: 'SAC', name: 'Sacramento Kings',         color: '#5A2D81' },
  { abbr: 'SAS', name: 'San Antonio Spurs',        color: '#8A8D8F' },
  { abbr: 'TOR', name: 'Toronto Raptors',          color: '#CE1141' },
  { abbr: 'UTA', name: 'Utah Jazz',                color: '#002B5C' },
  { abbr: 'WAS', name: 'Washington Wizards',       color: '#E31837' },
]

export function getTeam(abbr: string) {
  return NBA_TEAMS.find(t => t.abbr === abbr) || null
}

export function getSpeciality(stats: { total: number; rc: number; auto: number; patch: number; num: number } | undefined, favoriteTeam?: string | null): { label: string; color: string } | null {
  const team = favoriteTeam ? getTeam(favoriteTeam) : null
  if (!stats || stats.total === 0) return team ? { label: `${team.abbr} Fan`, color: team.color } : null

  const { total, rc, auto, patch, num } = stats
  if (team) return { label: `${team.name.split(' ').pop()} Fan`, color: team.color }
  if (total >= 1000)   return { label: '🏆 Légende',          color: '#f39c12' }
  if (total >= 300)    return { label: '🎖️ Grand Collectionneur', color: '#e67e22' }
  if (rc / total > 0.35)    return { label: '🌟 RC Hunter',       color: '#e67e22' }
  if (auto / total > 0.25)  return { label: '✍️ Auto Collector',  color: '#2e7d32' }
  if (patch / total > 0.12) return { label: '🧩 Patch Master',    color: '#1976d2' }
  if (num / total > 0.55)   return { label: '🔢 Serial #',        color: '#7b1fa2' }
  if (total >= 100)    return { label: '📦 Collectionneur',    color: '#003DA6' }
  return null
}
