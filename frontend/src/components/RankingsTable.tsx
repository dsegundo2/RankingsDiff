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

function diffSignalStyle(diff?: number): CSSProperties {
  if (typeof diff !== 'number' || !Number.isFinite(diff) || diff === 0) return {}
  const magnitude = Math.min(Math.abs(diff), 24)
  const alpha = 0.05 + (magnitude / 24) * 0.25
  return { '--diff-alpha': alpha.toFixed(3) } as CSSProperties
}

function SortButton({ label, sortKey, activeKey, direction, onSort }: { label: string; sortKey: SortKey; activeKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void }) {
  return <button className="sort-button" onClick={() => onSort(sortKey)}>{label}{activeKey === sortKey ? <span>{direction === 'asc' ? ' ↑' : ' ↓'}</span> : null}</button>
}

export function RankingsTable({ rows, teams, source, sortKey, sortDirection, targets, drafted, onSort, onTarget, onDrafted }: Props) {
  const isEspn = source === 'espn'
  return (
    <div className="table-wrap">
      <table className="rankings-table">
        <thead>
          <tr>
            <th className="action-heading"><span className="sr-only">Target</span></th>
            <th><SortButton label="Player" sortKey="player" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th><SortButton label="Pos" sortKey="position" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th><SortButton label={sourceLabel(source)} sortKey="sourceRank" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th><SortButton label="Underdog" sortKey="underdogRank" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            {isEspn ? <th><SortButton label="ESPN $" sortKey="sourceValue" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th> : null}
            {isEspn ? <th><SortButton label="UD $" sortKey="underdogValue" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th> : null}
            <th><SortButton label={isEspn ? 'Value diff' : 'Diff'} sortKey="diff" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th>Draft</th>
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
                style={diffSignalStyle(row.diff)}
              >
                <td className="row-action"><button className={`icon-action target-action ${isTarget ? 'active' : ''}`} type="button" aria-label={`${isTarget ? 'Remove target' : 'Target'} ${row.player}`} aria-pressed={isTarget} onClick={() => onTarget(id)}>★</button></td>
                <td className="player-cell">
                  <TeamBadge team={team} asset={asset} />
                  <div><strong>{row.player}</strong><span>{team}</span></div>
                </td>
                <td><span className={`pos-chip pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span></td>
                <td className="num">{formatRank(row.sourceRank)}</td>
                <td className="num">{formatRank(row.underdogRank)}</td>
                {isEspn ? <td className="num">{formatValue(row.sourceValue)}</td> : null}
                {isEspn ? <td className="num">{formatValue(row.underdogValue)}</td> : null}
                <td className="num emphasis">{isEspn ? formatSignedValue(row.diff) : formatRank(row.diff)}</td>
                <td><button className={`draft-action ${isDrafted ? 'active' : ''}`} type="button" aria-label={`${isDrafted ? 'Undo drafted' : 'Mark drafted'} ${row.player}`} onClick={() => onDrafted(id)}>{isDrafted ? 'Undo' : 'Draft'}</button></td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty-state">No players match the current filters.</div>}
    </div>
  )
}
