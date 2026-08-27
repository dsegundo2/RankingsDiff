import { useEffect, useRef, useState, type DragEvent } from 'react'
import type { RankingRow, RankingSource, TeamAsset } from '../types'
import { rankingId } from '../data/draftState'
import { DEFAULT_ROSTER_TARGETS, rosterTargetLabel, rosterTargetSlots, rosterTargetTotal, type RosterTargetGoals } from '../data/rosterTargets'
import { formatRank, formatValue } from '../data/rankings'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type TargetQueueView = 'normal' | 'position'

type Props = {
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  targetGoals: RosterTargetGoals
  drafted: Set<string>
  targetRows: RankingRow[]
  targetQueueView: TargetQueueView
  showTargetQueue: boolean
  mode: 'auction' | 'snake'
  source: RankingSource
  prices: Record<string, number>
  slots: Record<string, string>
  onPrice: (id: string, value: number | undefined) => void
  onMoveSlot: (id: string, value: string) => void
  onTarget: (id: string) => void
  onDragStateChange?: (id: string | null) => void
}

export function AuctionRosterPanel({ rows, teams, targetGoals, drafted, targetRows, targetQueueView, showTargetQueue, mode, source, prices, slots, onPrice, onMoveSlot, onTarget, onDragStateChange }: Props) {
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [dropSlot, setDropSlot] = useState<string | null>(null)
  const previousDraftedRef = useRef<Set<string>>(new Set(drafted))

  useEffect(() => {
    const previous = previousDraftedRef.current
    const addedId = mode === 'auction' ? [...drafted].find((id) => !previous.has(id)) : undefined
    previousDraftedRef.current = new Set(drafted)
    if (addedId && prices[addedId] === undefined) {
      setEditingPriceId(addedId)
      setPriceDraft('')
    }
  }, [drafted, mode, prices])
  const rowById = new Map(rows.map((row) => [rankingId(row), row]))
  const picks = [...drafted].map((id) => ({ id, row: rowById.get(id) })).filter((pick): pick is { id: string; row: RankingRow } => Boolean(pick.row))
  const spent = picks.reduce((total, pick) => total + (prices[pick.id] ?? 0), 0)
  const rosterSlots = rosterTargetSlots(targetGoals)
  const starterSlots = rosterSlots.filter((slot) => !slot.startsWith('BENCH'))
  const benchSlots = rosterSlots.filter((slot) => slot.startsWith('BENCH'))
  const budget = rosterTargetTotal(targetGoals)
  const remaining = budget - spent
  const pricedPicks = picks.filter(({ id }) => prices[id] !== undefined)
  const pace = pricedPicks.reduce((total, { id }) => total + (targetGoals[slots[id]] ?? DEFAULT_ROSTER_TARGETS[slots[id]] ?? 0) - (prices[id] ?? 0), 0)
  const positionsRemaining = Math.max(1, starterSlots.length + benchSlots.length - pricedPicks.length)
  const targetAdjustment = pace / positionsRemaining
  const targetQueueGroups = targetQueueView === 'normal'
    ? [{ key: 'all', label: '', rows: targetRows }]
    : ['QB', 'RB', 'WR', 'TE', 'K'].map((positionKey) => ({ key: positionKey, label: positionKey, rows: targetRows.filter((row) => row.position.toUpperCase() === positionKey) })).filter((group) => group.rows.length)

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
    onDragStateChange?.(id)
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', id)
  }

  function handleDrop(slot: string, event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    const id = event.dataTransfer.getData('text/plain') || draggingId
    if (id) onMoveSlot(id, slot)
    setDraggingId(null)
    onDragStateChange?.(null)
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
    {showTargetQueue ? <section className="auction-shortlist target-queue target-queue--embedded" aria-label="Target queue">
      <div className="auction-roster-panel__section-heading"><strong>Shortlist</strong><span>{targetRows.length}</span></div>
      {targetRows.length ? <div className="auction-shortlist__list">{targetQueueGroups.map((group) => <div className="auction-shortlist__group" key={group.key}>
        {group.label ? <h3>{group.label}</h3> : null}
        {group.rows.map((row) => {
        const id = rankingId(row)
        const team = normalizeTeamAbbreviation(row.team)
        const valueSummary = mode === 'auction' && source === 'espn' ? `${formatValue(row.sourceValue)} → ${formatValue(row.adjustedValue)}` : `Draft rank #${formatRank(row.sourceRank)} → #${formatRank(row.adjustedRank)}`
        return <button type="button" key={id} className="auction-shortlist__item" onClick={() => onTarget(id)} aria-label={`Remove target ${row.player}`}><span className={`auction-shortlist__pos pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span><span><strong>{row.player}</strong><small>{team} · {valueSummary}</small></span><span className="auction-shortlist__remove" aria-hidden="true" /></button>
      })}</div>)}</div> : <p className="auction-roster-panel__empty">Target players to keep a short list here.</p>}
    </section> : null}
    {mode === 'auction' ? <div className="auction-roster-panel__budget"><span>Budget remaining</span><strong className={remaining < 0 ? 'is-negative' : ''}>${remaining}</strong><small>of ${budget}</small></div> : null}
    <section className="auction-roster-panel__roster" aria-label="Roster slots">
      <div className="auction-roster-panel__section-heading"><strong>My roster</strong>{mode === 'auction' ? <span className={`auction-roster-panel__target-status ${pace > 0 ? 'is-under' : pace < 0 ? 'is-over' : 'is-even'}`}>{pace >= 0 ? `Under target ${pace === 0 ? '$0' : `$${Math.round(pace)}`}` : `Over target $${Math.abs(Math.round(pace))}`}</span> : null}</div>
      <div className="auction-roster-panel__list">
      {starterSlots.map(renderSlot)}
      </div>
      <div className="auction-bench"><div className="auction-roster-panel__section-heading"><strong>Bench</strong></div>{benchSlots.map(renderSlot)}</div>
    </section>
    {!picks.length ? <p className="auction-roster-panel__empty">No players on roster yet.</p> : null}
  </aside>
}
