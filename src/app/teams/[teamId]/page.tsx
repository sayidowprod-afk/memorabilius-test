'use client'
import { useEffect, useState, useRef, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'

export default function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()
  const { t, lang } = useLang()
  const [team, setTeam] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [membersStats, setMembersStats] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [candidatures, setCandidatures] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [currentUserProfile, setCurrentUserProfile] = useState<any>(null)
  const [isMember, setIsMember] = useState(false)
  const [isChef, setIsChef] = useState(false)
  const [hasCandidature, setHasCandidature] = useState(false)
  const [newMsg, setNewMsg] = useState('')
  const [activeTab, setActiveTab] = useState<'membres' | 'chat' | 'candidatures'>('membres')
  const [loading, setLoading] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    init()
  }, [teamId])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.id || null)

    // Charger la team
    const { data: t } = await supabase.from('teams').select('*').eq('id', parseInt(teamId)).single()
    if (!t) { router.push('/teams'); return }
    setTeam(t)
    setIsChef(user?.id === t.created_by)

    // Charger les membres
    const { data: m } = await supabase.from('team_members')
      .select('*, profiles(id, display_name, avatar_url, lien_csv, couleur_bordure)')
      .eq('team_id', parseInt(teamId))
    setMembers(m || [])
    setIsMember(m?.some((x: any) => x.user_id === user?.id) || false)

    // Charger le profil utilisateur
    if (user) {
      const { data: p } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setCurrentUserProfile(p)
    }

    // Charger les messages
    const { data: msgs } = await supabase.from('team_messages')
      .select('*, profiles(id, display_name, avatar_url)')
      .eq('team_id', parseInt(teamId))
      .order('created_at', { ascending: true })
    setMessages(msgs || [])

    // Candidatures (chef seulement)
    if (user?.id === t.created_by) {
      const { data: cands } = await supabase.from('team_candidatures')
        .select('*, profiles(id, display_name, avatar_url, lien_csv)')
        .eq('team_id', parseInt(teamId))
        .eq('statut', 'en_attente')
      setCandidatures(cands || [])
    }

    // Vérifier si candidature existante
    if (user) {
      const { data: cand } = await supabase.from('team_candidatures')
        .select('id').eq('team_id', parseInt(teamId)).eq('user_id', user.id).single()
      setHasCandidature(!!cand)
    }

    // Charger stats membres
    loadMembersStats(m || [])
    setLoading(false)
  }

  const loadMembersStats = async (membersList: any[]) => {
    const stats = await Promise.all(membersList.map(async (m: any) => {
      const profile = m.profiles
      if (!profile) return { ...profile, stats: { total: 0, rc: 0, auto: 0, num: 0, patch: 0 } }
      // Utiliser les stats en cache depuis profiles
      const { data: p } = await supabase.from('profiles').select('stats_total, stats_rc, stats_auto, stats_num, stats_patch').eq('id', profile.id).single()
      return { ...profile, stats: { total: p?.stats_total || 0, rc: p?.stats_rc || 0, auto: p?.stats_auto || 0, num: p?.stats_num || 0, patch: p?.stats_patch || 0 } }
    }))
    setMembersStats(stats.sort((a, b) => (b.stats?.total || 0) - (a.stats?.total || 0)))
  }

  const sendMessage = async () => {
    if (!newMsg.trim() || !currentUser) return
    const { data } = await supabase.from('team_messages').insert({
      team_id: parseInt(teamId), user_id: currentUser, contenu: newMsg.trim()
    }).select('*, profiles(id, display_name, avatar_url)').single()
    if (data) setMessages(prev => [...prev, data])
    setNewMsg('')
  }

  const postuler = async () => {
    if (!currentUser) { router.push('/connexion'); return }
    await supabase.from('team_candidatures').insert({ team_id: parseInt(teamId), user_id: currentUser })
    setHasCandidature(true)
  }

  const accepterCandidature = async (cand: any) => {
    // Accepter et ajouter comme membre
    await supabase.from('team_candidatures').update({ statut: 'accepte' }).eq('id', cand.id)
    await supabase.from('team_members').insert({ team_id: parseInt(teamId), user_id: cand.user_id })
    setCandidatures(prev => prev.filter(c => c.id !== cand.id))
    init()
  }

  const refuserCandidature = async (cand: any) => {
    await supabase.from('team_candidatures').update({ statut: 'refuse' }).eq('id', cand.id)
    setCandidatures(prev => prev.filter(c => c.id !== cand.id))
  }

  const totalStats = membersStats.reduce((acc, m) => ({
    total: acc.total + (m.stats?.total || 0),
    rc: acc.rc + (m.stats?.rc || 0),
    auto: acc.auto + (m.stats?.auto || 0),
    num: acc.num + (m.stats?.num || 0),
    patch: acc.patch + (m.stats?.patch || 0),
  }), { total: 0, rc: 0, auto: 0, num: 0, patch: 0 })

  const accent = '#003DA6'

  if (loading) return <p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement...</p>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', fontFamily: 'Inter, sans-serif' }}>
      {/* Header team */}
      <div style={{ background: 'white', borderRadius: 16, padding: 30, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {/* Avatar team */}
          {team.avatar_url ? (
            <img src={team.avatar_url} style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', border: '3px solid #003DA6', flexShrink: 0 }} alt={team.name} />
          ) : (
            <div style={{ width: 70, height: 70, borderRadius: '50%', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: 'white', flexShrink: 0 }}>
              {team.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
              <h1 style={{ fontWeight: 900, fontSize: 26, margin: '0 0 4px' }}>{team.name}</h1>
              {isChef && (
                <Link href={`/teams/${teamId}/editer`} style={{ background: '#f0f0f0', color: '#444', padding: '4px 12px', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>
                  {t('teams_modify')}
                </Link>
              )}
            </div>
            {team.description && <p style={{ color: '#666', fontSize: 14, margin: '0 0 4px' }}>{team.description}</p>}
            {team.bio && <p style={{ color: '#888', fontSize: 13, margin: 0, lineHeight: 1.5 }}>{team.bio}</p>}
            <p style={{ color: '#999', fontSize: 12, margin: '4px 0 0' }}>{members.length} membre{members.length > 1 ? 's' : ''}</p>
          </div>
          {/* Stats cumulées */}
          <div style={{ display: 'flex', gap: 20 }}>
            {[
              { val: totalStats.total, label: 'Cartes', color: accent },
              { val: totalStats.rc, label: 'RC', color: '#e67e22' },
              { val: totalStats.auto, label: 'Auto', color: '#2e7d32' },
              { val: totalStats.num, label: 'Num', color: '#7b1fa2' },
              { val: totalStats.patch, label: 'Patch', color: '#1976d2' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>
          {/* Actions */}
          <div style={{ display: 'flex', gap: 10 }}>
            {!isMember && !hasCandidature && currentUser && (
              <button onClick={postuler} style={{ background: accent, color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer', fontSize: 14 }}>
                {t('teams_join')}
              </button>
            )}
            {hasCandidature && !isMember && (
              <span style={{ background: '#fff3e0', color: '#e67e22', padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>
                ⏳ Candidature en attente
              </span>
            )}
            {isMember && <span style={{ color: accent, fontWeight: 700, fontSize: 14 }}>✓ Membre</span>}
            {isMember && !isChef && (
              <button onClick={async () => {
                if (!confirm(`${t('teams_leave')} ?`)) return
                await supabase.from('team_members').delete().eq('team_id', parseInt(teamId)).eq('user_id', currentUser)
                router.push('/teams')
              }} style={{ background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                {t('teams_leave')}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {[
          { key: 'membres', label: `👥 ${t('teams_members')} (${members.length})` },
          { key: 'chat', label: t('teams_chat'), show: isMember },
          { key: 'candidatures', label: `📋 ${lang === 'fr' ? 'Candidatures' : 'Applications'} (${candidatures.length})`, show: isChef },
        ].filter(t => t.show !== false).map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key as any)} style={{
            padding: '10px 20px', border: 'none', borderRadius: 8, cursor: 'pointer',
            fontWeight: 700, fontSize: 14,
            background: activeTab === t.key ? accent : '#f0f0f0',
            color: activeTab === t.key ? 'white' : '#333',
          }}>{t.label}</button>
        ))}
      </div>

      {/* Contenu onglets */}
      {activeTab === 'membres' && (
        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['#', 'Collectionneur', 'Rôle', 'Total', 'RC', 'Auto', 'Num', 'Patch', ...(isChef ? ['Action'] : [])].map(h => (
                <th key={h} style={{ padding: '16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#999', borderBottom: '2px solid #f0f0f0', background: '#fdfdfd' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {membersStats.map((m, i) => {
                const memberData = members.find((x: any) => x.user_id === m.id)
                const role = m.id === team.created_by ? 'chef' : (memberData?.role || 'member')
                return (
                  <tr key={m.id}>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5', fontWeight: 900, color: i === 0 ? '#f39c12' : i === 1 ? '#95a5a6' : i === 2 ? '#cd7f32' : '#999', fontSize: 16 }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <img src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name || 'U')}&background=003DA6&color=fff`}
                          style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${m.couleur_bordure || accent}` }} alt="" />
                        <Link href={`/galerie/${m.id}`} style={{ fontWeight: 800, color: '#121212' }}>{m.display_name}</Link>
                      </div>
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}>
                      {role === 'chef' && <span style={{ fontSize: 11, background: accent, color: 'white', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>👑 Chef</span>}
                      {role === 'admin' && <span style={{ fontSize: 11, background: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>⭐ Admin</span>}
                      {role === 'member' && <span style={{ fontSize: 11, background: '#f0f0f0', color: '#666', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>Membre</span>}
                    </td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}><span style={{ background: '#f0f0f0', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>{m.stats?.total || 0}</span></td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}><span style={{ background: '#e67e22', color: 'white', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>{m.stats?.rc || 0}</span></td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}><span style={{ background: '#2e7d32', color: 'white', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>{m.stats?.auto || 0}</span></td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}><span style={{ background: '#7b1fa2', color: 'white', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>{m.stats?.num || 0}</span></td>
                    <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}><span style={{ background: '#1976d2', color: 'white', padding: '4px 10px', borderRadius: 6, fontWeight: 700 }}>{m.stats?.patch || 0}</span></td>
                    {isChef && (
                      <td style={{ padding: '14px 16px', borderBottom: '1px solid #f5f5f5' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                        {role !== 'chef' && (
                          <button onClick={async () => {
                            const newRole = role === 'admin' ? 'member' : 'admin'
                            await supabase.from('team_members').update({ role: newRole }).eq('team_id', parseInt(teamId)).eq('user_id', m.id)
                            init()
                          }} style={{
                            background: role === 'admin' ? '#fff5f5' : '#e8f5e9',
                            color: role === 'admin' ? '#e74c3c' : '#2e7d32',
                            border: 'none', borderRadius: 6, padding: '5px 10px',
                            fontWeight: 700, fontSize: 11, cursor: 'pointer'
                          }}>
                            {role === 'admin' ? t('teams_demote') : t('teams_promote')}
                          </button>
                        )}
                        {role !== 'chef' && (
                          <button onClick={async () => {
                            if (!confirm(`Exclure ${m.display_name} de la team ?`)) return
                            await supabase.from('team_members').delete().eq('team_id', parseInt(teamId)).eq('user_id', m.id)
                            init()
                          }} style={{
                            background: '#fff5f5', color: '#e74c3c',
                            border: 'none', borderRadius: 6, padding: '5px 10px',
                            fontWeight: 700, fontSize: 11, cursor: 'pointer'
                          }}>
                            🚫 Kick
                          </button>
                        )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'chat' && isMember && (
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', height: 500 }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 800 }}>💬 Chat de la team</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && <p style={{ textAlign: 'center', color: '#bbb', marginTop: 40 }}>{t('teams_no_message')}</p>}
            {messages.map(msg => {
              const isMe = msg.user_id === currentUser
              return (
                <div key={msg.id} style={{ display: 'flex', gap: 10, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                  <img src={msg.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.profiles?.display_name || 'U')}&background=003DA6&color=fff`}
                    style={{ width: 30, height: 30, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                  <div style={{ maxWidth: '70%' }}>
                    {!isMe && <p style={{ fontSize: 11, color: '#999', margin: '0 0 3px', fontWeight: 700 }}>{msg.profiles?.display_name}</p>}
                    <div style={{ background: isMe ? accent : '#f0f0f0', color: isMe ? 'white' : '#121212', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 14, lineHeight: 1.5 }}>
                      {msg.contenu}
                    </div>
                    <p style={{ fontSize: 10, color: '#bbb', margin: '3px 0 0', textAlign: isMe ? 'right' : 'left' }}>
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
          <div style={{ padding: '12px 16px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 10 }}>
            <input value={newMsg} onChange={e => setNewMsg(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder="Votre message..." style={{ flex: 1 }} />
            <button onClick={sendMessage} style={{ background: accent, color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>{t('teams_send')}</button>
          </div>
        </div>
      )}

      {activeTab === 'candidatures' && isChef && (
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 800 }}>📋 Candidatures en attente</div>
          {candidatures.length === 0 ? (
            <p style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('teams_no_candidatures')}</p>
          ) : (
            candidatures.map(cand => (
              <div key={cand.id} style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 16 }}>
                <img src={cand.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(cand.profiles?.display_name || 'U')}&background=003DA6&color=fff`}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 800, margin: 0 }}>{cand.profiles?.display_name}</p>
                  <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>
                    {new Date(cand.created_at).toLocaleDateString('fr-FR')}
                    {cand.profiles?.lien_csv && <Link href={`/galerie/${cand.profiles.id}`} style={{ color: '#003DA6', marginLeft: 10, fontWeight: 700 }}>Voir sa galerie →</Link>}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => accepterCandidature(cand)} style={{ background: '#e8f5e9', color: '#2e7d32', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>✓ Accepter</button>
                  <button onClick={() => refuserCandidature(cand)} style={{ background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>✗ Refuser</button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
