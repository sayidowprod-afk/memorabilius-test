'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

interface Stats { total: number; rc: number; auto: number; num: number; patch: number }
interface Collector { id: string; display_name: string; avatar_url: string; lien_csv: string; stats?: Stats }

export default function Annuaire() {
  return (
    <Suspense fallback={<p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement...</p>}>
      <AnnuaireContent />
    </Suspense>
  )
}

function AnnuaireContent() {
  const searchParams = useSearchParams()
  const teamIdFromUrl = searchParams.get('team_id') || ''

  const [collectors, setCollectors] = useState<Collector[]>([])
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<'display_name' | 'total' | 'rc' | 'auto' | 'num' | 'patch'>('total')
  const [sortAsc, setSortAsc] = useState(false)
  const [teamFilter, setTeamFilter] = useState<string>(teamIdFromUrl)
  const [teams, setTeams] = useState<any[]>([])
  const [teamName, setTeamName] = useState<string>('')

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
      .select('id, display_name, avatar_url, lien_csv, stats_total, stats_rc, stats_auto, stats_num, stats_patch, stats_updated_at')
      .not('lien_csv', 'is', null)
      .neq('lien_csv', '')

    if (!profiles) { setLoading(false); return }

    // Utiliser les stats en cache directement
    setCollectors(profiles.map(p => ({
      ...p,
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
      const isStale = !lastUpdate || (Date.now() - lastUpdate.getTime() > 24 * 60 * 60 * 1000)
      if (isStale && p.lien_csv) {
        try {
          const r = await fetch('/api/update-stats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId: p.id, csvUrl: p.lien_csv }),
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

  const sorted = [...collectors].sort((a, b) => {
    if (sortKey === 'display_name') return sortAsc ? (a.display_name || '').localeCompare(b.display_name || '') : (b.display_name || '').localeCompare(a.display_name || '')
    const av = (a.stats?.[sortKey] || 0) as number
    const bv = (b.stats?.[sortKey] || 0) as number
    return sortAsc ? av - bv : bv - av
  })

  const handleSort = (k: typeof sortKey) => {
    if (sortKey === k) setSortAsc(!sortAsc)
    else { setSortKey(k); setSortAsc(false) }
  }

  const th = (k: typeof sortKey, label: string) => (
    <th onClick={() => handleSort(k)} style={{ background: '#fdfdfd', padding: '18px 15px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#999', borderBottom: '2px solid #f0f0f0', cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {label}{sortKey === k ? (sortAsc ? ' ↑' : ' ↓') : ''}
    </th>
  )

  const badge = (val: number, bg: string, color: string) => (
    <span style={{ padding: '6px 12px', borderRadius: 6, fontWeight: 900, fontSize: 13, display: 'inline-block', minWidth: 40, textAlign: 'center', background: bg, color }}>{val ?? '—'}</span>
  )

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <h1 style={{ fontWeight: 900, fontSize: 28, margin: 0 }}>
          {teamName ? `Team : ${teamName}` : 'Annuaire des collectionneurs'}
        </h1>
        {teamName && (
          <button onClick={() => handleTeamChange('')} style={{ fontSize: 12, color: '#999', background: 'none', border: '1px solid #ddd', borderRadius: 6, padding: '4px 10px', cursor: 'pointer' }}>
            ← Toutes les teams
          </button>
        )}
      </div>

      <div style={{ marginBottom: 16 }}>
        <select value={teamFilter} onChange={e => handleTeamChange(e.target.value)} style={{ width: 'auto', minWidth: 200 }}>
          <option value="">Toutes les teams</option>
          {teams.map(t => <option key={t.id} value={String(t.id)}>{t.name}</option>)}
        </select>
      </div>

      {loading ? <p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement des collections...</p> : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', background: 'white', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.08)' }}>
            <thead><tr>
              {th('display_name', 'Collectionneur')}
              {th('total', 'Total')}
              {th('rc', 'RC')}
              {th('auto', 'Auto')}
              {th('num', '# Num')}
              {th('patch', 'Patch')}
            </tr></thead>
            <tbody>
              {sorted.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>Aucun collectionneur dans cette team.</td></tr>
              )}
              {sorted.map(c => (
                <tr key={c.id}>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 15 }}>
                      <img src={c.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.display_name || 'U')}&background=003DA6&color=fff`} style={{ width: 42, height: 42, borderRadius: '50%', border: '2px solid #eee', objectFit: 'cover' }} alt={c.display_name} />
                      <Link href={`/galerie/${c.id}`} style={{ fontWeight: 800, color: '#121212' }}>{c.display_name || 'Collectionneur'}</Link>
                    </div>
                  </td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.total ?? 0, '#f0f0f0', '#333')}</td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.rc ?? 0, '#fff3e0', '#e67e22')}</td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.auto ?? 0, '#e8f5e9', '#2e7d32')}</td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.num ?? 0, '#f5f5f5', '#444')}</td>
                  <td style={{ padding: 15, borderBottom: '1px solid #f5f5f5' }}>{badge(c.stats?.patch ?? 0, '#e3f2fd', '#1976d2')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}