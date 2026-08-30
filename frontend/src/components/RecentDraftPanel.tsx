import { useState, type DragEvent } from 'react'
import type { RankingRow, TeamAsset } from '../types'
import { draftPickLabel, draftPickOrder, rankingId, snakePickDetails } from '../data/draftState'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = { rows: RankingRow[]; drafted: Set<string>; picks: Record<string, number>; draftSize: number; includeKeeperRound: boolean; mine: Set<string>; teams: Record<string, TeamAsset>; mode: 'auction' | 'snake'; onMine: (id: string) => void; onUndraft: (id: string) => void; onPick: (id: string, value: number | undefined) => void; onReorder: (fromId: string, toId: string) => void }

/** A compact, chronological audit trail for draft picks. */
export function RecentDraftPanel({ rows, drafted, picks, draftSize, includeKeeperRound, mine, teams, mode, onMine, onUndraft, onPick, onReorder }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const rowById = new Map(rows.map((row) => [rankingId(row), row]))
  const recentRows = [...drafted].map((id, index) => ({ id, row: rowById.get(id), order: picks[id] ?? index + 1 })).filter((item): item is { id: string; row: RankingRow; order: number } => Boolean(item.row)).sort((left, right) => draftPickOrder(right.order, draftSize, includeKeeperRound) - draftPickOrder(left.order, draftSize, includeKeeperRound)).map((item) => item.row)
  if (!recentRows.length) return null

  return (
    <section className="recent-draft" aria-label="Recent draft picks">
      {recentRows.length ? <ol className="recent-draft__list">
        {recentRows.slice(0, 12).map((row) => {
          const team = normalizeTeamAbbreviation(row.team)
          const id = rankingId(row)
          const isMine = mine.has(id)
          const overallPick = picks[id]
          const details = mode === 'snake' && Number.isInteger(overallPick) && overallPick !== 0 ? snakePickDetails(overallPick, draftSize, includeKeeperRound) : undefined
          return <li key={id} className={isMine ? 'is-mine' : ''} draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move'; setDraggingId(id) }} onDragEnd={() => setDraggingId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLLIElement>) => { event.preventDefault(); const sourceId = event.dataTransfer.getData('text/plain') || draggingId; if (sourceId && sourceId !== id) onReorder(sourceId, id); setDraggingId(null) }}>
            <div className="recent-draft__player"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><span className="recent-draft__identity"><strong>{row.player}</strong><small className="recent-draft__details"><span>{row.team} · {row.position}</span>{mode === 'snake' ? <><span aria-hidden="true">·</span><input className="recent-draft__pick-input" aria-label={`Overall pick for ${row.player}`} type="number" step="1" value={picks[id] ?? ''} onChange={(event) => onPick(id, event.target.value === '' ? undefined : Number(event.target.value))} />{details ? <span className="recent-draft__round-pick" aria-label={draftPickLabel(overallPick, details)}>{draftPickLabel(overallPick, details)}</span> : null}</> : null}</small></span></div>
            <div className="recent-draft__actions" aria-label={`Actions for ${row.player}`}>
              <button className={`recent-draft__mine ${isMine ? 'active' : ''}`} type="button" aria-label={`${isMine ? 'Remove' : 'Add'} ${row.player} ${isMine ? 'from' : 'to'} my roster`} aria-pressed={isMine} onClick={() => onMine(id)}>{isMine ? '✓' : '+'}</button>
              <button className="recent-draft__hide" type="button" aria-label={`Undraft ${row.player}`} onClick={() => onUndraft(id)}>×</button>
            </div>
          </li>
        })}
      </ol> : null}
    </section>
  )
}
