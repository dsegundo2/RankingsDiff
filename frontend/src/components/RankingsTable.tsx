import { Fragment, type CSSProperties } from 'react'
import type { RankingRow, RankingSource, SortDirection, SortKey, TeamAsset, YahooProjection } from '../types'
import { formatRank, formatSignedRank, formatSignedValue, formatValue, sourceLabel } from '../data/rankings'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'
import { rankingId } from '../data/draftState'

type Props = {
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  source: RankingSource
  sortKey: SortKey
  sortDirection: SortDirection
  draftSlot: number
  draftSize: number
  onSort: (key: SortKey) => void
  targets: Set<string>
  drafted: Set<string>
  mine: Set<string>
  onTarget: (id: string) => void
  onDrafted: (id: string) => void
  onMine: (id: string) => void
  selectedId?: string
  onSelect?: (id: string) => void
  stickyHeaders?: boolean
  showYahooProjections: boolean
  showRegressionDiff: boolean
  showAuctionValues: boolean
  yahooProjectionMode: 'full' | 'half'
  yahooProjectionFor: (row: RankingRow) => YahooProjection | undefined
}

const DRAFT_ROUNDS = 17

type DraftMarker = { overallPick: number; round: number; pickInRound: number; isCurrent: boolean; isMine: boolean }

function snakePickForSlot(round: number, slot: number, draftSize: number): number {
  const pickInRound = round % 2 === 1 ? slot : draftSize - slot + 1
  return ((round - 1) * draftSize) + pickInRound
}

function draftDividerStyle(diff: number | undefined): CSSProperties {
  return { '--draft-rgb': typeof diff === 'number' && diff > 0 ? '22 145 92' : typeof diff === 'number' && diff < 0 ? '210 52 68' : '102 112 133' } as CSSProperties
}

function DraftDividerRow({ markers, columnCount, diff }: { markers: DraftMarker[]; columnCount: number; diff: number | undefined }) {
  return <tr className="draft-divider-row" data-draft-divider="true" data-draft-marker-overall={markers.map((marker) => marker.overallPick).join(',')} data-draft-marker-current={markers.some((marker) => marker.isCurrent) ? 'true' : undefined} aria-label={markers.map((marker) => marker.isCurrent && marker.isMine ? 'Your pick' : `Round ${marker.round}, pick ${marker.pickInRound}`).join(' · ')}><td colSpan={columnCount}><div className="draft-divider" style={draftDividerStyle(diff)}>{markers.map((marker) => <span className={`${marker.isCurrent ? 'is-current ' : ''}${marker.isMine ? 'is-mine' : 'is-future'}`} key={marker.overallPick}>{marker.isCurrent && marker.isMine ? 'Your pick' : `R${marker.round} · Pick ${marker.pickInRound}`}</span>)}</div></td></tr>
}

function pickDetails(overallPick: number, draftSize: number): { round: number; pickInRound: number } {
  const round = Math.floor((overallPick - 1) / draftSize) + 1
  return { round, pickInRound: ((overallPick - 1) % draftSize) + 1 }
}

function diffSignalStyle(diff: number | undefined, isValueDiff: boolean): CSSProperties {
  const neutralRange = isValueDiff ? 1 : 3
  if (typeof diff !== 'number' || !Number.isFinite(diff) || Math.abs(diff) <= neutralRange) return {}
  const magnitude = Math.min(Math.abs(diff) - neutralRange, 24)
  const alpha = 0.05 + (magnitude / 24) * 0.25
  return {
    '--diff-alpha': alpha.toFixed(3),
    '--diff-rgb': diff > 0 ? '22 145 92' : '210 52 68'
  } as CSSProperties
}

function SortButton({ label, sortKey, activeKey, direction, onSort, ariaLabel }: { label: string; sortKey: SortKey; activeKey: SortKey; direction: SortDirection; onSort: (key: SortKey) => void; ariaLabel?: string }) {
  return <button className="sort-button" aria-label={ariaLabel ?? `Sort by ${label}`} title={ariaLabel ?? `Sort by ${label}`} onClick={() => onSort(sortKey)}>{label}{activeKey === sortKey ? <span aria-hidden="true"> {direction === 'asc' ? '↑' : '↓'}</span> : null}</button>
}

