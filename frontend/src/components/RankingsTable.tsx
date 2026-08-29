import { Fragment, type CSSProperties, type DragEvent } from 'react'
import type { RankingRow, RankingSource, SortDirection, SortKey, TeamAsset, YahooProjection } from '../types'
import { adjustedRankTone, formatRank, formatSignedRank, formatSignedValue, formatValue, sourceLabel } from '../data/rankings'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'
import { rankingId, snakeOverallPick, snakePickDetails } from '../data/draftState'

type Props = {
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  source: RankingSource
  sortKey: SortKey
  sortDirection: SortDirection
  draftSlot: number
  draftSize: number
  includeKeeperRound: boolean
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
  onBoardDrop?: (event: DragEvent<HTMLElement>) => void
}

const DRAFT_ROUNDS = 17

type DraftMarker = { overallPick: number; round: number; pickInRound: number; isCurrent: boolean; isMine: boolean }

function draftDividerStyle(): CSSProperties {
  return { '--draft-rgb': '111 88 177' } as CSSProperties
}

function DraftDividerRow({ markers, columnCount, atTop = false }: { markers: DraftMarker[]; columnCount: number; atTop?: boolean }) {
  return <tr className={`draft-divider-row${atTop ? ' draft-divider-row--top' : ''}`} data-draft-divider="true" data-draft-marker-overall={markers.map((marker) => marker.overallPick).join(',')} data-draft-marker-current={markers.some((marker) => marker.isCurrent) ? 'true' : undefined} aria-label={markers.map((marker) => marker.isCurrent && marker.isMine ? 'Your pick' : `Round ${marker.round}, pick ${marker.pickInRound}`).join(' · ')}><td colSpan={columnCount}><div className="draft-divider" style={draftDividerStyle()}>{markers.map((marker) => <span className={`${marker.isCurrent ? 'is-current ' : ''}${marker.isMine ? 'is-mine' : 'is-future'}`} key={marker.overallPick}>{marker.isCurrent && marker.isMine ? 'Your pick' : `R${marker.round} · Pick ${marker.pickInRound}`}</span>)}</div></td></tr>
}

