'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { SPORTS_TEAMS, getSpeciality, getTeamById } from '@/lib/sportsTeams'
import TeamBadge from '@/components/TeamBadge'

interface Stats { total: number; rc: number; auto: number; num: number; patch: number }
interface Collector { id: string; display_name: string; avatar_url: string; lien_csv: string; stats?: Stats; favorite_teams?: string[]; is_donor?: boolean }

export default function Annuaire() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement...</p>}>
      <AnnuaireContent />
    </Suspense>
  )
}

function AnnuaireContent() {
  const { t, lang } = useLang()
  const searchParams = useSearchParams()
  const teamIdFromUrl = searchParams.get('team_id') || ''

  const [collectors, setCollectors] = useState<Collector[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'display_name' | 'total' | 'rc' | 'auto' | 'num' | 'patch'>('total')
  const [sortAsc, setSortAsc] = useState(false)
  const [teamFilter, setTeamFilter] = useState<string>(teamIdFromUrl)
  const [teams, setTeams] = useState<any[]>([])
  const [teamName, setTeamName] = useState<string>('')
  const [search, setSearch] = useState('')
  const [nbaFilter, setNbaFilter] = useState('')

  useEffect(() => {
    supabase.from('teams').select('id, name').then(({ data }) => {
      setTeams(data || [])
      if (teamIdFromUrl && data) {
        const t = data.find((t: any) => String(t.id) === teamIdFromUrl)
        if (t) setTeamName(t.name)
      }
    })
    loadData()
  }, [])

  // Appliquer le filtre team quand les données changent
  useEffect(() => {
    applyTeamFilter(teamFilter)
  }, [collectors, teamFilter])

  const loadData = async () => {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, lien_csv, stats_total, stats_rc, stats_auto, stats_num, stats_patch, stats_updated_at, favorite_teams, is_donor')
      .not('display_name', 'is', null)
      .neq('display_name', '')

    if (!profiles) { setLoading(false); return }

    // Utiliser les stats en cache directement
    setCollectors(profiles.map(p => ({
      ...p,
      favorite_teams: Array.isArray(p.favorite_teams) ? p.favorite_teams : [],
      stats: {
        total: p.stats_total || 0,
        rc: p.stats_rc || 0,
        auto: p.stats_auto || 0,
        num: p.stats_num || 0,
        patch: p.stats_patch || 0,
      }
    })))
    setLoading(false)

    // Recalculer les stats si pas à jour depuis 24h
    profiles.forEach(async p => {
      const lastUpdate = p.stats_updated_at ? new Date(p.stats_updated_at) : null
      const isStale = !lastUpdate || (Date.now() - lastUpdate.getTime() > 60 * 60 * 1000)
      if (isStale) {
        try {
          const r = await fetch('/api/update-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: p.id, csvUrl: p.lien_csv || null }),
          })
          const data = await r.json()
          if (data.stats) {
            setCollectors(prev => prev.map(c => c.id === p.id ? { ...c, stats: data.stats } : c))
          }
        } catch { }
      }
    })
  }

  const applyTeamFilter = async (tid: string) => {
    if (!tid) {
      // pas besoin de setCollectors ici car loadData le fait déjà
      return
    }
    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', parseInt(tid))
    if (!members) { setCollectors([]); return }
    const ids = members.map((m: any) => m.user_id)
    setCollectors(prev => prev.filter(c => ids.includes(c.id)))
  }

  const handleTeamChange = async (tid: string) => {
    setTeamFilter(tid)
    if (tid) {
      const t = teams.find(t => String(t.id) === tid)
      setTeamName(t?.name || '')
    } else {
      setTeamName('')
    }
    // Mettre à jour l'URL sans recharger
    const url = new URL(window.location.href)
    if (tid) url.searchParams.set('team_id', tid)
    else url.searchParams.delete('team_id')
    window.history.pushState({}, '', url.toString())
  }

  const sorted = [...collectors].filter(c =>
    (!search || (c.display_name || '').toLowerCase().includes(search.toLowerCase())) &&
    (!nbaFilter || (c.favorite_teams || []).includes(nbaFilter))
  ).sort((a, b) => {
    if (sortKey === 'display_name') return sortAsc ? (a.display_name || '').localeCompare(b.display_name || '') : (b.display_name || '').localeCompare(a.display_name || '')
    const av = (a.stats?.[sortKey] || 0) as number
    const bv = (b.stats?.[sortKey] || 0) as number
    return sortAsc ? av - bv : bv - av
  })

  const handleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(false) }
  }

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 600

  const th = (k: typeof sortKey, label: string) => (
    <th onClick={() => handleSort(k)} style={{ background: '#fdfdfd', padding: isMobile ? '10px 6px' : '18px 15px', textAlign: isMobile ? 'center' : 'left', fontSize: isMobile ? 10 : 11, textTransform: 'uppercase', color: '#999', borderBottom: '2px solid #f0f0f0', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const badge = (val: number, bg: string, color: string) => (
    <span style={{ padding: isMobile ? '4px 6px' : '6px 12px', borderRadius: 6, fontWeight: 900, fontSize: isMobile ? 11 : 13, display: 'inline-block', minWidth: isMobile ? 28 : 40, textAlign: 'center', background: bg, color }}>{val ?? '—'}</span>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <style>{`
        .sticker-badge-sm {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: default;
          line-height: 1;
          filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 3px white);
          transition: transform 0.15s;
        }
        .sticker-badge-sm:hover { transform: scale(1.2); }
        .sticker-badge-sm::after {
          content: attr(data-label);
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.82);
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 20;
          font-family: inherit;
        }
        .sticker-badge-sm:hover::after { opacity: 1; }

        .sticker-holo {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: default;
          line-height: 1;
          transition: transform 0.15s;
          animation: holo-glow 3s linear infinite;
        }
        .sticker-holo:hover { transform: scale(1.2); }
        .sticker-holo::after {
          content: attr(data-label);
          position: absolute;
          bottom: calc(100% + 6px);
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.82);
          color: white;
          font-size: 11px;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
          white-space: nowrap;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.15s;
          z-index: 20;
          font-family: inherit;
        }
        .sticker-holo:hover::after { opacity: 1; }
        @keyframes holo-glow {
          0%   { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 6px #ff6b6b) drop-shadow(0 0 11px #ff6b6b); }
          16%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 6px #ffd93d) drop-shadow(0 0 11px #ffd93d); }
          33%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 6px #6bcb77) drop-shadow(0 0 11px #6bcb77); }
          50%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 6px #4d96ff) drop-shadow(0 0 11px #4d96ff); }
          66%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 6px #c77dff) drop-shadow(0 0 11px #c77dff); }
          83%  { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 6px #ff6b9d) drop-shadow(0 0 11px #ff6b9d); }
          100% { filter: drop-shadow(0 0 0 white) drop-shadow(0 0 2px white) drop-shadow(0 0 6px #ff6b6b) drop-shadow(0 0 11px #ff6b6b); }
        }
        .holo-name {
          background: linear-gradient(90deg,#ff0080,#ff8c00,#ffee00,#00e676,#00b0ff,#e040fb,#ff0080);
          background-size: 300% 100%;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: holo-text 10s linear infinite;
        }
        @keyframes holo-text {
          0%   { background-position: 0% 50%; }
          100% { background-position: 300% 50%; }
        }
        @media (max-width: 600px) {
          .holo-name { animation: none; background-position: 30% 50%; }
        }
      `}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>
          {teamName ? `${lang === 'fr' ? 'Team' : 'Team'} : ${teamName}` : t('directory_title')}
        </h1>
        {teamName && (
          <button onClick={() => handleTeamChange('')} style={{ fontSize: 12, color: '#999', background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            ← Toutes les teams
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={lang === 'fr' ? 'Rechercher un collectionneur…' : 'Search collector…'}
          style={{ flex: '1 1 200px', minWidth: 180 }}
        />
        <select value={teamFilter} onChange={e => handleTeamChange(e.target.value)} style={{ flex: '1 1 160px', minWidth: 140 }}>
          <option value="">{t('all_teams')}</option>
          {teams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
        </select>
        <select value={nbaFilter} onChange={e => setNbaFilter(e.target.value)} style={{ flex: '1 1 160px', minWidth: 140 }}>
          <option value="">🏀 Toutes les équipes NBA</option>
          {SPORTS_TEAMS.map(t => <option key={t.id} value={t.id}>{t.name} ({t.sport.toUpperCase()})</option>)}
        </select>
      </div>

      {loading ? <p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement des collections...</p> : (
        <div style={{ borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: isMobile ? '42%' : '40%' }} />
              <col style={{ width: isMobile ? '12%' : '12%' }} />
              <col style={{ width: isMobile ? '11%' : '12%' }} />
              <col style={{ width: isMobile ? '11%' : '12%' }} />
              <col style={{ width: isMobile ? '12%' : '12%' }} />
              <col style={{ width: isMobile ? '12%' : '12%' }} />
            </colgroup>
            <thead><tr>
              {th('display_name', isMobile ? 'Nom' : t('directory_collector'))}
              {th('total', isMobile ? 'Tot.' : t('directory_total'))}
              {th('rc', 'RC')}
              {th('auto', 'Auto')}
              {th('num', isMobile ? '#' : '# Num')}
              {th('patch', isMobile ? 'Pat.' : 'Patch')}
            </tr></thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{lang === 'fr' ? 'Aucun collectionneur dans cette team.' : 'No collectors in this team.'}</td></tr>
              )}
              {sorted.map(c => (
                <tr key={c.id}>
                  <td style={{ padding: isMobile ? '10px 8px' : 15, borderBottom: '1px solid #f5f5f5', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 15, minWidth: 0 }}>
                      <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.display_name || 'U')}&background=003DA6&color=fff`} style={{ width: isMobile ? 28 : 42, height: isMobile ? 28 : 42, borderRadius: '50%', border: '2px solid #eee', objectFit: 'cover', flexShrink: 0 }} alt={c.display_name} />
                      <div style={{ minWidth: 0 }}>
                        <Link href={`/galerie/${c.id}`} className={c.is_donor ? 'holo-name' : ''} style={{ fontWeight: 800, color: c.is_donor ? undefined : '#121212', fontSize: isMobile ? 12 : 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block', textDecoration: 'none' }}>{c.display_name || 'Collectionneur'}</Link>
                        {(() => {
                          const teams = c.favorite_teams || []
                          const spec = getSpeciality(c.stats)
                          return (
                            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                              {teams.slice(0, 3).map(id => (
                                <span key={id} className="sticker-badge-sm" data-label={getTeamById(id)?.name ?? id} style={{ fontSize: 18 }}>
                                  <TeamBadge teamId={id} size={18} />
                                </span>
                              ))}
                              {spec.map((s, i) => (
                                <span key={i} className="sticker-badge-sm" data-label={s.label.replace(/^\S+\s*/, '')} style={{ fontSize: 18 }}>
                                  {s.label.match(/^\S+/)?.[0] ?? '⭐'}
                                </span>
                              ))}
                              {c.is_donor && (
                                <span className="sticker-holo" data-label="Donateur Ko-fi" style={{ fontSize: 18 }}>☕</span>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: isMobile ? '10px 4px' : 15, borderBottom: '1px solid #f5f5f5', textAlign: 'center' }}>{badge(c.stats?.total ?? 0, '#f0f0f0', '#333')}</td>
                  <td style={{ padding: isMobile ? '10px 4px' : 15, borderBottom: '1px solid #f5f5f5', textAlign: 'center' }}>{badge(c.stats?.rc ?? 0, '#e67e22', 'white')}</td>
                  <td style={{ padding: isMobile ? '10px 4px' : 15, borderBottom: '1px solid #f5f5f5', textAlign: 'center' }}>{badge(c.stats?.auto ?? 0, '#2e7d32', 'white')}</td>
                  <td style={{ padding: isMobile ? '10px 4px' : 15, borderBottom: '1px solid #f5f5f5', textAlign: 'center' }}>{badge(c.stats?.num ?? 0, '#7b1fa2', 'white')}</td>
                  <td style={{ padding: isMobile ? '10px 4px' : 15, borderBottom: '1px solid #f5f5f5', textAlign: 'center' }}>{badge(c.stats?.patch ?? 0, '#1976d2', 'white')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}