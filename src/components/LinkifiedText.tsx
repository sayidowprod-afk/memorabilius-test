'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { SPORTS_TEAMS, teamLogoUrl } from '@/lib/sportsTeams'
import { teamSlug as toTeamSlug } from '@/lib/playerSlug'

// ── Liens dans le chat/messages : détection URL + aperçu riche pour les liens Memorabilius ──
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
        if (cancelled) return
        // Si la fiche n'existe plus en DB (supprimée/modifiée depuis le partage du
        // lien), on affiche quand même la miniature de l'image (le fichier peut
        // encore exister) plutôt qu'un lien nu sans aucun aperçu
        setData(c
          ? { title: c.nom, subtitle: [c.annee, c.marque].filter(Boolean).join(' · '), img: c.image_recto, icon: '🃏' }
          : { title: 'Carte', subtitle: undefined, img: parsed.card, icon: '🃏' })
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

export default function LinkifiedText({ text }: { text: string }) {
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
