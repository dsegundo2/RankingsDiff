import type { CSSProperties } from 'react'
import type { PositionFilter, RankingRow, TeamAsset } from '../types'
import { formatRank, formatSignedValue, formatValue } from '../data/rankings'
import { rankingId } from '../data/draftState'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = {
  rows: RankingRow[]
  positions: Set<Exclude<PositionFilter, 'ALL'>>
  teams: Record<string, TeamAsset>
  targets: Set<string>
  drafted: Set<string>
  mine: Set<string>
  isEspn: boolean
  showDrafted: boolean
  onTarget: (id: string) => void
  onDrafted: (id: string) => void
  onMine: (id: string) => void
  selectedId?: string
  onSelect?: (id: string) => void
}

const positions = ['RB', 'WR', 'QB', 'TE', 'K'] as const

function diffStyle(diff: number | undefined, isEspn: boolean): CSSProperties {
  const neutralRange = isEspn ? 1 : 3
  if (typeof diff !== 'number' || !Number.isFinite(diff) || Math.abs(diff) <= neutralRange) return {}
  const magnitude = Math.min(Math.abs(diff) - neutralRange, 20)
  return {
    '--diff-alpha': (0.035 + (magnitude / 20) * 0.22).toFixed(3),
    '--diff-rgb': diff > 0 ? '22 145 92' : '210 52 68'
  } as CSSProperties
}

function rankDifference(diff?: number): string {
  if (typeof diff !== 'number' || !Number.isFinite(diff)) return '—'
  if (diff === 0) return '0'
  return `${diff > 0 ? '+' : ''}${diff}`
}

export function PositionBoard({ rows, positions: selectedPositions, teams, targets, drafted, mine, isEspn, showDrafted, onTarget, onDrafted, onMine, selectedId, onSelect }: Props) {
  const visiblePositions = positions.filter((position) => selectedPositions.has(position))
  if (!visiblePositions.length) return <div className="empty-state position-board-empty">Choose one or more positions to compare side by side.</div>
  return (
    <section className="position-board" data-count={visiblePositions.length} aria-label="Players by position">
      {visiblePositions.map((position) => {
        const positionRows = rows
          .filter((row) => row.position.toUpperCase() === position && (showDrafted || !drafted.has(rankingId(row))))
        return (
          <article className={`position-lane position-lane--${position.toLowerCase()}`} key={position}>
            <header className="position-lane__header">
              <div><span className={`pos-chip pos-${position.toLowerCase()}`}>{position}</span><h2>{position === 'RB' ? 'Running backs' : position === 'WR' ? 'Wide receivers' : position === 'QB' ? 'Quarterbacks' : position === 'TE' ? 'Tight ends' : 'Kickers'}</h2></div>
              <span>{positionRows.length} {positionRows.length === 1 ? 'player' : 'players'}</span>
            </header>
            <div className="position-lane__columns" aria-hidden="true">
              <span>#</span><span className="position-column-badge" /><span>Player</span><span>{isEspn ? 'ESPN' : 'FP'}</span><span>{isEspn ? 'Diff' : 'Vs adj.'}</span><span title="Favorite or my roster">Fav / mine</span><span>Draft</span>
            </div>
            <div className="position-lane__list" tabIndex={0} aria-label={`${position} players, scroll to see all`}>
              {positionRows.map((row, index) => {
                const id = rankingId(row)
                const team = normalizeTeamAbbreviation(row.team)
                const asset = getTeamAsset(teams, team)
                const isDrafted = drafted.has(id)
                return (
                  <div className={`position-player ${isDrafted ? 'is-drafted' : ''} ${selectedId === id ? 'is-selected' : ''}`} style={diffStyle(row.diff, isEspn)} key={id} onClick={() => onSelect?.(id)} aria-selected={selectedId === id} data-ranking-id={id}>
                    <span className="position-player__rank">{String(index + 1).padStart(2, '0')}</span>
                    <TeamBadge team={team} asset={asset} />
                    <div className="position-player__identity">
                      <strong>{row.player}</strong>
                      <span>{team} · {formatRank(row.sourceRank)} → {formatRank(row.adjustedRank)}</span>
                    </div>
                    <div className="position-player__metric">
                      <strong>{isEspn ? formatValue(row.sourceValue) : `#${formatRank(row.sourceRank)}`}</strong>
                    </div>
                    <span className="position-player__difference" title={isEspn ? 'ESPN to Adjusted value difference' : 'FantasyPros to Adjusted rank difference'}>{isEspn ? formatSignedValue(row.diff) : rankDifference(row.diff)}</span>
                    {isDrafted ? <button className={`mine-action ${mine.has(id) ? 'active' : ''}`} type="button" aria-label={`${mine.has(id) ? 'Remove' : 'Add'} ${row.player} ${mine.has(id) ? 'from' : 'to'} my roster`} aria-pressed={mine.has(id)} onClick={(event) => { event.stopPropagation(); onMine(id) }}>{mine.has(id) ? '✓' : '+'}</button> : <button className={`icon-action target-action ${targets.has(id) ? 'active' : ''}`} type="button" aria-label={`${targets.has(id) ? 'Remove target' : 'Target'} ${row.player}`} aria-pressed={targets.has(id)} onClick={(event) => { event.stopPropagation(); onTarget(id) }}>★</button>}
                    <button className={`draft-action ${isDrafted ? 'active' : ''}`} type="button" aria-label={`${isDrafted ? 'Undo drafted' : 'Mark drafted'} ${row.player}`} onClick={(event) => { event.stopPropagation(); onDrafted(id) }}>{isDrafted ? 'Undo' : 'Draft'}</button>
                  </div>
                )
              })}
              {positionRows.length === 0 ? <div className="lane-empty">No matching players</div> : null}
            </div>
          </article>
        )
      })}
    </section>
  )
}
