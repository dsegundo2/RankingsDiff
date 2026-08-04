import type { RankingRow } from '../types'
import { formatValue } from '../data/rankings'
import { rankingId } from '../data/draftState'

type Props = { rows: RankingRow[]; drafted: Set<string>; source: string }

/** A compact, chronological audit trail for draft picks. */
export function RecentDraftPanel({ rows, drafted, source }: Props) {
  const rowById = new Map(rows.map((row) => [rankingId(row), row]))
  const picks = [...drafted].map((id) => rowById.get(id)).filter((row): row is RankingRow => Boolean(row)).reverse()

  return (
    <section className="recent-draft" aria-label="Recent draft picks">
      <div className="recent-draft__header">
        <div><span className="eyebrow">Draft log</span><h2>Recent picks</h2><p>{picks.length ? 'Newest pick is at the top.' : 'Mark a player drafted to start a running pick log.'}</p></div>
        <strong className="recent-draft__count">{picks.length}</strong>
      </div>
      {picks.length ? <ol className="recent-draft__list">
        {picks.slice(0, 8).map((row, index) => {
          const suggested = row.adjustedValue ?? row.sourceValue
          const paid = row.sourceValue ?? row.adjustedValue
          return <li key={rankingId(row)}>
            <span className="recent-draft__pick">{index === 0 ? 'Last pick' : `Pick ${picks.length - index}`}</span>
            <span className={`recent-draft__pos pos-${row.positionTone ?? 'other'}`}>{row.position}</span>
            <span className="recent-draft__player"><strong>{row.player}</strong><small>{row.team}</small></span>
            {source === 'espn' ? <span className="recent-draft__values" aria-label={`Total ${formatValue(paid)}; suggested ${formatValue(suggested)}`}><strong>{formatValue(paid)}</strong><small>total · {formatValue(suggested)} suggested</small></span> : null}
          </li>
        })}
      </ol> : null}
    </section>
  )
}
