'use client'
import { useEffect, useState, useRef, use, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { useLang } from '@/lib/LangContext'
import { SPORTS_TEAMS, teamLogoUrl } from '@/lib/sportsTeams'
import { teamSlug as toTeamSlug } from '@/lib/playerSlug'

const ACCENT = '#003DA6'
const EMOJIS = ['👍', '❤️', '🔥', '😂', '😮', '🏀', '💎', '🐐']

// ── Liens dans le chat : détection URL + aperçu riche pour les liens Memorabilius ──
// Capture les URLs complètes (http/https) ET les liens memorabilius.fr tapés/collés
// sans protocole (ex: "memorabilius.fr/teams/3" ou "www.memorabilius.fr/...")
const URL_REGEX = /(https?:\/\/[^\s]+|(?:www\.)?memorabilius\.fr\/\S+)/gi
const SITE_HOSTS = ['memorabilius.fr', 'www.memorabilius.fr']

function withProtocol(url: string): string {
  return /^https?:\/\//i.test(url) ? url : `https://${url}`
}

type ParsedMemoLink =
  | { type: 'carte'; userId: string; card: string }
  | { type: 'galerie'; userId: string }
  | { type: 'joueur'; slug: string }
  | { type: 'equipe'; slug: string }
  | { type: 'setlist'; id: string }
  | { type: 'teams'; id: string }

function parseMemorabiliusLink(rawUrl: string): ParsedMemoLink | null {
  try {
    const u = new URL(withProtocol(rawUrl))
    if (!SITE_HOSTS.includes(u.hostname) && !u.hostname.endsWith('.vercel.app') && u.hostname !== 'localhost') return null
    const parts = u.pathname.split('/').filter(Boolean)
    if (parts[0] === 'galerie' && parts[1]) {
      const card = u.searchParams.get('card')
      return card ? { type: 'carte', userId: parts[1], card } : { type: 'galerie', userId: parts[1] }
    }
    if (parts[0] === 'joueur' && parts[1]) return { type: 'joueur', slug: parts[1] }
    if (parts[0] === 'equipe' && parts[1]) return { type: 'equipe', slug: parts[1] }
    if (parts[0] === 'setlist' && parts[1]) return { type: 'setlist', id: parts[1] }
    if (parts[0] === 'teams' && parts[1]) return { type: 'teams', id: parts[1] }
    return null
  } catch { return null }
}

function slugToLabel(slug: string) {
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function MemoLinkPreview({ url }: { url: string }) {
  const parsed = parseMemorabiliusLink(url)
  const [data, setData] = useState<{ title: string; subtitle?: string; img?: string | null; icon: string; round?: boolean } | null | undefined>(undefined)

  useEffect(() => {
    if (!parsed) return
    let cancelled = false
    ;(async () => {
      if (parsed.type === 'carte') {
        const { data: c } = await supabase.from('cartes_manuelles').select('nom, image_recto, annee, marque')
          .eq('user_id', parsed.userId).eq('image_recto', parsed.card).maybeSingle()
        if (!cancelled) setData(c ? { title: c.nom, subtitle: [c.annee, c.marque].filter(Boolean).join(' · '), img: c.image_recto, icon: '🃏' } : null)
      } else if (parsed.type === 'galerie') {
        const { data: p } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', parsed.userId).single()
        if (!cancelled) setData(p ? { title: p.display_name, subtitle: 'Collectionneur', img: p.avatar_url, icon: '👤', round: true } : null)
      } else if (parsed.type === 'setlist') {
        const { data: s } = await supabase.from('card_sets').select('name, year, brand').eq('id', parsed.id).single()
        if (!cancelled) setData(s ? { title: s.name, subtitle: [s.year, s.brand].filter(Boolean).join(' · '), icon: '📋' } : null)
      } else if (parsed.type === 'teams') {
        const { data: t } = await supabase.from('teams').select('name, avatar_url').eq('id', parsed.id).single()
        if (!cancelled) setData(t ? { title: t.name, subtitle: 'Team', img: t.avatar_url, icon: '🛡️', round: true } : null)
      } else if (parsed.type === 'joueur') {
        if (!cancelled) setData({ title: slugToLabel(parsed.slug), subtitle: 'Joueur', icon: '🏀' })
      } else if (parsed.type === 'equipe') {
        const team = SPORTS_TEAMS.find(t => toTeamSlug(t.name) === parsed.slug)
        if (!cancelled) setData(team ? { title: team.name, subtitle: team.sport.toUpperCase(), img: teamLogoUrl(team), icon: '🏟️' } : null)
      }
    })()
    return () => { cancelled = true }
  }, [url])

  if (!parsed) {
    return <a href={withProtocol(url)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}>{url}</a>
  }
  if (data === undefined) return <span style={{ opacity: 0.6 }}>{url}</span>
  if (data === null) return <a href={withProtocol(url)} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'underline', wordBreak: 'break-all' }}>{url}</a>

  const href = parsed.type === 'carte' ? `/galerie/${parsed.userId}?card=${encodeURIComponent(parsed.card)}`
    : parsed.type === 'galerie' ? `/galerie/${parsed.userId}`
    : parsed.type === 'joueur' ? `/joueur/${parsed.slug}`
    : parsed.type === 'equipe' ? `/equipe/${parsed.slug}`
    : parsed.type === 'setlist' ? `/setlist/${parsed.id}`
    : `/teams/${parsed.id}`

  return (
    <Link href={href} style={{ textDecoration: 'none', display: 'block', marginTop: 4 }} onClick={e => e.stopPropagation()}>
      <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 6, display: 'flex', gap: 8, alignItems: 'center' }}>
        {data.img
          ? <img src={data.img} style={{ width: 36, height: 36, borderRadius: data.round ? '50%' : 4, objectFit: 'cover', flexShrink: 0 }} alt="" />
          : <span style={{ fontSize: 20, flexShrink: 0 }}>{data.icon}</span>}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{data.title}</div>
          {data.subtitle && <div style={{ fontSize: 10.5, opacity: 0.7 }}>{data.subtitle}</div>}
        </div>
      </div>
    </Link>
  )
}