function AuctionRoundDividerRow({ round, columnCount }: { round: number; columnCount: number }) {
  return <tr className="draft-divider-row auction-round-divider-row" data-auction-round-divider="true" data-auction-round={round} aria-label={`Round ${round}`}><td colSpan={columnCount}><div className="draft-divider" style={draftDividerStyle()}><span className="is-future">Round {round}</span></div></td></tr>
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

export function RankingsTable({ rows, teams, source, sortKey, sortDirection, draftSlot, draftSize, includeKeeperRound, targets, drafted, mine, onSort, onTarget, onDrafted, onMine, selectedId, onSelect, stickyHeaders = false, showYahooProjections, showRegressionDiff, showAuctionValues, yahooProjectionMode, yahooProjectionFor, onBoardDrop }: Props) {
  const isEspn = source === 'espn' || source === 'espn-auction'
  const showValueColumn = isEspn && showAuctionValues
  const dividerColumnCount = 6 + (showValueColumn ? 1 : 0) + (showYahooProjections ? 1 : 0) + (showRegressionDiff ? 1 : 0)
  const showDraftDivider = (sortKey === 'sourceRank' || sortKey === 'adjustedRank') && sortDirection === 'asc'
  const showAuctionRoundDivider = showValueColumn && showDraftDivider
  const showPersonalPickMarkers = showDraftDivider && !showAuctionRoundDivider
  const rankForDraft = (row: RankingRow): number | undefined => sortKey === 'adjustedRank' ? row.adjustedRank : row.sourceRank
  const rankSortKey = sortKey === 'adjustedRank' ? 'adjustedRank' : 'sourceRank'
  const nextRankSortKey = rankSortKey === 'sourceRank' ? 'adjustedRank' : 'sourceRank'
  const nextDraftPick = drafted.size + 1
  const myDraftPicks = new Set([...(includeKeeperRound ? [snakeOverallPick(0, draftSlot, draftSize, true)] : []), ...Array.from({ length: DRAFT_ROUNDS }, (_, index) => snakeOverallPick(index + 1, draftSlot, draftSize, includeKeeperRound))])
  const maxDraftPick = (DRAFT_ROUNDS + (includeKeeperRound ? 1 : 0)) * draftSize
  const markerPicks = [...myDraftPicks].filter((overallPick) => overallPick >= nextDraftPick && overallPick <= maxDraftPick)
  const draftMarkers = markerPicks.map((overallPick): DraftMarker => {
    const details = snakePickDetails(overallPick, draftSize, includeKeeperRound)
    return { overallPick, ...details, isCurrent: overallPick === nextDraftPick, isMine: myDraftPicks.has(overallPick) }
  }).sort((left, right) => left.overallPick - right.overallPick)
  const markerGroups = new Map<number, DraftMarker[]>()
  draftMarkers.forEach((marker) => {
    // The active pick is the next available roster choice, not the row whose
    // source rank happens to equal the overall pick number. This matters when
    // another manager drafts an arbitrary player (for example rank 5) before
    // our first pick: the marker must move to the top available player.
    if (marker.isCurrent) {
      const firstAvailableIndex = rows.findIndex((row) => !drafted.has(rankingId(row)))
      const index = firstAvailableIndex === -1 ? rows.length : firstAvailableIndex
      markerGroups.set(index, [...(markerGroups.get(index) ?? []), marker])
      return
    }
    const firstAvailableIndex = rows.findIndex((row) => typeof rankForDraft(row) === 'number' && rankForDraft(row)! >= marker.overallPick && !drafted.has(rankingId(row)))
    const lastPastPickIndex = rows.reduce((lastIndex, row, index) => typeof rankForDraft(row) === 'number' && rankForDraft(row)! >= marker.overallPick && drafted.has(rankingId(row)) ? index : lastIndex, -1)
    const availableIndex = firstAvailableIndex === -1 ? rows.length : firstAvailableIndex
    const index = Math.max(availableIndex, lastPastPickIndex + 1)
    markerGroups.set(index, [...(markerGroups.get(index) ?? []), marker])
  })
  return (
    <div className="table-wrap">
      <table className={`rankings-table ${isEspn ? 'rankings-table--espn' : 'rankings-table--fpros'}${stickyHeaders ? ' rankings-table--sticky-headers' : ''}`} onDragOver={(event) => { if (!onBoardDrop) return; event.preventDefault(); event.dataTransfer.dropEffect = 'move' }} onDrop={onBoardDrop}>
        <colgroup>
          <col className="col-rank" />
          <col className="col-player" />
          <col className="col-position" />
          {showValueColumn ? <col className="col-money" /> : null}
          {showYahooProjections ? <col className="col-yahoo-projection" /> : null}
          {showRegressionDiff ? <col className="col-regression-diff" /> : null}
          <col className="col-diff" />
          <col className="col-action" />
          <col className="col-draft" />
        </colgroup>
        <thead>
          <tr>
            <th className="num-heading rank-heading" title={`${sourceLabel(source)} rank compared with adjusted rank`}><button className="sort-button" aria-label={`Sort rank by ${nextRankSortKey === 'sourceRank' ? `${sourceLabel(source)} base rank` : 'adjusted rank'}`} title={`Click to sort by ${nextRankSortKey === 'sourceRank' ? `${sourceLabel(source)} base rank` : 'adjusted rank'}`} onClick={() => onSort(nextRankSortKey)}><span>Rank</span><span className="rank-heading__hint sr-only" title={`${sourceLabel(source)} rank → adjusted rank`}>Rank → adjusted rank</span><span aria-hidden="true">↑</span></button></th>
            <th className="player-heading"><SortButton label="Player" sortKey="player" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th className="position-heading"><SortButton label="Pos" sortKey="position" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            {showValueColumn ? <th className="num-heading price-heading"><span>Value</span></th> : null}
          {showYahooProjections ? <th className="num-heading yahoo-projection-heading"><SortButton label="Yahoo proj" sortKey="yahooProjection" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th> : null}
            {showRegressionDiff ? <th className="num-heading regression-diff-heading"><SortButton label="Trend" ariaLabel="Sort by trend" sortKey="regressionDiff" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th> : null}
            <th className="num-heading diff-heading"><SortButton label="Delta" ariaLabel={showValueColumn ? 'Sort by value delta' : 'Sort by ranking delta'} sortKey="diff" activeKey={sortKey} direction={sortDirection} onSort={onSort} /></th>
            <th className="action-heading" title="Favorite before drafting; add to my roster after drafting"><span className="action-heading__label">Fav</span><span className="sr-only">Favorite or my roster</span></th>
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
            const week1Projection = yahooProjectionMode === 'half' ? projection?.week1HalfPpr ?? projection?.week1Ppr ?? 0 : projection?.week1Ppr ?? 0
            const seasonProjection = yahooProjectionMode === 'half' ? projection?.seasonHalfPpr ?? projection?.seasonPpr ?? 0 : projection?.seasonPpr ?? 0
            return (
              <Fragment key={`${row.player}-${row.team}-${row.sourceRank}`}>
              {showAuctionRoundDivider && index > 0 && index % draftSize === 0 ? <AuctionRoundDividerRow round={Math.floor(index / draftSize) + 1} columnCount={dividerColumnCount} /> : showPersonalPickMarkers && markerGroups.has(index) ? <DraftDividerRow markers={markerGroups.get(index) ?? []} columnCount={dividerColumnCount} atTop={index === 0} /> : null}
              <tr
                key={`${row.player}-${row.team}-${row.sourceRank}`}
                className={`${isDrafted ? 'is-drafted' : ''} ${selectedId === id ? 'is-selected' : ''} pos-${row.positionTone ?? 'other'}`}
                style={diffSignalStyle(row.diff, showValueColumn)}
                aria-selected={selectedId === id}
                data-ranking-id={id}
              >
                <td className="num rank-cell"><span className="rank-parenthetical rank-pair"><strong>{formatRank(sortKey === 'adjustedRank' ? row.adjustedRank : row.sourceRank)}</strong><small className={`adjusted-rank-value adjusted-rank-value--${adjustedRankTone(row)}`}>({formatRank(sortKey === 'adjustedRank' ? row.sourceRank : row.adjustedRank)})</small>{sortKey !== 'adjustedRank' ? <strong className="sr-only">{formatRank(row.adjustedRank)}</strong> : null}<span className="sr-only">Base rank {formatRank(row.sourceRank)}. Adjusted rank {formatRank(row.adjustedRank)}.</span></span></td>
                <td className="player-cell">
                  <div className="player-cell__inner">
                    <TeamBadge team={team} asset={asset} />
                    <div><button type="button" className="player-name-trigger" onClick={(event) => { event.stopPropagation(); onSelect?.(id) }}>{row.player}</button><span>{team}</span></div>
                  </div>
                </td>
                <td className="position-cell"><span className={`pos-chip pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span></td>
                {showValueColumn ? <td className="num price-cell"><span className="stacked-price"><strong>{formatValue(row.sourceValue)}</strong><small>Adjusted {formatValue(row.adjustedValue)}</small></span></td> : null}
                {showYahooProjections ? <td className="num yahoo-projection-cell"><span className="stacked-price"><strong>{seasonProjection > 0 ? seasonProjection.toFixed(2) : '—'}</strong><small>{seasonProjection > 0 ? `Season · (${week1Projection > 0 ? `${week1Projection.toFixed(2)} wk 1` : 'No week 1 data'})` : 'No data'}</small></span></td> : null}
                {showRegressionDiff ? <td className={`num emphasis regression-diff-cell ${typeof row.regressionDiff === 'number' && row.regressionDiff > 0 ? 'diff-positive' : typeof row.regressionDiff === 'number' && row.regressionDiff < 0 ? 'diff-negative' : 'diff-neutral'}`}><span className="diff-value">{formatSignedRank(row.regressionDiff)}</span></td> : null}
                <td className={`num emphasis diff-cell ${typeof row.diff === 'number' && row.diff > 0 ? 'diff-positive' : typeof row.diff === 'number' && row.diff < 0 ? 'diff-negative' : 'diff-neutral'}`}><span className="diff-value">{showValueColumn ? formatSignedValue(row.diff) : formatRank(row.diff)}</span></td>
                <td className="row-action">{isDrafted ? <button className={`mine-action ${isMine ? 'active' : ''}`} type="button" aria-label={`${isMine ? 'Remove' : 'Add'} ${row.player} ${isMine ? 'from' : 'to'} my roster`} aria-pressed={isMine} onClick={(event) => { event.stopPropagation(); onMine(id) }}>{isMine ? '✓' : '+'}</button> : <button className={`icon-action target-action ${isTarget ? 'active' : ''}`} type="button" aria-label={`${isTarget ? 'Remove target' : 'Target'} ${row.player}`} aria-pressed={isTarget} onClick={(event) => { event.stopPropagation(); onTarget(id) }}>★</button>}</td>
                <td className="draft-cell"><button className={`draft-action ${isDrafted ? 'active' : ''}`} type="button" aria-label={`${isDrafted ? 'Undo drafted' : 'Mark drafted'} ${row.player}`} onClick={(event) => { event.stopPropagation(); onDrafted(id) }}>{isDrafted ? 'Undo' : 'Draft'}</button></td>
              </tr>
              </Fragment>
            )
          })}
          {showAuctionRoundDivider && rows.length && rows.length % draftSize === 0 ? <AuctionRoundDividerRow round={Math.floor(rows.length / draftSize) + 1} columnCount={dividerColumnCount} /> : showPersonalPickMarkers && markerGroups.has(rows.length) && rows.length ? <DraftDividerRow markers={markerGroups.get(rows.length) ?? []} columnCount={dividerColumnCount} /> : null}
        </tbody>
      </table>
      {rows.length === 0 && <div className="empty-state">No players match the current filters.</div>}
    </div>
  )
}
