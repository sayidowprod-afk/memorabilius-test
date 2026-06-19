'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

export default function Teams() {
  const router = useRouter()
  const { t, lang } = useLang()
  const [teams, setTeams] = useState<any[]>([])
  const [teamsStats, setTeamsStats] = useState<any[]>([])
  const [search, setSearch] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [userTeamId, setUserTeamId] = useState<number | null>(null)
  const [hasCandidature, setHasCandidature] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    loadTeams()
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      setUserId(data.user.id)
      const { data: m } = await supabase.from('team_members').select('team_id').eq('user_id', data.user.id).single()
      if (m) setUserTeamId(m.team_id)
      // Candidatures en attente
      const { data: cands } = await supabase.from('team_candidatures').select('team_id').eq('user_id', data.user.id).eq('statut', 'en_attente')
      if (cands) setHasCandidature(new Set(cands.map((c: any) => c.team_id)))
    })
  }, [])

  const loadTeams = async () => {
    const { data } = await supabase.from('teams').select('*, team_members(count)').order('created_at', { ascending: false })
    setTeams(data || [])
    loadTeamsStats(data || [])
  }

  const loadTeamsStats = async (teamsList: any[]) => {
    const stats = await Promise.all(teamsList.map(async (team) => {
      const { data: members } = await supabase.from('team_members').select('profiles(stats_total)').eq('team_id', team.id)
      const total = (members || []).reduce((acc: number, m: any) => acc + (m.profiles?.stats_total || 0), 0)
      return { teamId: team.id, total }
    }))
    setTeamsStats(stats)
  }

  const joinTeam = async (teamId: number) => {
    if (!userId) return
    setLoading(true)
    await supabase.from('team_candidatures').insert({ team_id: teamId, user_id: userId })
    setHasCandidature(prev => new Set([...prev, teamId]))
    setLoading(false)
  }

  const createTeam = async () => {
    if (!userId || !newTeamName.trim()) return
    setLoading(true)
    const { data } = await supabase.from('teams').insert({ name: newTeamName.trim(), created_by: userId }).select().single()
    if (data) {
      await supabase.from('team_members').insert({ team_id: data.id, user_id: userId })
      setUserTeamId(data.id)
      router.push(`/teams/${data.id}`)
    }
    setNewTeamName('')
    setShowCreate(false)
    setLoading(false)
  }

  // Trier par nombre de cartes total
  const sorted = [...teams].sort((a, b) => {
    const aStats = teamsStats.find(s => s.teamId === a.id)?.total || 0
    const bStats = teamsStats.find(s => s.teamId === b.id)?.total || 0
    return bStats - aStats
  })

  const filtered = sorted.filter(t => t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>{t('teams_title')}</h1>
        {userId && !userTeamId && (
          <button onClick={() => setShowCreate(!showCreate)} className="btn-main btn-primary" style={{ padding: '10px 20px', fontSize: 13 }}>
            {t('teams_create')}
          </button>
        )}
        {userId && userTeamId && (
          <Link href={`/teams/${userTeamId}`} style={{ background: '#003DA6', color: 'white', padding: '10px 20px', borderRadius: 50, fontWeight: 700, fontSize: 13 }}>
            {t('teams_see_my_team')}
          </Link>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('teams_search')} style={{ maxWidth: 400 }} />
      </div>

      {showCreate && (
        <div style={{ background: 'white', padding: 24, borderRadius: 12, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
          <h3 style={{ fontWeight: 800, marginBottom: 12 }}>{lang === 'fr' ? 'Créer une nouvelle team' : 'Create a new team'}</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <input value={newTeamName} onChange={e => setNewTeamName(e.target.value)} placeholder={lang === 'fr' ? 'Nom de la team' : 'Team name'} onKeyDown={e => e.key === 'Enter' && createTeam()} />
            <button onClick={createTeam} disabled={loading} className="btn-main btn-primary" style={{ padding: '10px 20px', fontSize: 13, whiteSpace: 'nowrap' }}>
              {loading ? '...' : (lang === 'fr' ? 'Créer' : 'Create')}
            </button>
          </div>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr>
            {['#', 'Team', t('teams_members'), t('teams_total_cards_label'), t('teams_action')].map(h => (
              <th key={h} style={{ background: '#fdfdfd', padding: '16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#999', borderBottom: '2px solid #f0f0f0' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((team, i) => {
              const stats = teamsStats.find(s => s.teamId === team.id)
              const memberCount = team.team_members?.[0]?.count || 0
              const isMyTeam = userTeamId === team.id
              const pending = hasCandidature.has(team.id)
              return (
                <tr key={team.id}>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5', fontWeight: 900, color: i === 0 ? '#f39c12' : i === 1 ? '#95a5a6' : i === 2 ? '#cd7f32' : '#999', fontSize: 16 }}>
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {team.avatar_url ? (
                        <img src={team.avatar_url} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt={team.name} />
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#003DA6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: 14, flexShrink: 0 }}>
                          {team.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <Link href={`/teams/${team.id}`} style={{ fontWeight: 800, color: '#121212', display: 'block' }}>{team.name}</Link>
                        {team.description && <p style={{ fontSize: 11, color: '#999', margin: 0 }}>{team.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ background: '#f0f0f0', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>{memberCount}</span>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}>
                    <span style={{ background: '#e3f2fd', color: '#1976d2', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>
                      {stats?.total ?? '...'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}>
                    {isMyTeam ? (
                      <Link href={`/teams/${team.id}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13 }}>{t('teams_my_team')}</Link>
                    ) : pending ? (
                      <span style={{ color: '#e67e22', fontWeight: 700, fontSize: 13 }}>⏳ En attente</span>
                    ) : userId && !userTeamId ? (
                      <button onClick={() => joinTeam(team.id)} disabled={loading} style={{ background: '#e8f5e9', color: '#2e7d32', padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 900 }}>
                        Rejoindre
                      </button>
                    ) : (
                      <Link href={`/teams/${team.id}`} style={{ color: '#003DA6', fontWeight: 700, fontSize: 13 }}>Voir →</Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
