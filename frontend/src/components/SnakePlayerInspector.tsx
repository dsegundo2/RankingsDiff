import { useRef, useState, type KeyboardEvent, type PointerEvent as ReactPointerEvent } from 'react'
import type { RankingRow, TeamAsset, YahooProjection } from '../types'
import { formatRank } from '../data/rankings'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'
import { withBasePath } from '../data/paths'

type Props = { row: RankingRow; allRows: RankingRow[]; teams: Record<string, TeamAsset>; projection?: YahooProjection; favorited: boolean; onFavorite: () => void; onClose: () => void; onDraft: () => void; onAdd: () => void; onNavigate: (direction: -1 | 1) => void; onDragOffsetChange: (offset: { x: number; y: number }) => void; dragOffset: { x: number; y: number } }

export function SnakePlayerInspector({ row, allRows, teams, projection, favorited, onFavorite, onClose, onDraft, onAdd, onNavigate, onDragOffsetChange, dragOffset }: Props) {
  const [focusedAction, setFocusedAction] = useState<'draft' | 'team'>('draft')
  const dragStart = useRef<{ pointerId: number; x: number; y: number; offsetX: number; offsetY: number } | null>(null)
  const draftButton = useRef<HTMLButtonElement>(null)
  const teamButton = useRef<HTMLButtonElement>(null)
  const position = row.position.toUpperCase()
  const team = normalizeTeamAbbreviation(row.team)
  const positionRank = allRows
    .filter((candidate) => candidate.position.toUpperCase() === position)
    .sort((left, right) => (left.sourceRank ?? Number.MAX_SAFE_INTEGER) - (right.sourceRank ?? Number.MAX_SAFE_INTEGER))
    .findIndex((candidate) => candidate.player === row.player && normalizeTeamAbbreviation(candidate.team) === team) + 1
  const seasonProjection = projection?.seasonPpr
  const week1Projection = projection?.week1Ppr

  function handleActionKeys(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); if (focusedAction === 'draft') onDraft(); else onAdd(); return }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); event.stopPropagation(); onNavigate(event.key === 'ArrowUp' ? -1 : 1); return }
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
  function handleDragEnd(event: ReactPointerEvent<HTMLElement>) { if (dragStart.current?.pointerId === event.pointerId) dragStart.current = null }

  return <div className="inspector-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="auction-inspector snake-inspector" style={{ transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }} role="dialog" aria-modal="true" aria-labelledby="snake-inspector-title" onKeyDown={handleActionKeys}>
      <header className="auction-inspector__header" onPointerDown={handleDragStart} onPointerMove={handleDragMove} onPointerUp={handleDragEnd} onPointerCancel={handleDragEnd}>
        <div className="auction-inspector__player"><TeamBadge team={team} asset={getTeamAsset(teams, team)} />{row.headshotUrl ? <img className="snake-inspector__headshot" src={row.headshotUrl} alt="" width="48" height="48" /> : null}<div><span className="eyebrow">{position} #{positionRank || '—'} · snake draft</span><h2 id="snake-inspector-title">{row.player}</h2><p className="snake-inspector__team">{getTeamAsset(teams, team)?.displayName ?? team}</p></div></div>
        <div className="auction-inspector__header-actions"><img className="auction-inspector__brand-mark" src={withBasePath('/assets/rankingsdiff-mark.png')} alt="Draft Distillery" /><button className={`icon-action target-action${favorited ? ' active' : ''}`} type="button" aria-label={favorited ? `Remove ${row.player} favorite` : `Favorite ${row.player}`} aria-pressed={favorited} title={favorited ? 'Remove favorite' : 'Favorite'} onClick={onFavorite}>★</button><button className="icon-action" type="button" aria-label="Close player details" onClick={onClose}>×</button></div>
      </header>
      <div className="auction-inspector__pills"><span>BASE {formatRank(row.sourceRank)}</span><span>ADJ {formatRank(row.adjustedRank)}</span></div>
      <div className="auction-inspector__stats"><article><strong>{formatRank(positionRank)}</strong><small>{position} number</small></article><article><strong>{typeof seasonProjection === 'number' ? seasonProjection.toFixed(2) : '—'}</strong><small>Season proj</small></article><article><strong>{typeof week1Projection === 'number' ? week1Projection.toFixed(2) : '—'}</strong><small>Week 1 proj</small></article></div>
      <footer className="auction-inspector__actions"><button ref={draftButton} autoFocus className={`primary-action${focusedAction === 'draft' ? ' action-focused' : ''}`} type="button" onMouseEnter={() => setFocusedAction('draft')} onClick={onDraft}>Draft</button><button ref={teamButton} className={`secondary-action${focusedAction === 'team' ? ' action-focused' : ''}`} type="button" onMouseEnter={() => setFocusedAction('team')} onFocus={() => setFocusedAction('team')} onClick={onAdd}>Add to team</button></footer>
    </section>
  </div>
}
