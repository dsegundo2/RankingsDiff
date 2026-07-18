import type { CSSProperties } from 'react'
import type { RankingRow, RankingSource, TeamAsset } from '../types'
import { formatRank, formatSignedValue, formatValue, sourceLabel } from '../data/rankings'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = { row: RankingRow; teams: Record<string, TeamAsset>; source: RankingSource; targeted?: boolean; drafted?: boolean; onTarget?: () => void; onDrafted?: () => void }

function diffSignalStyle(diff?: number): CSSProperties {
  if (typeof diff !== 'number' || !Number.isFinite(diff) || diff === 0) return {}
  const magnitude = Math.min(Math.abs(diff), 24)
  const alpha = 0.05 + (magnitude / 24) * 0.25
  return { '--diff-alpha': alpha.toFixed(3) } as CSSProperties
}

function diffDirectionClass(diff?: number): string {
  if (typeof diff !== 'number' || !Number.isFinite(diff) || diff === 0) return 'diff-neutral'
  return diff > 0 ? 'diff-positive' : 'diff-negative'
}

export function RankingCard({ row, teams, source, targeted = false, drafted = false, onTarget, onDrafted }: Props) {
  const team = normalizeTeamAbbreviation(row.team)
  const asset = getTeamAsset(teams, team)
  return (
    <article className={`ranking-card ${diffDirectionClass(row.diff)} pos-${row.positionTone ?? 'other'} ${drafted ? 'is-drafted' : ''}`} style={diffSignalStyle(row.diff)}>
      <div className="ranking-card__header"><div className="player-line">
        <TeamBadge team={team} asset={asset} />
        <div>
          <strong>{row.player}</strong>
          <span>{team} · {row.positionRank ?? row.position}</span>
        </div>
      </div><span className={`pos-chip pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span></div>
      <dl>
        <div><dt>{sourceLabel(source)} rank</dt><dd>{formatRank(row.sourceRank)}</dd></div>
        <div><dt>Underdog</dt><dd>{formatRank(row.underdogRank)}</dd></div>
        <div><dt>{source === 'espn' ? 'Salary cap diff' : 'Diff'}</dt><dd>{source === 'espn' ? `${formatSignedValue(row.diff)} (${formatValue(row.sourceValue)} / ${formatValue(row.underdogValue)})` : formatRank(row.diff)}</dd></div>
      </dl>
      <div className="ranking-card__actions"><button className={`target-action ${targeted ? 'active' : ''}`} type="button" aria-pressed={targeted} onClick={onTarget}>★ {targeted ? 'Targeted' : 'Target'}</button><button className={`draft-action ${drafted ? 'active' : ''}`} type="button" onClick={onDrafted}>{drafted ? 'Undo drafted' : 'Mark drafted'}</button></div>
    </article>
  )
}
