import type { PositionFilter, RankingRow, SortDirection, SortKey, TeamAsset } from '../types'
import { getTeamAsset } from './teams'

export function yahooProjectionId(player: string, team: string): string {
  // Rankings exports may include the bye week (for example, "ATL (11)").
  // Yahoo's player feed only uses the abbreviation, so keep both sides on the
  // same stable player/team key.
  return `${player.trim().toLowerCase()}|${team.trim().toLowerCase().split(/\s|\(/)[0]}`
}

export function filterRankings(rows: RankingRow[], search: string, position: PositionFilter, teams?: Record<string, TeamAsset>): RankingRow[] {
  const query = search.trim().toLowerCase()
  return rows.filter((row) => {
    const matchesPosition = position === 'ALL' || row.position.toUpperCase() === position
    if (!matchesPosition) return false
    if (!query) return true
    const team = getTeamAsset(teams ?? {}, row.team)
    return [row.player, row.team, team?.displayName, team?.shortDisplayName, row.position, row.positionRank, row.notes, row.yahooProjection]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query))
  })
}

function comparable(value: RankingRow[SortKey], key: SortKey): string | number {
  if (value === undefined || value === null) return key === 'player' || key === 'position' ? '' : Number.POSITIVE_INFINITY
  return typeof value === 'string' ? value.toLowerCase() : value
}

export function sortRankings(rows: RankingRow[], key: SortKey, direction: SortDirection): RankingRow[] {
  const multiplier = direction === 'asc' ? 1 : -1
  return [...rows].sort((a, b) => {
    const left = comparable(a[key], key)
    const right = comparable(b[key], key)
    if (left < right) return -1 * multiplier
    if (left > right) return 1 * multiplier
    return (a.sourceRank ?? 9999) - (b.sourceRank ?? 9999)
  })
}

export function formatRank(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '—'
}

export function formatValue(value?: number): string {
  return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString()}` : '—'
}

export function formatSignedValue(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  const absolute = Math.abs(value).toLocaleString()
  if (value === 0) return '$0'
  return `${value > 0 ? '+' : '-'}$${absolute}`
}

export function sourceLabel(id: string): string {
  if (id === 'fpros') return 'FPros'
  if (id === 'espn') return 'ESPN'
  return id.toUpperCase()
}
