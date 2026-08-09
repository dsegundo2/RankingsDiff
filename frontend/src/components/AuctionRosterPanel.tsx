import { useState, type DragEvent } from 'react'
import type { RankingRow, RankingSource, TeamAsset } from '../types'
import { rankingId } from '../data/draftState'
import { DEFAULT_ROSTER_TARGETS, rosterTargetLabel, type RosterTargetGoals } from '../data/rosterTargets'
import { formatRank, formatValue } from '../data/rankings'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = {
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  targetGoals: RosterTargetGoals
  drafted: Set<string>
  targetRows: RankingRow[]
  showTargetQueue: boolean
  mode: 'auction' | 'snake'
  source: RankingSource
  prices: Record<string, number>
  slots: Record<string, string>
  onPrice: (id: string, value: number | undefined) => void
  onMoveSlot: (id: string, value: string) => void
  onTarget: (id: string) => void
}

const starterSlots = ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', 'FLEX']
const benchSlots = ['BENCH1', 'BENCH2', 'BENCH3', 'BENCH4', 'BENCH5']

export function AuctionRosterPanel({ rows, teams, targetGoals, drafted, targetRows, showTargetQueue, mode, source, prices, slots, onPrice, onMoveSlot, onTarget }: Props) {
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropSlot, setDropSlot] = useState<string | null>(null)
  const rowById = new Map(rows.map((row) => [rankingId(row), row]))
  const picks = [...drafted].map((id) => ({ id, row: rowById.get(id) })).filter((pick): pick is { id: string; row: RankingRow } => Boolean(pick.row))
  const spent = picks.reduce((total, pick) => total + (prices[pick.id] ?? 0), 0)
  const remaining = 200 - spent
  const pricedPicks = picks.filter(({ id }) => prices[id] !== undefined)
  const pace = pricedPicks.reduce((total, { id }) => total + (targetGoals[slots[id]] ?? DEFAULT_ROSTER_TARGETS[slots[id]] ?? 0) - (prices[id] ?? 0), 0)
  const positionsRemaining = Math.max(1, starterSlots.length + benchSlots.length - pricedPicks.length)
  const targetAdjustment = pace / positionsRemaining

  function slotName(slot: string): string {
    return rosterTargetLabel(slot)
  }

  function targetForSlot(slot: string): string {
    const value = (targetGoals[slot] ?? DEFAULT_ROSTER_TARGETS[slot] ?? 0) + targetAdjustment
    const rounded = Math.round(value * 10) / 10
    return `$${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}`
  }

  function slotTargetText(slot: string): string {
    return mode === 'auction' ? ` · target ${targetForSlot(slot)}` : ''
  }

  function beginPrice(id: string): void {
    setEditingPriceId(id)
    setPriceDraft(prices[id] === undefined ? '' : String(prices[id]))
  }

  function commitPrice(id: string): void {
    const value = priceDraft.trim() === '' ? undefined : Number(priceDraft)
    onPrice(id, value !== undefined && Number.isFinite(value) ? value : undefined)
    setEditingPriceId(null)
    setPriceDraft('')
  }

  function priceControl(id: string, row: RankingRow) {
    const label = mode === 'auction' ? 'Price paid' : 'Draft round'
    if (editingPriceId === id) return <input className="auction-slot__price-input" autoFocus aria-label={`${label} for ${row.player}`} type="text" inputMode="decimal" placeholder={mode === 'auction' ? '$' : '#'} value={priceDraft} onChange={(event) => setPriceDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commitPrice(id) } }} onBlur={() => commitPrice(id)} />
    return <button className="auction-slot__price-display" type="button" aria-label={`${prices[id] === undefined ? 'Set' : 'Edit'} ${label.toLowerCase()} for ${row.player}`} onClick={() => beginPrice(id)}>{prices[id] === undefined ? 'Set' : mode === 'auction' ? `$${prices[id]}` : `R${prices[id]}`}</button>
  }

  function pickControls(id: string, row: RankingRow) {
    return <div className="auction-slot__controls">{priceControl(id, row)}</div>
  }

  function handleDragStart(id: string, event: DragEvent<HTMLDivElement>): void {
    setDraggingId(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }

  function handleDrop(slot: string, event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || draggingId
    if (id) onMoveSlot(id, slot)
    setDraggingId(null)
    setDropSlot(null)
  }

  function renderSlot(slot: string) {
    const pick = picks.find(({ id }) => slots[id] === slot)
    const team = pick ? normalizeTeamAbbreviation(pick.row.team) : ''
    return <div className={`auction-slot${pick ? ' is-filled' : ''}${dropSlot === slot ? ' is-drop-target' : ''}`} key={slot} data-roster-slot={slot} draggable={Boolean(pick)} aria-label={pick ? `${pick.row.player} in ${slotName(slot)}, draggable` : `${slotName(slot)} open, drop a player here`} onDragStart={pick ? (event) => handleDragStart(pick.id, event) : undefined} onDragEnd={() => { setDraggingId(null); setDropSlot(null) }} onDragOver={(event) => { event.preventDefault(); setDropSlot(slot) }} onDrop={(event) => handleDrop(slot, event)}>
      <span className="auction-slot__label">{slotName(slot)}</span>
      {pick ? <><div className="auction-slot__identity"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><span><strong>{pick.row.player}</strong><small>{team}{slotTargetText(slot)}</small></span></div>{pickControls(pick.id, pick.row)}</> : <span className="auction-slot__empty">Open{slotTargetText(slot)}</span>}
    </div>
  }

  return <aside className="auction-roster-panel" aria-label="My draft roster">
    <div className="auction-roster-panel__header">
      <div><span className="eyebrow">My draft</span><h2>Roster slots</h2></div>
      <strong className="auction-roster-panel__count">{picks.length}</strong>
    </div>
    {mode === 'auction' ? <div className="auction-roster-panel__budget"><span>Budget remaining</span><strong className={remaining < 0 ? 'is-negative' : ''}>${remaining}</strong><small>of $200</small></div> : null}
    {showTargetQueue ? <section className="auction-shortlist target-queue target-queue--embedded" aria-label="Target queue">
      <div className="auction-roster-panel__section-heading"><strong>Shortlist</strong><span>{targetRows.length}</span></div>
      {targetRows.length ? <div className="auction-shortlist__list">{targetRows.slice(0, 6).map((row) => {
        const id = rankingId(row)
        const team = normalizeTeamAbbreviation(row.team)
        const valueSummary = source === 'espn' ? `${formatValue(row.sourceValue)} → ${formatValue(row.adjustedValue)}` : `#${formatRank(row.sourceRank)} → #${formatRank(row.adjustedRank)}`
        return <button type="button" key={id} className="auction-shortlist__item" onClick={() => onTarget(id)} aria-label={`Remove target ${row.player}`}><span className={`auction-shortlist__pos pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span><span><strong>{row.player}</strong><small>{team} · {valueSummary}</small></span><span className="auction-shortlist__remove" aria-hidden="true" /></button>
      })}</div> : <p className="auction-roster-panel__empty">Target players to keep a short list here.</p>}
    </section> : null}
    <section className="auction-roster-panel__roster" aria-label="Roster slots">
      <div className="auction-roster-panel__section-heading"><strong>My roster</strong>{mode === 'auction' ? <span>{pace >= 0 ? `Under target ${pace === 0 ? '$0' : `$${Math.round(pace)}`}` : `Over target $${Math.abs(Math.round(pace))}`}</span> : null}</div>
      <div className="auction-roster-panel__list">
      {starterSlots.map(renderSlot)}
      </div>
      <div className="auction-bench"><div className="auction-roster-panel__section-heading"><strong>Bench</strong></div>{benchSlots.map(renderSlot)}</div>
    </section>
    {!picks.length ? <p className="auction-roster-panel__empty">No players on roster yet.</p> : null}
  </aside>
}