export function RankingsTable({ rows, teams, source, sortKey, sortDirection, draftSlot, draftSize, targets, drafted, mine, onSort, onTarget, onDrafted, onMine, selectedId, onSelect, stickyHeaders = false, showYahooProjections, showRegressionDiff, showAuctionValues, yahooProjectionMode, yahooProjectionFor }: Props) {
  const isEspn = source === 'espn'
  const showValueColumn = isEspn && showAuctionValues
  const dividerColumnCount = 6 + (showValueColumn ? 1 : 0) + (showYahooProjections ? 1 : 0) + (showRegressionDiff ? 1 : 0)
  const showDraftDivider = sortKey === 'sourceRank' && sortDirection === 'asc'
  const nextDraftPick = drafted.size + 1
  const myDraftPicks = new Set(Array.from({ length: DRAFT_ROUNDS }, (_, index) => snakePickForSlot(index + 1, draftSlot, draftSize)))
  const markerPicks = [...myDraftPicks].filter((overallPick) => overallPick >= nextDraftPick && overallPick <= DRAFT_ROUNDS * draftSize)
  const draftMarkers = markerPicks.map((overallPick): DraftMarker => {
    const details = pickDetails(overallPick, draftSize)
    return { overallPick, ...details, isCurrent: overallPick === nextDraftPick, isMine: myDraftPicks.has(overallPick) }
  }).sort((left, right) => left.overallPick - right.overallPick)
  const markerGroups = new Map<number, DraftMarker[]>()
  draftMarkers.forEach((marker) => {
    const rowIndex = rows.findIndex((row) => typeof row.sourceRank === 'number' && row.sourceRank >= marker.overallPick && !drafted.has(rankingId(row)))
    const index = rowIndex === -1 ? rows.length : rowIndex
    markerGroups.set(index, [...(markerGroups.get(index) ?? []), marker])
  })
  return (
    <div className="table-wrap">
      <table className={`rankings-table ${isEspn ? 'rankings-table--espn' : 'rankings-table--fpros'}${stickyHeaders ? ' rankings-table--sticky-headers' : ''}`}>
        <colgroup>
          <col className="col-action" />
          <col className="col-player" />
          <col className="col-position" />
          <col className="col-rank" />
          {showValueColumn ? <col className="col-money" /> : null}
          {showYahooProjections ? <col className="col-yahoo-projection" /> : null}
          {showRegressionDiff ? <col className="col-regression-diff" /> : null}
          <col className="col-diff" />
          <col className="col-draft" />
        </colgroup>
        <thead>
          <tr>
            <th className="action-heading" title="Favorite before drafting; add to my roster after drafting"><span className="action-heading__label">Mine</span><span className="sr-only">Favorite or my roster</span></th>
            <th className="player-heading"><SortButton label="Player" sortKey="player" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th className="position-heading"><SortButton label="Pos" sortKey="position" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th className="num-heading rank-heading" title={`${sourceLabel(source)} rank compared with adjusted rank`}><span>Rank</span><span className="rank-heading__hint" title={`${sourceLabel(source)} rank → adjusted rank`} aria-label={`${sourceLabel(source)} rank compared with adjusted rank`}>→</span><span className="rank-heading__sorts sr-only"><SortButton label="Source" ariaLabel={`Sort by ${sourceLabel(source)} rank`} sortKey="sourceRank" activeKey={sortKey} direction={sortDirection} onSort={onSort} /><SortButton label="Adjusted" ariaLabel="Sort by Adjusted rank" sortKey="adjustedRank" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></span></th>
            {showValueColumn ? <th className="num-heading price-heading"><span>Value</span></th> : null}
            {showYahooProjections ? <th className="num-heading yahoo-projection-heading"><SortButton label="Yahoo proj" sortKey="yahooProjection" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th> : null}
            {showRegressionDiff ? <th className="num-heading regression-diff-heading"><SortButton label="Trend" ariaLabel="Sort by trend" sortKey="regressionDiff" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th> : null}
            <th className="num-heading diff-heading"><SortButton label="Delta" ariaLabel={showValueColumn ? 'Sort by value delta' : 'Sort by ranking delta'} sortKey="diff" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th className="draft-heading">Draft</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const team = normalizeTeamAbbreviation(row.team)
            const asset = getTeamAsset(teams, team)
            const id = rankingId(row)
            const isTarget = targets.has(id)
            const isDrafted = drafted.has(id)
            const isMine = mine.has(id)
            const projection = yahooProjectionFor(row)
            const week1Projection = yahooProjectionMode === 'half' ? projection?.week1HalfPpr : projection?.week1Ppr
            const weeklyAverage = yahooProjectionMode === 'half' ? projection?.weeklyAvgHalfPpr : projection?.weeklyAvgPpr
            const weeklyAverageFallback = yahooProjectionMode === 'half' ? projection?.seasonHalfPpr : projection?.seasonPpr
            return (
              <Fragment key={`${row.player}-${row.team}-${row.sourceRank}`}>
              {showDraftDivider && markerGroups.has(index) ? <DraftDividerRow markers={markerGroups.get(index) ?? []} columnCount={dividerColumnCount} diff={row.diff} /> : null}
              <tr
                key={`${row.player}-${row.team}-${row.sourceRank}`}
                className={`${isDrafted ? 'is-drafted' : ''} ${selectedId === id ? 'is-selected' : ''} pos-${row.positionTone ?? 'other'}`}
                style={diffSignalStyle(row.diff, showValueColumn)}
                onClick={() => onSelect?.(id)}
                aria-selected={selectedId === id}
                data-ranking-id={id}
              >
                <td className="row-action">{isDrafted ? <button className={`mine-action ${isMine ? 'active' : ''}`} type="button" aria-label={`${isMine ? 'Remove' : 'Add'} ${row.player} ${isMine ? 'from' : 'to'} my roster`} aria-pressed={isMine} onClick={(event) => { event.stopPropagation(); onMine(id) }}>{isMine ? '✓' : '+'}</button> : <button className={`icon-action target-action ${isTarget ? 'active' : ''}`} type="button" aria-label={`${isTarget ? 'Remove target' : 'Target'} ${row.player}`} aria-pressed={isTarget} onClick={(event) => { event.stopPropagation(); onTarget(id) }}>★</button>}</td>
                <td className="player-cell">
                  <div className="player-cell__inner">
                    <TeamBadge team={team} asset={asset} />
                    <div><strong>{row.player}</strong><span>{team}</span></div>
                  </div>
                </td>
                <td className="position-cell"><span className={`pos-chip pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span></td>
                <td className="num rank-cell"><span className="rank-pair"><strong>{formatRank(row.sourceRank)}</strong><span>→</span><strong>{formatRank(row.adjustedRank)}</strong></span></td>
                {showValueColumn ? <td className="num price-cell"><span className="stacked-price"><strong>{formatValue(row.sourceValue)}</strong><small>Adjusted {formatValue(row.adjustedValue)}</small></span></td> : null}
                {showYahooProjections ? <td className="num yahoo-projection-cell"><span className="stacked-price"><strong>{typeof week1Projection === 'number' ? week1Projection.toFixed(2) : '—'}</strong><small>{typeof weeklyAverage === 'number' ? `${weeklyAverage.toFixed(1)} avg` : typeof weeklyAverageFallback === 'number' ? `${(weeklyAverageFallback / 17).toFixed(1)} avg` : 'No data'}</small></span></td> : null}
                {showRegressionDiff ? <td className={`num emphasis regression-diff-cell ${typeof row.regressionDiff === 'number' && row.regressionDiff > 0 ? 'diff-positive' : typeof row.regressionDiff === 'number' && row.regressionDiff < 0 ? 'diff-negative' : 'diff-neutral'}`}><span className="diff-value">{formatSignedRank(row.regressionDiff)}</span></td> : null}
                <td className={`num emphasis diff-cell ${typeof row.diff === 'number' && row.diff > 0 ? 'diff-positive' : typeof row.diff === 'number' && row.diff < 0 ? 'diff-negative' : 'diff-neutral'}`}><span className="diff-value">{showValueColumn ? formatSignedValue(row.diff) : formatRank(row.diff)}</span></td>
                <td className="draft-cell"><button className={`draft-action ${isDrafted ? 'active' : ''}`} type="button" aria-label={`${isDrafted ? 'Undo drafted' : 'Mark drafted'} ${row.player}`} onClick={(event) => { event.stopPropagation(); onDrafted(id) }}>{isDrafted ? 'Undo' : 'Draft'}</button></td>
              </tr>
              </Fragment>
            )
          })}
          {showDraftDivider && markerGroups.has(rows.length) && rows.length ? <DraftDividerRow markers={markerGroups.get(rows.length) ?? []} columnCount={dividerColumnCount} diff={rows[rows.length - 1]?.diff} /> : null}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty-state">No players match the current filters.</div>}
    </div>
  )
}
