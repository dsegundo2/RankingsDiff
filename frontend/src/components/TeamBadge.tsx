import type { CSSProperties } from 'react'
import type { TeamAsset } from '../types'
import { hasTeamLogo } from '../data/teams'

type Props = { team: string; asset?: TeamAsset }

export function TeamBadge({ team, asset }: Props) {
  const accent = asset?.color ? `#${asset.color.replace(/^#/, '')}` : undefined
  if (hasTeamLogo(asset)) {
    return (
      <span className="team-badge" style={{ '--team-color': accent } as CSSProperties} title={asset?.displayName ?? team}>
        <img src={asset?.logo} alt="" loading="lazy" width="28" height="28" />
      </span>
    )
  }
  return (
    <span className="team-badge team-badge--fallback" style={{ '--team-color': accent } as CSSProperties} title={asset?.displayName ?? team}>
      {team || 'FA'}
    </span>
  )
}
