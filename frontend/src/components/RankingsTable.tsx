import type { CSSProperties } from 'react'
import type { RankingRow, RankingSource, SortDirection, SortKey, TeamAsset } from '../types'
import { formatRank, formatSignedValue, formatValue, sourceLabel } from '../data/rankings'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'
import { rankingId } from '../data/draftState'

type Props = {
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  source: RankingSource
  sortKey: SortKey
  sortDirection: SortDirection
  onSort: (key: SortKey) => void
  targets: Set<string>
  drafted: Set<string>
  onTarget: (id: string) => void
  onDrafted: (id: string) => void
}

function diffSignalStyle(diff: number | undefined, isEspn: boolean): CSSProperties {
  const neutralRange = isEspn ? 1 : 3
  if (typeof diff !== 'number' || !Number.isFinite(diff) || Math.abs(diff) <= neutralRange) return {}
  const magnitude = Math.min(Math.abs(diff) - neutralRange, 24)
  const alpha = 0.05 + (magnitude / 24) * 0.25
  return {
    '--diff-alpha': alpha.toFixed(3),
    '--diff-rgb': diff > 0 ? '22 145 92' : '210 52 68'
  } as CSSProperties
}

function SortButton({ label, sortKey, activeKey, direction, onSort }: { label: string; sortKey: SortKey; activeKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void }) {
  return <button className="sort-button" onClick={() => onSort(sortKey)}>{label}{activeKey === sortKey ? <span>{direction === 'asc' ? ' ↑' : ' ↓'}</span> : null}</button>
}

export function RankingsTable({ rows, teams, source, sortKey, sortDirection, targets, drafted, onSort, onTarget, onDrafted }: Props) {
  const isEspn = source === 'espn'
  return (
    <div className="table-wrap">
      <table className={`rankings-table ${isEspn ? 'rankings-table--espn' : 'rankings-table--fpros'}`}>
        <colgroup>
          <col className="col-action" />
          <col className="col-player" />
          <col className="col-position" />
          <col className="col-rank" />
          {isEspn ? <col className="col-money" /> : null}
          <col className="col-diff" />
          <col className="col-draft" />
        </colgroup>
        <thead>
          <tr>
            <th className="action-heading"><span className="sr-only">Target</span></th>
            <th className="player-heading"><SortButton label="Player" sortKey="player" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th className="position-heading"><SortButton label="Pos" sortKey="position" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th className="num-heading rank-heading"><span>Rank</span><small className="rank-heading__sorts"><SortButton label={sourceLabel(source)} sortKey="sourceRank" activeKey={sortKey} direction={sortDirection} onSort={onSort} /><span>→</span><SortButton label="UD" sortKey="underdogRank" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></small></th>
            {isEspn ? <th className="num-heading price-heading"><SortButton label="Price" sortKey="sourceValue" activeKey={sortKey} direction={sortDirection} onSort={onSort} /><small>{sourceLabel(source)} / UD</small></th> : null}
            <th className="num-heading diff-heading"><SortButton label={isEspn ? 'Value diff' : 'Diff'} sortKey="diff" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th className="draft-heading">Draft</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const team = normalizeTeamAbbreviation(row.team)
            const asset = getTeamAsset(teams, team)
            const id = rankingId(row)
            const isTarget = targets.has(id)
            const isDrafted = drafted.has(id)
            return (
              <tr
                key={`${row.player}-${row.team}-${row.sourceRank}`}
                className={`${isDrafted ? 'is-drafted' : ''} pos-${row.positionTone ?? 'other'}`}
                style={diffSignalStyle(row.diff, isEspn)}
              >
                <td className="row-action"><button className={`icon-action target-action ${isTarget ? 'active' : ''}`} type="button" aria-label={`${isTarget ? 'Remove target' : 'Target'} ${row.player}`} aria-pressed={isTarget} onClick={() => onTarget(id)}>★</button></td>
                <td className="player-cell">
                  <TeamBadge team={team} asset={asset} />
                  <div><strong>{row.player}</strong><span>{team}</span></div>
                </td>
                <td className="position-cell"><span className={`pos-chip pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span></td>
                <td className="num rank-cell"><span className="rank-pair"><strong>{formatRank(row.sourceRank)}</strong><span>→</span><strong>{formatRank(row.underdogRank)}</strong></span></td>
                {isEspn ? <td className="num price-cell"><span className="stacked-price"><strong>{formatValue(row.sourceValue)}</strong><small>UD {formatValue(row.underdogValue)}</small></span></td> : null}
                <td className={`num emphasis diff-cell ${typeof row.diff === 'number' && row.diff > 0 ? 'diff-positive' : typeof row.diff === 'number' && row.diff < 0 ? 'diff-negative' : 'diff-neutral'}`}>{isEspn ? formatSignedValue(row.diff) : formatRank(row.diff)}</td>
                <td className="draft-cell"><button className={`draft-action ${isDrafted ? 'active' : ''}`} type="button" aria-label={`${isDrafted ? 'Undo drafted' : 'Mark drafted'} ${row.player}`} onClick={() => onDrafted(id)}>{isDrafted ? 'Undo' : 'Draft'}</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty-state">No players match the current filters.</div>}
    </div>
  )
}
