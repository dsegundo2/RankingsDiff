import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { DraftRankingRow, RankingRow, TeamAsset } from '../types'
import { enrichDraftRows, overallSlotHistory, slotHistory, slotSummaries, type HistoricalYear } from '../data/draftAnalytics'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { formatSignedValue, formatValue, formatRank } from '../data/rankings'
import { TeamBadge } from './TeamBadge'

type Props = { row: RankingRow; allRows: RankingRow[]; draftedCount: number; dragOffset: { x: number; y: number }; rowsBySeason: Record<number, DraftRankingRow[]>; season: number; teams: Record<string, TeamAsset>; favorited: boolean; onFavorite: () => void; onClose: () => void; onDraft: () => void; onAdd: () => void; onNavigate: (direction: -1 | 1) => void; onDragOffsetChange: (offset: { x: number; y: number }) => void }
type HistorySummary = { average_expected: number | null; average_over_under: number | null }

function HistoryTable({ label, history, summary }: { label: string; history: HistoricalYear[]; summary?: HistorySummary }) {
  if (!history.length) return null
  return <div className="auction-inspector__history-group"><h3>{label}</h3><table><thead><tr><th>Year</th><th>Suggested</th><th>Paid</th><th>Diff</th></tr></thead><tbody>{history.map((item) => <tr key={item.season}><td>{item.season}</td><td>{formatValue(item.expected)}</td><td>{formatValue(item.paid)}</td><td className={item.over_under > 1 ? 'is-over' : item.over_under < -1 ? 'is-under' : ''}>{formatSignedValue(item.over_under)}</td></tr>)}</tbody>{summary ? <tfoot><tr><th>Average</th><td>{summary.average_expected == null ? '—' : formatValue(Math.round(summary.average_expected))}</td><td>—</td><td className={summary.average_over_under != null && summary.average_over_under > 1 ? 'is-over' : summary.average_over_under != null && summary.average_over_under < -1 ? 'is-under' : ''}>{summary.average_over_under == null ? '—' : formatSignedValue(Math.round(summary.average_over_under))}</td></tr></tfoot> : null}</table></div>
}

