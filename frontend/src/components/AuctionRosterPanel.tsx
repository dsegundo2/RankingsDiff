import type { RankingRow, TeamAsset } from '../types'
import { rankingId } from '../data/draftState'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = {
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  drafted: Set<string>
  prices: Record<string, number>
  slots: Record<string, string>
  onPrice: (id: string, value: number | undefined) => void
  onSlot: (id: string, value: string) => void
}

const rosterSlots = ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', 'FLEX', 'K', 'DEF']

export function AuctionRosterPanel({ rows, teams, drafted, prices, slots, onPrice, onSlot }: Props) {
  const rowById = new Map(rows.map((row) => [rankingId(row), row]))
  const picks = [...drafted].map((id) => ({ id, row: rowById.get(id) })).filter((pick): pick is { id: string; row: RankingRow } => Boolean(pick.row))
  const spent = picks.reduce((total, pick) => total + (prices[pick.id] ?? 0), 0)
  const remaining = 200 - spent

  return <aside className="auction-roster-panel" aria-label="My draft roster">
    <div className="auction-roster-panel__header">
      <div><span className="eyebrow">My draft</span><h2>Roster slots</h2></div>
      <strong className="auction-roster-panel__count">{picks.length}</strong>
    </div>
    <div className="auction-roster-panel__budget"><span>Remaining</span><strong className={remaining < 0 ? 'is-negative' : ''}>${remaining}</strong><small>of $200</small></div>
    {picks.length ? <div className="auction-roster-panel__list">
      {picks.map(({ id, row }) => {
        const team = normalizeTeamAbbreviation(row.team)
        return <div className="auction-pick" key={id}>
          <div className="auction-pick__identity"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><span><strong>{row.player}</strong><small>{team} · {row.position}</small></span></div>
          <div className="auction-pick__controls">
            <label><span>Price</span><input aria-label={`Price paid for ${row.player}`} type="number" min="0" step="1" inputMode="numeric" placeholder="$" value={prices[id] ?? ''} onChange={(event) => onPrice(id, event.target.value === '' ? undefined : Number(event.target.value))} /></label>
            <label><span>Slot</span><select aria-label={`Roster slot for ${row.player}`} value={slots[id] ?? ''} onChange={(event) => onSlot(id, event.target.value)}><option value="">Choose</option>{rosterSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}</select></label>
          </div>
        </div>
      })}
    </div> : <p className="auction-roster-panel__empty">Click Draft on a player to add them here, then enter the price and roster slot.</p>}
  </aside>
}
