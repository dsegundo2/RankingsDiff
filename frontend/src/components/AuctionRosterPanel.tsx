import type { RankingRow, RankingSource, TeamAsset } from '../types'
import { rankingId } from '../data/draftState'
import { formatRank, formatValue } from '../data/rankings'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = {
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  drafted: Set<string>
  targetRows: RankingRow[]
  showTargetQueue: boolean
  mode: 'auction' | 'snake'
  source: RankingSource
  prices: Record<string, number>
  slots: Record<string, string>
  onPrice: (id: string, value: number | undefined) => void
  onSlot: (id: string, value: string) => void
  onTarget: (id: string) => void
}

const starterSlots = ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', 'FLEX']
const benchSlots = ['BENCH1', 'BENCH2', 'BENCH3', 'BENCH4', 'BENCH5']

export function AuctionRosterPanel({ rows, teams, drafted, targetRows, showTargetQueue, mode, source, prices, slots, onPrice, onSlot, onTarget }: Props) {
  const rowById = new Map(rows.map((row) => [rankingId(row), row]))
  const picks = [...drafted].map((id) => ({ id, row: rowById.get(id) })).filter((pick): pick is { id: string; row: RankingRow } => Boolean(pick.row))
  const spent = picks.reduce((total, pick) => total + (prices[pick.id] ?? 0), 0)
  const remaining = 200 - spent

  function slotName(slot: string): string {
    return slot.startsWith('BENCH') ? `Bench ${slot.slice(5)}` : slot
  }

  return <aside className="auction-roster-panel" aria-label="My draft roster">
    <div className="auction-roster-panel__header">
      <div><span className="eyebrow">My draft</span><h2>Roster slots</h2></div>
      <strong className="auction-roster-panel__count">{picks.length}</strong>
    </div>
    <div className="auction-roster-panel__budget"><span>{mode === 'auction' ? 'Budget remaining' : 'Draft mode'}</span><strong className={mode === 'auction' && remaining < 0 ? 'is-negative' : ''}>{mode === 'auction' ? `$${remaining}` : 'Snake'}</strong><small>{mode === 'auction' ? 'of $200' : 'rounds'}</small></div>
    {showTargetQueue ? <section className="auction-shortlist target-queue target-queue--embedded" aria-label="Target queue">
      <div className="auction-roster-panel__section-heading"><strong>Shortlist</strong><span>{targetRows.length}</span></div>
      {targetRows.length ? <div className="auction-shortlist__list">{targetRows.slice(0, 6).map((row) => {
        const id = rankingId(row)
        const team = normalizeTeamAbbreviation(row.team)
        return <button type="button" key={id} className="auction-shortlist__item" onClick={() => onTarget(id)} aria-label={`Remove target ${row.player}`}><span className={`auction-shortlist__pos pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span><span><strong>{row.player}</strong><small>{team}</small><span className="target-queue__details"><small>{source === 'espn' ? `${formatValue(row.sourceValue)} → ${formatValue(row.adjustedValue)}` : `#${formatRank(row.sourceRank)} → #${formatRank(row.adjustedRank)}`}</small></span></span><span aria-hidden="true">×</span></button>
      })}</div> : <p className="auction-roster-panel__empty">Target players to keep a short list here.</p>}
    </section> : null}
    <section className="auction-roster-panel__roster" aria-label="Roster slots">
      <div className="auction-roster-panel__section-heading"><strong>My roster</strong><span>auto-fills</span></div>
      <div className="auction-roster-panel__list">
      {starterSlots.map((slot) => {
        const pick = picks.find(({ id }) => slots[id] === slot)
        return <div className={`auction-slot${pick ? ' is-filled' : ''}`} key={slot}><span className="auction-slot__label">{slot}</span>{pick ? <><div className="auction-slot__identity"><strong>{pick.row.player}</strong><small>{normalizeTeamAbbreviation(pick.row.team)}</small></div><span className="auction-slot__value">{prices[pick.id] !== undefined ? `$${prices[pick.id]}` : '—'}</span></> : <span className="auction-slot__empty">Open</span>}</div>
      })}
      </div>
      <div className="auction-bench"><div className="auction-roster-panel__section-heading"><strong>Bench</strong><span>when no starter spot remains</span></div>{benchSlots.map((slot) => { const pick = picks.find(({ id }) => slots[id] === slot); return <div className={`auction-slot${pick ? ' is-filled' : ''}`} key={slot}><span className="auction-slot__label">{slotName(slot)}</span>{pick ? <><div className="auction-slot__identity"><strong>{pick.row.player}</strong><small>{normalizeTeamAbbreviation(pick.row.team)}</small></div><span className="auction-slot__value">{prices[pick.id] !== undefined ? `$${prices[pick.id]}` : '—'}</span></> : <span className="auction-slot__empty">Open</span>}</div> })}</div>
    </section>
    {picks.length ? <><div className="auction-roster-panel__section-heading auction-pick-details"><strong>Draft details</strong><span>price / round and placement</span></div><div className="auction-roster-panel__list">
      {picks.map(({ id, row }) => {
        const team = normalizeTeamAbbreviation(row.team)
        return <div className="auction-pick" key={id}>
          <div className="auction-pick__identity"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><span><strong>{row.player}</strong><small>{team} · {row.position}</small></span></div>
          <div className="auction-pick__controls">
            <label><span>{mode === 'auction' ? 'Price' : 'Round'}</span><input aria-label={`${mode === 'auction' ? 'Price paid' : 'Draft round'} for ${row.player}`} type="number" min="0" step="1" inputMode="numeric" placeholder={mode === 'auction' ? '$' : '#'} value={prices[id] ?? ''} onChange={(event) => onPrice(id, event.target.value === '' ? undefined : Number(event.target.value))} /></label>
            <label><span>Slot</span><select aria-label={`Roster slot for ${row.player}`} value={slots[id] ?? ''} onChange={(event) => onSlot(id, event.target.value)}><option value="">Choose</option>{[...starterSlots, ...benchSlots].map((slot) => <option key={slot} value={slot}>{slotName(slot)}</option>)}</select></label>
          </div>
        </div>
      })}
    </div></> : <p className="auction-roster-panel__empty">Click Mine on a player to add them here, then enter the price or round.</p>}
  </aside>
}
