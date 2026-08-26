import { useRef, useState, type KeyboardEvent } from 'react'
import type { DraftRankingRow, RankingRow, TeamAsset } from '../types'
import { enrichDraftRows, slotSummaries, tierSummaries } from '../data/draftAnalytics'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { formatSignedValue, formatValue, formatRank } from '../data/rankings'
import { TeamBadge } from './TeamBadge'

type Props = { row: RankingRow; allRows: RankingRow[]; rowsBySeason: Record<number, DraftRankingRow[]>; season: number; teams: Record<string, TeamAsset>; favorited: boolean; onFavorite: () => void; onClose: () => void; onDraft: () => void; onAdd: () => void }

export function AuctionPlayerInspector({ row, allRows, rowsBySeason, season, teams, favorited, onFavorite, onClose, onDraft, onAdd }: Props) {
  const [focusedAction, setFocusedAction] = useState<'draft' | 'team'>('draft')
  const draftButton = useRef<HTMLButtonElement>(null)
  const teamButton = useRef<HTMLButtonElement>(null)
  const current = enrichDraftRows(rowsBySeason[season] ?? []).find((candidate) => candidate.player.toLowerCase() === row.player.toLowerCase() && normalizeTeamAbbreviation(candidate.nfl_team) === normalizeTeamAbbreviation(row.team))
  const position = row.position.toUpperCase()
  const parsedPositionRank = Number(row.positionRank?.replace(/\D/g, ''))
  const currentPositionRank = [...allRows].filter((candidate) => candidate.position.toUpperCase() === position).sort((left, right) => (left.sourceRank ?? Number.MAX_SAFE_INTEGER) - (right.sourceRank ?? Number.MAX_SAFE_INTEGER)).findIndex((candidate) => candidate.player === row.player && candidate.team === row.team) + 1
  const rank = current?.position_rank || (parsedPositionRank || currentPositionRank || 0)
  const slots = slotSummaries(rowsBySeason, position)
  const slot = slots.find((item) => item.rank === rank)
  const tiers = tierSummaries(rowsBySeason, position)
  const tier = tiers.find((item) => rank >= item.start_rank && rank <= item.end_rank)
  const team = normalizeTeamAbbreviation(row.team)
  const overUnder = slot?.average_over_under
  function handleActionKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault(); event.stopPropagation()
    const next = focusedAction === 'draft' ? 'team' : 'draft'
    setFocusedAction(next)
    window.requestAnimationFrame(() => (next === 'draft' ? draftButton : teamButton).current?.focus())
  }
  return <div className="inspector-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="auction-inspector" role="dialog" aria-modal="true" aria-labelledby="auction-inspector-title" onKeyDown={handleActionKeys}>
      <header className="auction-inspector__header"><div className="auction-inspector__player"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><div><span className="eyebrow">{position}{rank || '—'} · historical signal</span><h2 id="auction-inspector-title">{row.player}</h2></div></div><div className="auction-inspector__header-actions"><button className={`favorite-inspector-action${favorited ? ' active' : ''}`} type="button" aria-label={favorited ? `Remove ${row.player} favorite` : `Favorite ${row.player}`} aria-pressed={favorited} onClick={onFavorite}>{favorited ? '★ Favorited' : '☆ Favorite'}</button><button className="icon-action" type="button" aria-label="Close player details" onClick={onClose}>×</button></div></header>
      <div className="auction-inspector__pills"><span>OVR {formatRank(row.sourceRank)}</span><span>ADJ {formatRank(row.adjustedRank)}</span><span>Tier {tier?.rank ?? '—'}</span></div>
      <div className="auction-inspector__stats"><article><strong>{formatValue(row.sourceValue)}</strong><small>Base price</small></article><article><strong>{formatValue(row.adjustedValue)}</strong><small>Adjusted price</small></article><article className={overUnder !== null && typeof overUnder === 'number' && overUnder > 1 ? 'is-over' : overUnder !== null && typeof overUnder === 'number' && overUnder < -1 ? 'is-under' : ''}><strong>{overUnder === null || overUnder === undefined ? '—' : formatSignedValue(Math.round(overUnder))}</strong><small>Historical O/U</small></article></div>
      <details className="auction-inspector__history"><summary><strong>Past years</strong><span>Expand</span></summary><div><p>{position}{rank || '—'} averaged <strong>{slot?.average_paid == null ? '—' : formatValue(Math.round(slot.average_paid))}</strong> across {slot?.sample_size ?? 0} seasons.</p><p>Tier {tier?.rank ?? '—'} averaged <strong>{tier?.average_paid == null ? '—' : formatValue(Math.round(tier.average_paid))}</strong> paid.</p></div></details>
      <footer className="auction-inspector__actions"><button ref={draftButton} autoFocus className={`primary-action${focusedAction === 'draft' ? ' action-focused' : ''}`} type="button" onClick={onDraft}>Draft</button><button ref={teamButton} className={`secondary-action${focusedAction === 'team' ? ' action-focused' : ''}`} type="button" onFocus={() => setFocusedAction('team')} onClick={onAdd}>Add to team</button></footer>
    </section>
  </div>
}