export function AuctionPlayerInspector({ row, allRows, dragOffset, rowsBySeason, season, teams, favorited, onFavorite, onClose, onDraft, onAdd, onNavigate, onDragOffsetChange }: Props) {
  const [focusedAction, setFocusedAction] = useState<'draft' | 'team'>('draft')
  const [historyExpanded, setHistoryExpanded] = useState(true)
  const dragStart = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const draftButton = useRef<HTMLButtonElement>(null)
  const teamButton = useRef<HTMLButtonElement>(null)
  const current = enrichDraftRows(rowsBySeason[season] ?? []).find((candidate) => candidate.player.toLowerCase() === row.player.toLowerCase() && normalizeTeamAbbreviation(candidate.nfl_team) === normalizeTeamAbbreviation(row.team))
  const position = row.position.toUpperCase()
  const parsedPositionRank = Number(row.positionRank?.replace(/\D/g, ''))
  const currentPositionRank = [...allRows].filter((candidate) => candidate.position.toUpperCase() === position).sort((left, right) => (left.sourceRank ?? Number.MAX_SAFE_INTEGER) - (right.sourceRank ?? Number.MAX_SAFE_INTEGER)).findIndex((candidate) => candidate.player === row.player && candidate.team === row.team) + 1
  const rank = current?.position_rank || (parsedPositionRank || currentPositionRank || 0)
  const overallRank = current?.overall_rank || row.sourceRank || 0
  const slots = slotSummaries(rowsBySeason, position)
  const slot = slots.find((item) => item.rank === rank)
  const yearHistory = slotHistory(rowsBySeason, position, rank)
  const overallHistory = overallSlotHistory(rowsBySeason, overallRank)
  const overallSlots = overallHistory.length ? { average_expected: overallHistory.reduce((sum, item) => sum + item.expected, 0) / overallHistory.length, average_over_under: overallHistory.reduce((sum, item) => sum + item.over_under, 0) / overallHistory.length } : undefined
  const team = normalizeTeamAbbreviation(row.team)
  const overUnder = slot?.average_over_under
  const historicalPrice = typeof row.sourceValue === 'number' && typeof overUnder === 'number' ? Math.round(row.sourceValue + overUnder) : row.sourceValue
  function handleActionKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation()
      if (focusedAction === 'draft') onDraft()
      else onAdd()
      return
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); event.stopPropagation()
      onNavigate(event.key === 'ArrowUp' ? -1 : 1)
      return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault(); event.stopPropagation()
    const next = focusedAction === 'draft' ? 'team' : 'draft'
    setFocusedAction(next)
    window.requestAnimationFrame(() => (next === 'draft' ? draftButton : teamButton).current?.focus())
  }
  function handleDragStart(event: ReactPointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest('button')) return
    dragStart.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, offsetX: dragOffset.x, offsetY: dragOffset.y }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  function handleDragMove(event: ReactPointerEvent<HTMLElement>) {
    if (!dragStart.current || dragStart.current.pointerId !== event.pointerId) return
    onDragOffsetChange({ x: dragStart.current.offsetX + event.clientX - dragStart.current.x, y: dragStart.current.offsetY + event.clientY - dragStart.current.y })
  }
  function handleDragEnd(event: ReactPointerEvent<HTMLElement>) {
    if (dragStart.current?.pointerId === event.pointerId) dragStart.current = null
  }
  return <div className="inspector-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="auction-inspector" style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }} role="dialog" aria-modal="true" aria-labelledby="auction-inspector-title" onKeyDown={handleActionKeys}>
      <header className="auction-inspector__header" onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd}><div className="auction-inspector__player"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><div><span className="eyebrow">{position}{rank || '—'} · historical signal</span><h2 id="auction-inspector-title">{row.player}</h2></div></div><div className="auction-inspector__header-actions"><button className={`icon-action target-action${favorited ? ' active' : ''}`} type="button" aria-label={favorited ? `Remove ${row.player} favorite` : `Favorite ${row.player}`} aria-pressed={favorited} title={favorited ? 'Remove favorite' : 'Favorite'} onClick={onFavorite}>★</button><button className="icon-action" type="button" aria-label="Close player details" onClick={onClose}>×</button></div></header>
      <div className="auction-inspector__pills"><span>OVR {formatRank(row.sourceRank)}</span><span>ADJ {formatRank(row.adjustedRank)}</span></div>
      <div className="auction-inspector__stats"><article><strong>{formatValue(row.sourceValue)}</strong><small>Base price</small></article><article><strong>{formatValue(row.adjustedValue)}</strong><small>Adjusted price</small></article><article className={overUnder !== null && typeof overUnder === 'number' && overUnder > 1 ? 'is-over' : overUnder !== null && typeof overUnder === 'number' && overUnder < -1 ? 'is-under' : ''}><strong>{formatValue(historicalPrice)}</strong><small>Historical price estimate</small></article></div>
      <details className="auction-inspector__history" open={historyExpanded} onToggle={(event) => setHistoryExpanded(event.currentTarget.open)}><summary><strong>Past years</strong><span>{historyExpanded ? 'Collapse' : 'Expand'}</span></summary><div><HistoryTable label={`${position}${rank || '—'}`} history={yearHistory} summary={slot} /><HistoryTable label={`Overall ${overallRank || '—'}`} history={overallHistory} summary={overallSlots} /></div></details>
      <footer className="auction-inspector__actions"><button ref={draftButton} autoFocus className={`primary-action${focusedAction === 'draft' ? ' action-focused' : ''}`} type="button" onMouseEnter={() => setFocusedAction('draft')} onClick={onDraft}>Draft</button><button ref={teamButton} className={`secondary-action${focusedAction === 'team' ? ' action-focused' : ''}`} type="button" onMouseEnter={() => setFocusedAction('team')} onFocus={() => setFocusedAction('team')} onClick={onAdd}>Add to team</button></footer>
    </section>
  </div>
}
