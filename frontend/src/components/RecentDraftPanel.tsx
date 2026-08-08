import type { RankingRow, TeamAsset } from '../types'
import { rankingId } from '../data/draftState'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = { rows: RankingRow[]; drafted: Set<string>; mine: Set<string>; teams: Record<string, TeamAsset>; onMine: (id: string) => void }

/** A compact, chronological audit trail for draft picks. */
export function RecentDraftPanel({ rows, drafted, mine, teams, onMine }: Props) {
  const rowById = new Map(rows.map((row) => [rankingId(row), row]))
  const picks = [...drafted].map((id) => rowById.get(id)).filter((row): row is RankingRow => Boolean(row)).reverse()
  if (!picks.length) return null

  return (
    <section className="recent-draft" aria-label="Recent draft picks">
      {picks.length ? <ol className="recent-draft__list">
        {picks.slice(0, 5).map((row, index) => {
          const team = normalizeTeamAbbreviation(row.team)
          const id = rankingId(row)
          const isMine = mine.has(id)
          return <li key={id} className={isMine ? 'is-mine' : ''}>
            <div className="recent-draft__meta"><span className="recent-draft__pick">{index === 0 ? 'Last pick' : `Pick ${picks.length - index}`}</span><button className={`recent-draft__mine ${isMine ? 'active' : ''}`} type="button" aria-label={`${isMine ? 'Remove' : 'Add'} ${row.player} ${isMine ? 'from' : 'to'} my roster`} aria-pressed={isMine} onClick={() => onMine(id)}>{isMine ? '✓' : '+'}</button></div>
            <div className="recent-draft__player"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><span><strong>{row.player}</strong><small>{row.team} · {row.position}</small></span></div>
          </li>
        })}
      </ol> : null}
    </section>
  )
}
