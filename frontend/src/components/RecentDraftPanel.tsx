import type { RankingRow, TeamAsset } from '../types'
import { rankingId } from '../data/draftState'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = { rows: RankingRow[]; drafted: Set<string>; teams: Record<string, TeamAsset> }

/** A compact, chronological audit trail for draft picks. */
export function RecentDraftPanel({ rows, drafted, teams }: Props) {
  const rowById = new Map(rows.map((row) => [rankingId(row), row]))
  const picks = [...drafted].map((id) => rowById.get(id)).filter((row): row is RankingRow => Boolean(row)).reverse()

  return (
    <section className="recent-draft" aria-label="Recent draft picks">
      <div className="recent-draft__header">
        <div><span className="eyebrow">Draft log</span><h2>Recent picks</h2><p>{picks.length ? 'Newest pick is at the top.' : 'Mark a player drafted to start a running pick log.'}</p></div>
        <strong className="recent-draft__count">{picks.length}</strong>
      </div>
      {picks.length ? <ol className="recent-draft__list">
        {picks.slice(0, 5).map((row, index) => {
          const team = normalizeTeamAbbreviation(row.team)
          return <li key={rankingId(row)}>
            <div className="recent-draft__meta"><span className="recent-draft__pick">{index === 0 ? 'Last pick' : `Pick ${picks.length - index}`}</span><span className={`recent-draft__pos pos-${row.positionTone ?? 'other'}`}>{row.position}</span></div>
            <div className="recent-draft__player"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><span><strong>{row.player}</strong><small>{row.team}</small></span></div>
          </li>
        })}
      </ol> : null}
    </section>
  )
}
