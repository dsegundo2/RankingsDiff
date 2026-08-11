import { useState, type DragEvent } from 'react'
import type { RankingRow, TeamAsset } from '../types'
import { rankingId } from '../data/draftState'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'

type Props = { rows: RankingRow[]; drafted: Set<string>; picks: Record<string, number>; mine: Set<string>; teams: Record<string, TeamAsset>; mode: 'auction' | 'snake'; onMine: (id: string) => void; onPick: (id: string, value: number | undefined) => void; onReorder: (fromId: string, toId: string) => void }

/** A compact, chronological audit trail for draft picks. */
export function RecentDraftPanel({ rows, drafted, picks, mine, teams, mode, onMine, onPick, onReorder }: Props) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const rowById = new Map(rows.map((row) => [rankingId(row), row]))
  const recentRows = [...drafted].map((id) => rowById.get(id)).filter((row): row is RankingRow => Boolean(row)).reverse()
  if (!recentRows.length) return null

  return (
    <section className="recent-draft" aria-label="Recent draft picks">
      {recentRows.length ? <ol className="recent-draft__list">
        {recentRows.slice(0, 12).map((row) => {
          const team = normalizeTeamAbbreviation(row.team)
          const id = rankingId(row)
          const isMine = mine.has(id)
          return <li key={id} className={isMine ? 'is-mine' : ''} draggable onDragStart={(event) => { event.dataTransfer.setData('text/plain', id); event.dataTransfer.effectAllowed = 'move'; setDraggingId(id) }} onDragEnd={() => setDraggingId(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event: DragEvent<HTMLLIElement>) => { event.preventDefault(); const sourceId = event.dataTransfer.getData('text/plain') || draggingId; if (sourceId && sourceId !== id) onReorder(sourceId, id); setDraggingId(null) }}>
            <div className="recent-draft__player"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><span className="recent-draft__identity"><strong>{row.player}</strong><button className={`recent-draft__mine ${isMine ? 'active' : ''}`} type="button" aria-label={`${isMine ? 'Remove' : 'Add'} ${row.player} ${isMine ? 'from' : 'to'} my roster`} aria-pressed={isMine} onClick={() => onMine(id)}>{isMine ? '✓' : '+'}</button><small>{row.team} · {row.position}{mode === 'snake' ? <> · <input className="recent-draft__pick-input" aria-label={`Overall pick for ${row.player}`} type="number" min="1" step="1" value={picks[id] ?? ''} onChange={(event) => onPick(id, event.target.value === '' ? undefined : Number(event.target.value))} /></> : null}</small></span></div>
          </li>
        })}
      </ol> : null}
    </section>
  )
}
