'use client'
import { useState } from 'react'
import { SPORTS_TEAMS, SPORT_LABELS, FOOTBALL_LEAGUE_LABELS, teamLogoUrl, type Sport, type FootballLeague } from '@/lib/sportsTeams'

interface Props {
  value: string[]
  onChange: (teams: string[]) => void
  max?: number
}

export default function TeamPicker({ value, onChange, max = 5 }: Props) {
  const [open, setOpen] = useState(false)
  const [sport, setSport] = useState<Sport>('nba')
  const [league, setLeague] = useState<FootballLeague>('premier-league')
  const [search, setSearch] = useState('')

  const sports: Sport[] = ['nba', 'nfl', 'mlb', 'nhl', 'football']
  const footballLeagues: FootballLeague[] = ['premier-league', 'bundesliga', 'serie-a', 'laliga', 'ligue-1']

  const filtered = SPORTS_TEAMS.filter(t => {
    if (t.sport !== sport) return false
    if (sport === 'football' && !search && t.league !== league) return false
    if (!search) return true
    return t.name.toLowerCase().includes(search.toLowerCase()) || t.abbr.toLowerCase().includes(search.toLowerCase())
  })

  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id))
    } else {
      if (value.length >= max) return
      onChange([...value, id])
    }
  }

  return (
    <div style={{ position: 'relative' }}>
      {/* Selected badges */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: value.length ? 10 : 0 }}>
        {value.map(id => {
          const team = SPORTS_TEAMS.find(t => t.id === id)
          if (!team) return null
          return (
            <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6, background: team.color + '14', border: `1.5px solid ${team.color}44`, borderRadius: 20, padding: '4px 10px 4px 6px' }}>
              <img src={teamLogoUrl(team)} alt={team.abbr} width={20} height={20} style={{ borderRadius: '50%', objectFit: 'contain', background: team.color + '22' }} />
              <span style={{ fontSize: 12, fontWeight: 800, color: team.color }}>{team.abbr}</span>
              <button onClick={() => toggle(id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#bbb', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
            </div>
          )
        })}
        {value.length < max && (
          <button onClick={() => setOpen(true)} style={{ border: '1.5px dashed #ccc', borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 700, color: '#888', background: 'none', cursor: 'pointer' }}>
            + Ajouter une équipe
          </button>
        )}
      </div>

      {/* Modal picker */}
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => { setOpen(false); setSearch('') }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'white', borderRadius: 16, padding: 20, width: '100%', maxWidth: 520, maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontWeight: 900, fontSize: 16 }}>Choisir une équipe</h3>
              <button onClick={() => { setOpen(false); setSearch('') }} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#999' }}>✕</button>
            </div>

            {/* Sport tabs */}
            <div style={{ display: 'flex', gap: 4, background: '#f5f5f5', borderRadius: 10, padding: 4 }}>
              {sports.map(s => (
                <button key={s} onClick={() => { setSport(s); setSearch('') }} style={{
                  flex: 1, border: 'none', borderRadius: 8, padding: '7px 4px', fontWeight: 800, fontSize: 11, cursor: 'pointer', transition: '0.15s',
                  background: sport === s ? 'white' : 'transparent',
                  color: sport === s ? '#121212' : '#888',
                  boxShadow: sport === s ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                }}>
                  {SPORT_LABELS[s]}
                </button>
              ))}
            </div>

            {/* League sub-tabs (football only) */}
            {sport === 'football' && !search && (
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 2 }}>
                {footballLeagues.map(l => (
                  <button key={l} onClick={() => setLeague(l)} style={{
                    flexShrink: 0, border: 'none', borderRadius: 8, padding: '5px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer', transition: '0.15s',
                    background: league === l ? '#003DA6' : '#f0f0f0',
                    color: league === l ? 'white' : '#666',
                  }}>
                    {FOOTBALL_LEAGUE_LABELS[l]}
                  </button>
                ))}
              </div>
            )}

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher…"
              style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13 }}
              autoFocus
            />

            {/* Team grid */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                {filtered.map(team => {
                  const selected = value.includes(team.id)
                  const disabled = !selected && value.length >= max
                  return (
                    <button key={team.id} onClick={() => toggle(team.id)} disabled={disabled} style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                      padding: '10px 4px', borderRadius: 10, border: selected ? `2px solid ${team.color}` : '2px solid transparent',
                      background: selected ? team.color + '14' : '#fafafa',
                      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
                      transition: '0.15s',
                    }}>
                      <img src={teamLogoUrl(team)} alt={team.abbr} width={36} height={36} style={{ objectFit: 'contain' }} />
                      <span style={{ fontSize: 9, fontWeight: 800, color: selected ? team.color : '#666', textAlign: 'center', lineHeight: 1.2 }}>{team.name.length > 12 ? team.abbr : team.name}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <p style={{ fontSize: 11, color: '#bbb', margin: 0, textAlign: 'center' }}>
              {value.length}/{max} équipes sélectionnées
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
