'use client'
import { getTeamById, teamLogoUrl } from '@/lib/sportsTeams'

interface Props {
  teamId: string
  size?: number
}

export default function TeamBadge({ teamId, size = 28 }: Props) {
  const team = getTeamById(teamId)
  if (!team) return null
  return (
    <img
      src={teamLogoUrl(team)}
      alt={team.name}
      title={team.name}
      width={size}
      height={size}
      style={{ borderRadius: '50%', objectFit: 'contain', flexShrink: 0, display: 'block' }}
      onError={(e) => {
        const el = e.currentTarget
        el.style.display = 'none'
        const span = document.createElement('span')
        span.textContent = team.abbr
        span.style.cssText = `display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:50%;background:${team.color};color:white;font-size:${Math.round(size * 0.32)}px;font-weight:900;letter-spacing:-0.5px;flex-shrink:0`
        el.parentNode?.insertBefore(span, el.nextSibling)
      }}
    />
  )
}
