import type { RankingRow, TeamAsset } from '../types'
import { formatRank, formatSignedValue, formatValue } from '../data/rankings'
import { rankingId } from '../data/draftState'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = {
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  targets: Set<string>
  drafted: Set<string>
  isEspn: boolean
  showDrafted: boolean
  onTarget: (id: string) => void
  onDrafted: (id: string) => void
}

const positions = ['RB', 'WR', 'QB', 'TE'] as const

export function PositionBoard({ rows, teams, targets, drafted, isEspn, showDrafted, onTarget, onDrafted }: Props) {
  return (
    <section className="position-board" aria-label="Top players by position">
      {positions.map((position) => {
        const positionRows = rows
          .filter((row) => row.position.toUpperCase() === position && (showDrafted || !drafted.has(rankingId(row))))
        return (
          <article className={`position-lane position-lane--${position.toLowerCase()}`} key={position}>
            <header className="position-lane__header">
              <div><span className={`pos-chip pos-${position.toLowerCase()}`}>{position}</span><h2>{position === 'RB' ? 'Running backs' : position === 'WR' ? 'Wide receivers' : position === 'QB' ? 'Quarterbacks' : 'Tight ends'}</h2></div>
              <span>{positionRows.length} {positionRows.length === 1 ? 'player' : 'players'}</span>
            </header>
            <div className="position-lane__list" tabIndex={0} aria-label={`${position} players, scroll to see all`}>
              {positionRows.map((row, index) => {
                const id = rankingId(row)
                const team = normalizeTeamAbbreviation(row.team)
                const asset = getTeamAsset(teams, team)
                const isDrafted = drafted.has(id)
                return (
                  <div className={`position-player ${isDrafted ? 'is-drafted' : ''}`} key={id}>
                    <span className="position-player__rank">{String(index + 1).padStart(2, '0')}</span>
                    <TeamBadge team={team} asset={asset} />
                    <div className="position-player__identity">
                      <strong>{row.player}</strong>
                      <span>{team} · {formatRank(row.sourceRank)} → {formatRank(row.underdogRank)}</span>
                    </div>
                    <div className="position-player__edge">
                      <strong>{isEspn ? formatSignedValue(row.diff) : `${(row.diff ?? 0) > 0 ? '+' : ''}${formatRank(row.diff)}`}</strong>
                      <span>{isEspn ? `${formatValue(row.sourceValue)} / ${formatValue(row.underdogValue)}` : 'rank gap'}</span>
                    </div>
                    <button className={`icon-action target-action ${targets.has(id) ? 'active' : ''}`} type="button" aria-label={`${targets.has(id) ? 'Remove target' : 'Target'} ${row.player}`} aria-pressed={targets.has(id)} onClick={() => onTarget(id)}>★</button>
                    <button className={`draft-action ${isDrafted ? 'active' : ''}`} type="button" aria-label={`${isDrafted ? 'Undo drafted' : 'Mark drafted'} ${row.player}`} onClick={() => onDrafted(id)}>{isDrafted ? 'Undo' : 'Draft'}</button>
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