function LinkifiedText({ text }: { text: string }) {
  // split() avec un groupe capturant alterne texte normal / match : les indices
  // impairs sont toujours les URLs capturées (plus fiable qu'un second regex.test)
  const parts = text.split(URL_REGEX)
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1
          ? <MemoLinkPreview key={i} url={part} />
          : <span key={i}>{part}</span>
      )}
    </>
  )
}

export default function TeamPage({ params }: { params: Promise<{ teamId: string }> }) {
  const { teamId } = use(params)
  const router = useRouter()
  const { t, lang } = useLang()

  const [team, setTeam] = useState<any>(null)
  const [members, setMembers] = useState<any[]>([])
  const [membersStats, setMembersStats] = useState<any[]>([])
  const [messages, setMessages] = useState<any[]>([])
  const [msgReactions, setMsgReactions] = useState<Record<number, { emoji: string; count: number; mine: boolean }[]>>({})
  const [posts, setPosts] = useState<any[]>([])
  const [postReactions, setPostReactions] = useState<Record<number, { emoji: string; count: number; mine: boolean }[]>>({})
  const [candidatures, setCandidatures] = useState<any[]>([])
  const [galerieCards, setGalerieCards] = useState<any[]>([])
  const [currentUser, setCurrentUser] = useState<string | null>(null)
  const [isMember, setIsMember] = useState(false)
  const [isChef, setIsChef] = useState(false)
  const [hasCandidature, setHasCandidature] = useState(false)
  const [activeTab, setActiveTab] = useState<'feed' | 'membres' | 'galerie' | 'chat' | 'candidatures'>('feed')
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const shareTeam = () => {
    const url = `${window.location.origin}/teams/${teamId}`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  // Chat
  const [newMsg, setNewMsg] = useState('')
  const [showEmojiForMsg, setShowEmojiForMsg] = useState<number | null>(null)
  const [showCardPicker, setShowCardPicker] = useState(false)
  const [myCards, setMyCards] = useState<any[]>([])
  const [pendingCard, setPendingCard] = useState<any | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Posts
  const [newPost, setNewPost] = useState('')
  const [postCards, setPostCards] = useState<any[]>([])
  const [showPostCardPicker, setShowPostCardPicker] = useState(false)
  const [showEmojiForPost, setShowEmojiForPost] = useState<number | null>(null)
  const [comments, setComments] = useState<Record<number, any[]>>({})
  const [showComments, setShowComments] = useState<Record<number, boolean>>({})
  const [newComment, setNewComment] = useState<Record<number, string>>({})

  useEffect(() => { init() }, [teamId])
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  const init = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.id || null)

    const { data: teamData } = await supabase.from('teams').select('*').eq('id', parseInt(teamId)).single()
    if (!teamData) { router.push('/teams'); return }
    setTeam(teamData)

    const { data: m } = await supabase.from('team_members')
      .select('*, profiles(id, display_name, avatar_url, lien_csv, couleur_bordure, is_donor)')
      .eq('team_id', parseInt(teamId))
    setMembers(m || [])

    const isMem = m?.some((x: any) => x.user_id === user?.id) || false
    setIsMember(isMem)
    const isFounder = user?.id === teamData.created_by
    const isAdmin = m?.some((x: any) => x.user_id === user?.id && (x.role === 'admin' || x.role === 'chef')) || false
    setIsChef(isFounder || isAdmin)

    loadMembersStats(m || [])
    loadPosts(user?.id || null)
    loadGalerie(m || [])

    if (isMem) {
      loadMessages(user?.id || null)
      if (user) loadMyCards(user.id)
    }

    if (isFounder || isAdmin) {
      const { data: cands } = await supabase.from('team_candidatures')
        .select('*, profiles(id, display_name, avatar_url, lien_csv)')
        .eq('team_id', parseInt(teamId)).eq('statut', 'en_attente')
      setCandidatures(cands || [])
    }

    if (user) {
      const { data: cand } = await supabase.from('team_candidatures')
        .select('id').eq('team_id', parseInt(teamId)).eq('user_id', user.id).single()
      setHasCandidature(!!cand)
    }

    setLoading(false)
  }

  const loadMessages = async (uid: string | null) => {
    const { data: msgs } = await supabase.from('team_messages')
      .select('*, profiles(id, display_name, avatar_url)')
      .eq('team_id', parseInt(teamId))
      .order('created_at', { ascending: true })
    setMessages(msgs || [])

    // Réactions
    if (msgs?.length) {
      const ids = msgs.map((m: any) => m.id)
      const { data: reacts } = await supabase.from('team_message_reactions')
        .select('*').in('message_id', ids)
      buildReactions(reacts || [], ids, uid, setMsgReactions)
    }
  }

  const loadPosts = async (uid: string | null) => {
    const { data: ps } = await supabase.from('team_posts')
      .select('*')
      .eq('team_id', parseInt(teamId))
      .order('created_at', { ascending: false })
    if (!ps?.length) { setPosts([]); return }

    // Charger les profils des auteurs séparément
    const userIds = [...new Set(ps.map((p: any) => p.user_id))]
    const { data: profs } = await supabase.from('profiles')
      .select('id, display_name, avatar_url').in('id', userIds)
    const profMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p]))
    const postsWithProfiles = ps.map((p: any) => ({ ...p, profiles: profMap[p.user_id] || null }))

    // Compter les commentaires
    const { data: counts } = await supabase.from('team_post_comments')
      .select('post_id').in('post_id', ps.map((p: any) => p.id))
    const countMap: Record<number, number> = {}
    for (const c of counts || []) countMap[c.post_id] = (countMap[c.post_id] || 0) + 1

    setPosts(postsWithProfiles.map((p: any) => ({ ...p, commentCount: countMap[p.id] || 0 })))

    const ids = ps.map((p: any) => p.id)
    const { data: reacts } = await supabase.from('team_post_reactions')
      .select('*').in('post_id', ids)
    buildPostReactions(reacts || [], ids, uid)
  }

  const loadGalerie = async (membersList: any[]) => {
    const memberIds = membersList.map((m: any) => m.user_id)
    if (!memberIds.length) return
    const { data } = await supabase.from('cartes_manuelles')
      .select('id, nom, annee, marque, image_recto, user_id, profiles(display_name, avatar_url)')
      .in('user_id', memberIds)
      .order('created_at', { ascending: false })
      .limit(5000)
    const shuffled = (data || []).sort(() => Math.random() - 0.5)
    setGalerieCards(shuffled)
  }

  const loadMyCards = async (uid: string) => {
    const { data, error } = await supabase.from('cartes_manuelles')
      .select('id, nom, annee, marque, image_recto')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(100)
    console.log('[loadMyCards]', { uid, count: data?.length, error })
    setMyCards(data || [])
  }

  const loadMembersStats = async (membersList: any[]) => {
    const stats = await Promise.all(membersList.map(async (m: any) => {
      const profile = m.profiles
      if (!profile) return null
      const { data: p } = await supabase.from('profiles')
        .select('stats_total, stats_rc, stats_auto, stats_num, stats_patch').eq('id', profile.id).single()
      return { ...profile, stats: { total: p?.stats_total || 0, rc: p?.stats_rc || 0, auto: p?.stats_auto || 0, num: p?.stats_num || 0, patch: p?.stats_patch || 0 } }
    }))
    setMembersStats(stats.filter(Boolean).sort((a, b) => (b.stats?.total || 0) - (a.stats?.total || 0)))
  }

  function buildReactions(reacts: any[], ids: number[], uid: string | null, setter: any) {
    const map: Record<number, { emoji: string; count: number; mine: boolean }[]> = {}
    for (const id of ids) {
      const rForMsg = reacts.filter(r => r.message_id === id)
      const byEmoji: Record<string, { count: number; mine: boolean }> = {}
      for (const r of rForMsg) {
        if (!byEmoji[r.emoji]) byEmoji[r.emoji] = { count: 0, mine: false }
        byEmoji[r.emoji].count++
        if (r.user_id === uid) byEmoji[r.emoji].mine = true
      }
      map[id] = Object.entries(byEmoji).map(([emoji, v]) => ({ emoji, ...v }))
    }
    setter(map)
  }

  function buildPostReactions(reacts: any[], ids: number[], uid: string | null) {
    const map: Record<number, { emoji: string; count: number; mine: boolean }[]> = {}
    for (const id of ids) {
      const rForPost = reacts.filter(r => r.post_id === id)
      const byEmoji: Record<string, { count: number; mine: boolean }> = {}
      for (const r of rForPost) {
        if (!byEmoji[r.emoji]) byEmoji[r.emoji] = { count: 0, mine: false }
        byEmoji[r.emoji].count++
        if (r.user_id === uid) byEmoji[r.emoji].mine = true
      }
      map[id] = Object.entries(byEmoji).map(([emoji, v]) => ({ emoji, ...v }))
    }
    setPostReactions(map)
  }

  // Realtime chat
  useEffect(() => {
    if (!isMember) return
    const channel = supabase.channel(`team-chat-${teamId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'team_messages', filter: `team_id=eq.${teamId}` },
        async (payload) => {
          const { data } = await supabase.from('team_messages')
            .select('*, profiles(id, display_name, avatar_url)')
            .eq('id', payload.new.id).single()
          if (data) setMessages(prev => [...prev, data])
        })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [isMember, teamId])

  const sendMessage = async () => {
    if ((!newMsg.trim() && !pendingCard) || !currentUser) return
    await supabase.from('team_messages').insert({
      team_id: parseInt(teamId),
      user_id: currentUser,
      contenu: newMsg.trim() || null,
      card_key: pendingCard?.card_key || null,
      card_user_id: pendingCard ? currentUser : null,
    })
    setNewMsg('')
    setPendingCard(null)
  }

  const toggleMsgReaction = async (msgId: number, emoji: string) => {
    if (!currentUser) return
    const existing = msgReactions[msgId]?.find(r => r.emoji === emoji && r.mine)
    if (existing) {
      const { error } = await supabase.from('team_message_reactions').delete()
        .eq('message_id', msgId).eq('user_id', currentUser).eq('emoji', emoji)
      if (error) { console.error('[toggleMsgReaction delete]', error); return }
    } else {
      // insert simple plutôt qu'upsert : évite de dépendre d'une contrainte
      // unique (message_id,user_id,emoji) qui peut ne pas exister en DB
      const { error } = await supabase.from('team_message_reactions').insert(
        { message_id: msgId, user_id: currentUser, emoji }
      )
      if (error && error.code !== '23505') { console.error('[toggleMsgReaction insert]', error); alert(lang === 'fr' ? `Erreur : ${error.message}` : `Error: ${error.message}`); return }
    }
    setMsgReactions(prev => {
      const cur = prev[msgId] || []
      const updated = existing
        ? cur.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r).filter(r => r.count > 0)
        : cur.find(r => r.emoji === emoji)
          ? cur.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)
          : [...cur, { emoji, count: 1, mine: true }]
      return { ...prev, [msgId]: updated }
    })
    setShowEmojiForMsg(null)
  }

  const createPost = async () => {
    if ((!newPost.trim() && !postCards.length) || !currentUser) return
    const { error } = await supabase.from('team_posts').insert({
      team_id: parseInt(teamId),
      user_id: currentUser,
      content: newPost.trim() || null,
      card_ids: postCards.map(c => c.id),
    })
    console.log('[createPost error]', error)
    setNewPost('')
    setPostCards([])
    loadPosts(currentUser)
  }

  const togglePostReaction = async (postId: number, emoji: string) => {
    if (!currentUser) return
    const existing = postReactions[postId]?.find(r => r.emoji === emoji && r.mine)
    if (existing) {
      const { error } = await supabase.from('team_post_reactions').delete()
        .eq('post_id', postId).eq('user_id', currentUser).eq('emoji', emoji)
      if (error) { console.error('[togglePostReaction delete]', error); return }
    } else {
      // insert simple plutôt qu'upsert : évite de dépendre d'une contrainte
      // unique (post_id,user_id,emoji) qui peut ne pas exister en DB
      const { error } = await supabase.from('team_post_reactions').insert(
        { post_id: postId, user_id: currentUser, emoji }
      )
      if (error && error.code !== '23505') { console.error('[togglePostReaction insert]', error); alert(lang === 'fr' ? `Erreur : ${error.message}` : `Error: ${error.message}`); return }
    }
    setPostReactions(prev => {
      const cur = prev[postId] || []
      const updated = existing
        ? cur.map(r => r.emoji === emoji ? { ...r, count: r.count - 1, mine: false } : r).filter(r => r.count > 0)
        : cur.find(r => r.emoji === emoji)
          ? cur.map(r => r.emoji === emoji ? { ...r, count: r.count + 1, mine: true } : r)
          : [...cur, { emoji, count: 1, mine: true }]
      return { ...prev, [postId]: updated }
    })
    setShowEmojiForPost(null)
  }

  const deletePost = async (postId: number) => {
    await supabase.from('team_posts').delete().eq('id', postId).eq('user_id', currentUser)
    setPosts(prev => prev.filter(p => p.id !== postId))
  }

  const enrichWithProfiles = async (rows: any[]) => {
    if (!rows.length) return rows
    const uids = [...new Set(rows.map(r => r.user_id))]
    const { data: profs } = await supabase.from('profiles').select('id, display_name, avatar_url').in('id', uids)
    const map = Object.fromEntries((profs || []).map(p => [p.id, p]))
    return rows.map(r => ({ ...r, profiles: map[r.user_id] || null }))
  }

  const loadComments = async (postId: number) => {
    const { data } = await supabase.from('team_post_comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
    const enriched = await enrichWithProfiles(data || [])
    setComments(prev => ({ ...prev, [postId]: enriched }))
    setShowComments(prev => ({ ...prev, [postId]: true }))
  }

  const addComment = async (postId: number) => {
    const content = newComment[postId]?.trim()
    if (!content || !currentUser) return
    const { data, error } = await supabase.from('team_post_comments').insert({
      post_id: postId, user_id: currentUser, content
    }).select('*').single()
    if (error) { console.error('[addComment]', error); alert(lang === 'fr' ? 'Erreur lors de l\'envoi du commentaire' : 'Error sending comment'); return }
    if (data) {
      const [enriched] = await enrichWithProfiles([data])
      setComments(prev => ({ ...prev, [postId]: [...(prev[postId] || []), enriched] }))
      setPosts(prev => prev.map(p => p.id === postId ? { ...p, commentCount: (p.commentCount || 0) + 1 } : p))
    }
    setNewComment(prev => ({ ...prev, [postId]: '' }))
  }

  const deleteComment = async (postId: number, commentId: number) => {
    await supabase.from('team_post_comments').delete().eq('id', commentId).eq('user_id', currentUser)
    setComments(prev => ({ ...prev, [postId]: (prev[postId] || []).filter(c => c.id !== commentId) }))
  }

  const postuler = async () => {
    if (!currentUser) { router.push('/connexion'); return }
    await supabase.from('team_candidatures').insert({ team_id: parseInt(teamId), user_id: currentUser })
    setHasCandidature(true)
  }

  const accepterCandidature = async (cand: any) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/team-accept', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ candidatureId: cand.id, teamId: parseInt(teamId), userId: cand.user_id, action: 'accept' }) })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
      alert(lang === 'fr' ? `Erreur lors de l'acceptation : ${error}` : `Error accepting: ${error}`)
      return
    }
    setCandidatures(prev => prev.filter(c => c.id !== cand.id))
    init()
  }

  const refuserCandidature = async (cand: any) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/team-accept', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token}` },
      body: JSON.stringify({ candidatureId: cand.id, teamId: parseInt(teamId), userId: cand.user_id, action: 'refuse' }) })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Erreur inconnue' }))
      alert(lang === 'fr' ? `Erreur : ${error}` : `Error: ${error}`)
      return
    }
    setCandidatures(prev => prev.filter(c => c.id !== cand.id))
  }

  const totalStats = membersStats.reduce((acc, m) => ({
    total: acc.total + (m.stats?.total || 0), rc: acc.rc + (m.stats?.rc || 0),
    auto: acc.auto + (m.stats?.auto || 0), num: acc.num + (m.stats?.num || 0), patch: acc.patch + (m.stats?.patch || 0),
  }), { total: 0, rc: 0, auto: 0, num: 0, patch: 0 })

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'à l\'instant'
    if (m < 60) return `${m}min`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    return `${Math.floor(h / 24)}j`
  }

  if (loading) return <p style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Chargement...</p>

  const tabs = [
    { key: 'feed', label: '📰 Feed' },
    { key: 'membres', label: `👥 ${t('teams_members')} (${members.length})` },
    { key: 'galerie', label: '🖼️ Galerie' },
    ...(isMember ? [{ key: 'chat', label: '💬 Chat' }] : []),
    ...(isChef ? [{ key: 'candidatures', label: `📋 Candidatures (${candidatures.length})` }] : []),
  ]

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 16px', fontFamily: 'Inter, sans-serif' }}
      onClick={() => { setShowEmojiForMsg(null); setShowEmojiForPost(null) }}>
      <style>{`
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

      {/* Header */}
      <div style={{ background: 'white', borderRadius: 16, padding: 28, marginBottom: 20, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          {team.avatar_url
            ? <img src={team.avatar_url} style={{ width: 70, height: 70, borderRadius: '50%', objectFit: 'cover', border: `3px solid ${ACCENT}`, flexShrink: 0 }} alt={team.name} />
            : <div style={{ width: 70, height: 70, borderRadius: '50%', background: ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, fontWeight: 900, color: 'white', flexShrink: 0 }}>{team.name.charAt(0).toUpperCase()}</div>
          }
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontWeight: 900, fontSize: 24, margin: 0 }}>{team.name}</h1>
              {isChef && <Link href={`/teams/${teamId}/editer`} style={{ background: '#f0f0f0', color: '#444', padding: '4px 12px', borderRadius: 6, fontWeight: 700, fontSize: 12, textDecoration: 'none' }}>{t('teams_modify')}</Link>}
            </div>
            {team.description && <p style={{ color: '#666', fontSize: 14, margin: '4px 0 0' }}>{team.description}</p>}
            <p style={{ color: '#999', fontSize: 12, margin: '4px 0 0' }}>{members.length} membre{members.length > 1 ? 's' : ''}</p>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[{ val: totalStats.total, label: 'Cartes', color: ACCENT }, { val: totalStats.rc, label: 'RC', color: '#e67e22' }, { val: totalStats.auto, label: 'Auto', color: '#2e7d32' }].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: 10, color: '#999', textTransform: 'uppercase', fontWeight: 700 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={shareTeam} style={{ background: copied ? '#e8f5e9' : '#f0f0f0', color: copied ? '#2e7d32' : '#555', border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13, transition: 'all 0.2s' }}>
              {copied ? '✓ Copié !' : '🔗 Partager'}
            </button>
            {!isMember && !hasCandidature && currentUser && (
              <button onClick={postuler} style={{ background: ACCENT, color: 'white', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, cursor: 'pointer' }}>{t('teams_join')}</button>
            )}
            {hasCandidature && !isMember && <span style={{ background: '#fff3e0', color: '#e67e22', padding: '10px 16px', borderRadius: 8, fontWeight: 700, fontSize: 13 }}>⏳ En attente</span>}
            {isMember && <span style={{ color: ACCENT, fontWeight: 700 }}>✓ Membre</span>}
            {isMember && !isChef && (
              <button onClick={async () => {
                if (!confirm('Quitter la team ?')) return
                await supabase.from('team_members').delete().eq('team_id', parseInt(teamId)).eq('user_id', currentUser)
                router.push('/teams')
              }} style={{ background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>{t('teams_leave')}</button>
            )}
          </div>
        </div>
      </div>

      {/* Onglets */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)} style={{
            padding: '10px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: activeTab === tab.key ? ACCENT : '#f0f0f0',
            color: activeTab === tab.key ? 'white' : '#333',
          }}>{tab.label}</button>
        ))}
      </div>

      {/* ── FEED ── */}
      {activeTab === 'feed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Créer un post */}
          {isMember && (
            <div style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              <textarea value={newPost} onChange={e => setNewPost(e.target.value)}
                placeholder="Partagez quelque chose avec votre team..."
                style={{ width: '100%', border: '1.5px solid #e0e0e0', borderRadius: 10, padding: '12px 14px', fontSize: 14, resize: 'none', outline: 'none', fontFamily: 'Inter, sans-serif', boxSizing: 'border-box', minHeight: 80 }} />
              {postCards.length > 0 && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', margin: '8px 0' }}>
                  {postCards.map(c => (
                    <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#f5f8ff', borderRadius: 8 }}>
                      {c.image_recto && <img src={c.image_recto} style={{ height: 40, borderRadius: 4, objectFit: 'cover' }} alt="" />}
                      <span style={{ fontSize: 12, fontWeight: 700, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</span>
                      <button onClick={() => setPostCards(prev => prev.filter(x => x.id !== c.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', fontWeight: 700, fontSize: 14, padding: 0 }}>✕</button>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 6 }}>
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => setNewPost(p => p + e)}
                      style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 6 }}
                      onMouseEnter={ev => (ev.currentTarget as HTMLButtonElement).style.background = '#f0f0f0'}
                      onMouseLeave={ev => (ev.currentTarget as HTMLButtonElement).style.background = 'none'}>{e}</button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={e => { e.stopPropagation(); setShowPostCardPicker(v => !v) }}
                    style={{ background: '#f0f4ff', color: ACCENT, border: 'none', borderRadius: 8, padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                    🃏 Carte
                  </button>
                  <button onClick={createPost}
                    style={{ background: ACCENT, color: 'white', border: 'none', borderRadius: 8, padding: '8px 20px', fontWeight: 700, cursor: 'pointer' }}>
                    Publier
                  </button>
                </div>
              </div>
              {showPostCardPicker && (
                <div onClick={e => e.stopPropagation()} style={{ marginTop: 10, maxHeight: 200, overflowY: 'auto' }}>
                  {myCards.length === 0 && <p style={{ textAlign: 'center', color: '#bbb', padding: 20, fontSize: 13 }}>Aucune carte trouvée.</p>}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
                  {myCards.map(c => (
                    <div key={c.id} onClick={() => { setPostCards(prev => prev.find(x => x.id === c.id) ? prev : [...prev, c]); setShowPostCardPicker(false) }}
                      style={{ cursor: 'pointer', borderRadius: 6, overflow: 'hidden', border: '2px solid transparent', transition: 'border-color 0.15s', background: '#f0f0f0', aspectRatio: '2.5/3.5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.borderColor = ACCENT}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.borderColor = 'transparent'}>
                      {c.image_recto
                        ? <img src={c.image_recto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={c.nom} />
                        : <span style={{ fontSize: 10, color: '#999', textAlign: 'center', padding: 4 }}>{c.nom}</span>}
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Liste des posts */}
          {posts.length === 0 && <div style={{ textAlign: 'center', padding: 60, color: '#bbb' }}>Aucun post pour l'instant.</div>}
          {posts.map(post => (
            <div key={post.id} style={{ background: 'white', borderRadius: 16, padding: 20, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <img src={post.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(post.profiles?.display_name || 'U')}&background=003DA6&color=fff`}
                  style={{ width: 38, height: 38, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                <div style={{ flex: 1 }}>
                  <Link href={`/galerie/${post.user_id}`} style={{ fontWeight: 800, color: '#111', textDecoration: 'none', fontSize: 14 }}>{post.profiles?.display_name || 'Membre'}</Link>
                  <div style={{ fontSize: 11, color: '#bbb' }}>{timeAgo(post.created_at)}</div>
                </div>
                {post.user_id === currentUser && (
                  <button onClick={() => { if (confirm('Supprimer ce post ?')) deletePost(post.id) }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', fontSize: 16, padding: 4 }}>🗑️</button>
                )}
              </div>
              {/* Contenu */}
              {post.content && <p style={{ fontSize: 15, color: '#222', margin: '0 0 12px', lineHeight: 1.6 }}><LinkifiedText text={post.content} /></p>}
              {post.card_ids?.length > 0 && <PostCardsPreview cardIds={post.card_ids} userId={post.user_id} />}
              {post.card_key && post.card_user_id && !post.card_ids?.length && <CardPreview cardKey={post.card_key} userId={post.card_user_id} />}
              {/* Réactions */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, alignItems: 'center' }}>
                {(postReactions[post.id] || []).map(r => (
                  <button key={r.emoji} onClick={e => { e.stopPropagation(); togglePostReaction(post.id, r.emoji) }}
                    style={{ padding: '4px 10px', borderRadius: 20, border: `1.5px solid ${r.mine ? ACCENT : '#e0e0e0'}`, background: r.mine ? '#f0f4ff' : 'white', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: r.mine ? ACCENT : '#333' }}>
                    {r.emoji} {r.count}
                  </button>
                ))}
                {isMember && (
                  <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowEmojiForPost(showEmojiForPost === post.id ? null : post.id)}
                      style={{ padding: '4px 10px', borderRadius: 20, border: '1.5px solid #e0e0e0', background: 'white', cursor: 'pointer', fontSize: 13, color: '#999' }}>
                      + 😊
                    </button>
                    {showEmojiForPost === post.id && (
                      <div style={{ position: 'absolute', bottom: 36, left: 0, background: 'white', borderRadius: 12, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 8, display: 'flex', gap: 4, zIndex: 100 }}>
                        {EMOJIS.map(e => (
                          <button key={e} onClick={() => togglePostReaction(post.id, e)}
                            style={{ fontSize: 20, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6 }}
                            onMouseEnter={ev => (ev.currentTarget as HTMLButtonElement).style.background = '#f0f0f0'}
                            onMouseLeave={ev => (ev.currentTarget as HTMLButtonElement).style.background = 'none'}>{e}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {/* Bouton commentaires */}
                <button onClick={() => showComments[post.id] ? setShowComments(p => ({ ...p, [post.id]: false })) : loadComments(post.id)}
                  style={{ marginLeft: 'auto', padding: '4px 10px', borderRadius: 20, border: '1.5px solid #e0e0e0', background: 'white', cursor: 'pointer', fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
                  💬 {post.commentCount ?? 0}
                </button>
              </div>
              {/* Section commentaires */}
              {showComments[post.id] && (
                <div style={{ marginTop: 16, borderTop: '1px solid #f0f0f0', paddingTop: 16 }}>
                  {(comments[post.id] || []).map(c => (
                    <div key={c.id} style={{ display: 'flex', gap: 8, marginBottom: 12, alignItems: 'flex-start' }}>
                      <img src={c.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.profiles?.display_name || 'U')}&background=003DA6&color=fff`}
                        style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                      <div style={{ flex: 1, background: '#f5f7ff', borderRadius: 10, padding: '8px 12px' }}>
                        <span style={{ fontWeight: 800, fontSize: 12, color: ACCENT }}>{c.profiles?.display_name || 'Membre'}</span>
                        <span style={{ fontSize: 11, color: '#bbb', marginLeft: 8 }}>{timeAgo(c.created_at)}</span>
                        <p style={{ margin: '4px 0 0', fontSize: 13, color: '#222' }}>{c.content}</p>
                      </div>
                      {c.user_id === currentUser && (
                        <button onClick={() => deleteComment(post.id, c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ccc', fontSize: 12, padding: 2, flexShrink: 0 }}>✕</button>
                      )}
                    </div>
                  ))}
                  {isMember && (
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <input value={newComment[post.id] || ''} onChange={e => setNewComment(p => ({ ...p, [post.id]: e.target.value }))}
                        onKeyDown={e => e.key === 'Enter' && addComment(post.id)}
                        placeholder="Ajouter un commentaire..."
                        style={{ flex: 1, border: '1.5px solid #e0e0e0', borderRadius: 20, padding: '8px 14px', fontSize: 13, outline: 'none', fontFamily: 'Inter, sans-serif' }} />
                      <button onClick={() => addComment(post.id)}
                        style={{ background: ACCENT, color: 'white', border: 'none', borderRadius: 20, padding: '8px 16px', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}>
                        Envoyer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── MEMBRES ── */}
      {activeTab === 'membres' && (
        <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>
              {['#', t('teams_collector'), t('teams_role'), 'Cartes', 'RC', 'Auto', 'Num', 'Patch', ...(isChef ? ['Actions'] : [])].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: 11, textTransform: 'uppercase', color: '#999', borderBottom: '2px solid #f0f0f0', background: '#fdfdfd' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {membersStats.map((m, i) => {
                const memberData = members.find((x: any) => x.user_id === m.id)
                const role = m.id === team.created_by ? 'chef' : (memberData?.role || 'member')
                return (
                  <tr key={m.id}>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5', fontWeight: 900, fontSize: 16, color: i === 0 ? '#f39c12' : i === 1 ? '#95a5a6' : i === 2 ? '#cd7f32' : '#bbb' }}>
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <img src={m.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(m.display_name || 'U')}&background=003DA6&color=fff`}
                          style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', border: `2px solid ${m.couleur_bordure || ACCENT}` }} alt="" />
                        <Link href={`/galerie/${m.id}`} className={m.is_donor ? 'holo-name' : ''} style={{ fontWeight: 800, color: m.is_donor ? undefined : '#111', textDecoration: 'none' }}>{m.display_name}</Link>
                        {m.is_donor && <span title="Donateur Ko-fi" style={{ fontSize: 14, lineHeight: 1 }}>☕</span>}
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5' }}>
                      {role === 'chef' && <span style={{ fontSize: 11, background: ACCENT, color: 'white', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>👑 Chef</span>}
                      {role === 'admin' && <span style={{ fontSize: 11, background: '#e8f5e9', color: '#2e7d32', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>⭐ Admin</span>}
                      {role === 'member' && <span style={{ fontSize: 11, background: '#f0f0f0', color: '#666', padding: '3px 8px', borderRadius: 4, fontWeight: 700 }}>Membre</span>}
                    </td>
                    {[m.stats?.total, m.stats?.rc, m.stats?.auto, m.stats?.num, m.stats?.patch].map((val, vi) => (
                      <td key={vi} style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5' }}>
                        <span style={{ background: ['#f0f0f0','#e67e22','#2e7d32','#7b1fa2','#1976d2'][vi], color: vi === 0 ? '#333' : 'white', padding: '3px 8px', borderRadius: 6, fontWeight: 700, fontSize: 12 }}>{val || 0}</span>
                      </td>
                    ))}
                    {isChef && (
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid #f5f5f5' }}>
                        {role !== 'chef' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={async () => {
                              const newRole = role === 'admin' ? 'member' : 'admin'
                              await supabase.from('team_members').update({ role: newRole }).eq('team_id', parseInt(teamId)).eq('user_id', m.id)
                              init()
                            }} style={{ background: role === 'admin' ? '#fff5f5' : '#e8f5e9', color: role === 'admin' ? '#e74c3c' : '#2e7d32', border: 'none', borderRadius: 6, padding: '5px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                              {role === 'admin' ? t('teams_demote') : t('teams_promote')}
                            </button>
                            <button onClick={async () => {
                              if (!confirm(`Exclure ${m.display_name} ?`)) return
                              await supabase.from('team_members').delete().eq('team_id', parseInt(teamId)).eq('user_id', m.id)
                              init()
                            }} style={{ background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 6, padding: '5px 10px', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>🚫</button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── GALERIE COMMUNE ── */}
      {activeTab === 'galerie' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
            {galerieCards.length === 0 && <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#bbb', padding: 60 }}>Aucune carte trouvée.</p>}
            {galerieCards.map(card => (
              <Link key={card.id} href={`/galerie/${card.user_id}`} style={{ textDecoration: 'none' }}>
                <div style={{ borderRadius: 10, overflow: 'hidden', background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)', transition: 'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 6px 20px rgba(0,0,0,0.14)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)' }}>
                  {card.image_recto
                    ? <img src={card.image_recto} style={{ width: '100%', aspectRatio: '2.5/3.5', objectFit: 'cover', display: 'block' }} alt={card.nom} />
                    : <div style={{ width: '100%', aspectRatio: '2.5/3.5', background: 'linear-gradient(135deg, #f0f4ff, #e8eef8)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 8 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: ACCENT, textAlign: 'center' }}>{card.nom}</span>
                      </div>
                  }
                  <div style={{ padding: '6px 8px' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: '#111', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.nom}</div>
                    <div style={{ fontSize: 10, color: '#999', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <img src={card.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(card.profiles?.display_name || 'U')}&background=003DA6&color=fff&size=20`}
                        style={{ width: 14, height: 14, borderRadius: '50%' }} alt="" />
                      {card.profiles?.display_name}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ── CHAT ── */}
      {activeTab === 'chat' && isMember && (
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', display: 'flex', flexDirection: 'column', height: 560 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #f0f0f0', fontWeight: 800, fontSize: 15 }}>💬 Chat en direct</div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && <p style={{ textAlign: 'center', color: '#bbb', marginTop: 40 }}>{t('teams_no_message')}</p>}
            {messages.map(msg => {
              const isMe = msg.user_id === currentUser
              return (
                <div key={msg.id} style={{ display: 'flex', gap: 8, flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end' }}>
                  <img src={msg.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(msg.profiles?.display_name || 'U')}&background=003DA6&color=fff`}
                    style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} alt="" />
                  <div style={{ maxWidth: '72%' }}>
                    {!isMe && <p style={{ fontSize: 11, color: '#999', margin: '0 0 3px', fontWeight: 700 }}>{msg.profiles?.display_name}</p>}
                    <div style={{ background: isMe ? ACCENT : '#f0f0f0', color: isMe ? 'white' : '#121212', padding: '10px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize: 14, lineHeight: 1.5 }}>
                      {msg.contenu && <LinkifiedText text={msg.contenu} />}
                      {msg.card_key && msg.card_user_id && <CardPreview cardKey={msg.card_key} userId={msg.card_user_id} compact />}
                    </div>
                    {/* Réactions sur messages */}
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 4, justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                      {(msgReactions[msg.id] || []).map(r => (
                        <button key={r.emoji} onClick={e => { e.stopPropagation(); toggleMsgReaction(msg.id, r.emoji) }}
                          style={{ padding: '2px 8px', borderRadius: 12, border: `1.5px solid ${r.mine ? ACCENT : '#e0e0e0'}`, background: r.mine ? '#f0f4ff' : 'white', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                          {r.emoji} {r.count}
                        </button>
                      ))}
                      <div style={{ position: 'relative' }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowEmojiForMsg(showEmojiForMsg === msg.id ? null : msg.id)}
                          style={{ padding: '2px 6px', borderRadius: 12, border: '1.5px solid #e0e0e0', background: 'white', cursor: 'pointer', fontSize: 11, color: '#bbb' }}>+</button>
                        {showEmojiForMsg === msg.id && (
                          <div style={{ position: 'absolute', bottom: 28, left: isMe ? 'auto' : 0, right: isMe ? 0 : 'auto', background: 'white', borderRadius: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.15)', padding: 6, display: 'flex', gap: 2, zIndex: 100 }}>
                            {EMOJIS.map(e => (
                              <button key={e} onClick={() => toggleMsgReaction(msg.id, e)}
                                style={{ fontSize: 18, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', borderRadius: 4 }}
                                onMouseEnter={ev => (ev.currentTarget as HTMLButtonElement).style.background = '#f0f0f0'}
                                onMouseLeave={ev => (ev.currentTarget as HTMLButtonElement).style.background = 'none'}>{e}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <p style={{ fontSize: 10, color: '#bbb', margin: '2px 0 0', textAlign: isMe ? 'right' : 'left' }}>
                      {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>
          {/* Carte en attente */}
          {pendingCard && (
            <div style={{ padding: '6px 16px', background: '#f5f8ff', display: 'flex', alignItems: 'center', gap: 8, borderTop: '1px solid #e8eef8' }}>
              {pendingCard.image_recto && <img src={pendingCard.image_recto} style={{ height: 40, borderRadius: 4 }} alt="" />}
              <span style={{ fontSize: 13, fontWeight: 700, flex: 1 }}>{pendingCard.nom}</span>
              <button onClick={() => setPendingCard(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e74c3c', fontWeight: 700 }}>✕</button>
            </div>
          )}
          {/* Card picker */}
          {showCardPicker && (
            <div style={{ padding: '8px 16px', borderTop: '1px solid #f0f0f0', maxHeight: 160, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(60px, 1fr))', gap: 4 }}>
              {myCards.map(c => (
                <div key={c.id} onClick={() => { setPendingCard(c); setShowCardPicker(false) }}
                  style={{ cursor: 'pointer', borderRadius: 4, overflow: 'hidden', background: '#f0f0f0', aspectRatio: '2.5/3.5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.image_recto
                    ? <img src={c.image_recto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={c.nom} />
                    : <span style={{ fontSize: 9, color: '#999', textAlign: 'center', padding: 2 }}>{c.nom}</span>}
                </div>
              ))}
            </div>
          )}
          <div style={{ padding: '10px 14px', borderTop: '1px solid #f0f0f0', display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setShowCardPicker(!showCardPicker)}
              style={{ background: '#f0f4ff', color: ACCENT, border: 'none', borderRadius: 8, padding: '10px 12px', fontWeight: 700, cursor: 'pointer', fontSize: 18, flexShrink: 0 }}>🃏</button>
            <input value={newMsg} onChange={e => setNewMsg(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Votre message..." style={{ flex: 1, padding: '10px 14px', border: '1.5px solid #e0e0e0', borderRadius: 8, fontSize: 14, outline: 'none' }} />
            <button onClick={sendMessage} style={{ background: ACCENT, color: 'white', border: 'none', borderRadius: 8, padding: '10px 18px', fontWeight: 700, cursor: 'pointer' }}>{t('teams_send')}</button>
          </div>
        </div>
      )}

      {/* ── CANDIDATURES ── */}
      {activeTab === 'candidatures' && isChef && (
        <div style={{ background: 'white', borderRadius: 16, boxShadow: '0 4px 20px rgba(0,0,0,0.06)', overflow: 'hidden' }}>
          <div style={{ padding: '14px 20px', borderBottom: '1px solid #f0f0f0', fontWeight: 800 }}>📋 Candidatures en attente</div>
          {candidatures.length === 0
            ? <p style={{ textAlign: 'center', padding: 40, color: '#bbb' }}>{t('teams_no_candidatures')}</p>
            : candidatures.map(cand => (
              <div key={cand.id} style={{ padding: '16px 20px', borderBottom: '1px solid #f5f5f5', display: 'flex', alignItems: 'center', gap: 16 }}>
                <img src={cand.profiles?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(cand.profiles?.display_name || 'U')}&background=003DA6&color=fff`}
                  style={{ width: 44, height: 44, borderRadius: '50%', objectFit: 'cover' }} alt="" />
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 800, margin: 0 }}>{cand.profiles?.display_name}</p>
                  <p style={{ fontSize: 12, color: '#999', margin: '2px 0 0' }}>
                    {new Date(cand.created_at).toLocaleDateString('fr-FR')}
                    {cand.profiles?.id && <Link href={`/galerie/${cand.profiles.id}`} style={{ color: ACCENT, marginLeft: 10, fontWeight: 700, textDecoration: 'none' }}>Voir sa galerie →</Link>}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => accepterCandidature(cand)} style={{ background: '#e8f5e9', color: '#2e7d32', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>✓ Accepter</button>
                  <button onClick={() => refuserCandidature(cand)} style={{ background: '#fff5f5', color: '#e74c3c', border: 'none', borderRadius: 8, padding: '8px 16px', fontWeight: 700, cursor: 'pointer' }}>✗ Refuser</button>
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  )
}

// ── Aperçu plusieurs cartes dans un post ──────────────────────────────────
function PostCardsPreview({ cardIds, userId }: { cardIds: number[]; userId: string }) {
  const [cards, setCards] = useState<any[]>([])
  useEffect(() => {
    supabase.from('cartes_manuelles').select('id, nom, image_recto, annee, marque')
      .in('id', cardIds)
      .then(({ data }) => setCards(data || []))
  }, [cardIds.join(',')])

  if (!cards.length) return null
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(cards.length, 4)}, 1fr)`, gap: 8, marginTop: 10 }}>
      {cards.map(c => (
        <Link key={c.id} href={`/galerie/${userId}`} style={{ textDecoration: 'none' }}>
          <div style={{ borderRadius: 8, overflow: 'hidden', background: '#f0f0f0', aspectRatio: '2.5/3.5' }}>
            {c.image_recto
              ? <img src={c.image_recto} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={c.nom} />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: '#003DA6', textAlign: 'center' }}>{c.nom}</span>
                </div>}
          </div>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#333', marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nom}</div>
        </Link>
      ))}
    </div>
  )
}

// ── Composant aperçu carte ─────────────────────────────────────────────────
function CardPreview({ cardKey, userId, compact }: { cardKey: string; userId: string; compact?: boolean }) {
  const [card, setCard] = useState<any>(null)
  useEffect(() => {
    supabase.from('cartes_manuelles').select('nom, image_recto, annee, marque')
      .eq('card_key', cardKey).eq('user_id', userId).single()
      .then(({ data }) => setCard(data))
  }, [cardKey, userId])

  if (!card) return null
  return (
    <Link href={`/galerie/${userId}`} style={{ textDecoration: 'none', display: 'block', marginTop: compact ? 6 : 10 }}>
      <div style={{ background: 'rgba(0,0,0,0.06)', borderRadius: 8, padding: 8, display: 'flex', gap: 10, alignItems: 'center' }}>
        {card.image_recto && <img src={card.image_recto} style={{ height: compact ? 48 : 64, borderRadius: 4, objectFit: 'cover' }} alt="" />}
        <div>
          <div style={{ fontWeight: 800, fontSize: 13 }}>{card.nom}</div>
          <div style={{ fontSize: 11, opacity: 0.7 }}>{card.annee} · {card.marque}</div>
        </div>
      </div>
    </Link>
  )
}
