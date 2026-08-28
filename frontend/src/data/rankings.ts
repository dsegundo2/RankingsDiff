import type { DiffTone, PositionFilter, RankingRow, SortDirection, SortKey, TeamAsset } from '../types'
import { getTeamAsset } from './teams'

export type RegressionLine = { slope: number; intercept: number }

function rankingDiffTone(diff: number | undefined): DiffTone {
  if (diff === undefined) return 'neutral'
  if (diff >= 20) return 'very-good'
  if (diff >= 8) return 'good'
  if (diff <= -20) return 'very-bad'
  if (diff <= -8) return 'bad'
  return 'neutral'
}

/**
 * Apply the selected adjusted-rank profile to rows and recalculate every
 * value that depends on it. The generated JSON keeps the full-PPR values in
 * `adjustedRank` for backwards compatibility, so switching to half PPR must
 * not leave the old full-PPR delta behind.
 */
export function applyAdjustedProfile(rows: RankingRow[], profileId: string, source: string): RankingRow[] {
  return rows.map((row) => {
    const adjustedRank = profileId === 'half-ppr' ? row.adjustedRankHalfPpr ?? row.adjustedRank : row.adjustedRank
    const diff = source === 'espn' || source === 'espn-auction'
      ? typeof row.sourceValue === 'number' && typeof row.adjustedValue === 'number'
        ? row.adjustedValue - row.sourceValue
        : undefined
      : typeof row.sourceRank === 'number' && typeof adjustedRank === 'number'
        ? row.sourceRank - adjustedRank
        : undefined
    return { ...row, adjustedRank, diff, diffTone: rankingDiffTone(diff) }
  })
}

function validRankPair(row: RankingRow): boolean {
  return typeof row.sourceRank === 'number' && Number.isFinite(row.sourceRank) && row.sourceRank > 0 && typeof row.adjustedRank === 'number' && Number.isFinite(row.adjustedRank) && row.adjustedRank > 0
}

export function calculateRegression(rows: RankingRow[]): RegressionLine {
  const points = rows.filter((row) => typeof row.sourceRank === 'number' && Number.isFinite(row.sourceRank) && row.sourceRank > 0 && typeof row.adjustedRank === 'number' && Number.isFinite(row.adjustedRank) && row.adjustedRank > 0)
  if (points.length < 2) return { slope: 1, intercept: 0 }
  const meanX = points.reduce((sum, row) => sum + (row.sourceRank ?? 0), 0) / points.length
  const meanY = points.reduce((sum, row) => sum + (row.adjustedRank ?? 0), 0) / points.length
  const numerator = points.reduce((sum, row) => sum + ((row.sourceRank ?? 0) - meanX) * ((row.adjustedRank ?? 0) - meanY), 0)
  const denominator = points.reduce((sum, row) => sum + ((row.sourceRank ?? 0) - meanX) ** 2, 0)
  const slope = denominator ? numerator / denominator : 0
  return { slope, intercept: meanY - slope * meanX }
}

export function regressionDifference(row: RankingRow, line: RegressionLine, referenceRows: RankingRow[] = []): number | undefined {
  return trendScore(row, line, referenceRows)
}

function standardDeviation(values: number[]): number {
  if (values.length < 2) return 1
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length
  return Math.max(1, Math.sqrt(variance))
}

/**
 * Return a standardized residual: positive means the adjusted rank is better
 * (numerically lower) than the trend predicts. Local rank-band spread keeps
 * later-board variance from dominating the comparison.
 */
export function trendScore(row: RankingRow, line: RegressionLine, referenceRows: RankingRow[] = []): number | undefined {
  if (!validRankPair(row)) return undefined
  const residual = line.slope * (row.sourceRank ?? 0) + line.intercept - (row.adjustedRank ?? 0)
  if (!Number.isFinite(residual)) return undefined
  const points = referenceRows.filter(validRankPair)
  if (points.length < 2) return residual
  const residuals = points.map((point) => line.slope * (point.sourceRank ?? 0) + line.intercept - (point.adjustedRank ?? 0))
  const globalScale = standardDeviation(residuals)
  const minRank = Math.min(...points.map((point) => point.sourceRank ?? 0))
  const maxRank = Math.max(...points.map((point) => point.sourceRank ?? 0))
  const bandWidth = Math.max(1, (maxRank - minRank) / 5)
  const band = Math.min(4, Math.floor(((row.sourceRank ?? minRank) - minRank) / bandWidth))
  const bandResiduals = points.flatMap((point, index) => {
    const pointBand = Math.min(4, Math.floor(((point.sourceRank ?? minRank) - minRank) / bandWidth))
    return pointBand === band ? [residuals[index]] : []
  })
  const scale = bandResiduals.length >= 4 ? standardDeviation(bandResiduals) : globalScale
  return residual / scale
}

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

export function formatSignedRank(value?: number): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—'
  if (Math.abs(value) < 0.05) return '0.0'
  return `${value > 0 ? '+' : ''}${value.toFixed(1)}`
}

/**
 * ESPN's rank delta is the pick movement in snake drafts. ESPN rows also carry
 * auction values, so the generic `diff` field is intentionally value-based
 * there and must not be reused for the snake display.
 */
export function rankingDifference(row: RankingRow): number | undefined {
  if (typeof row.sourceRank !== 'number' || !Number.isFinite(row.sourceRank) || typeof row.adjustedRank !== 'number' || !Number.isFinite(row.adjustedRank)) return undefined
  return row.sourceRank - row.adjustedRank
}

export type AdjustedRankTone = 'positive' | 'negative' | 'neutral'

/**
 * Highlight meaningful adjusted-rank movement without making small changes
 * noisy. A populated trend score uses the requested +/-1.0 signal; the raw
 * rank movement fallback scales by 2 spots per 12-player draft round.
 */
export function adjustedRankTone(row: RankingRow, draftSize = 12): AdjustedRankTone {
  if (typeof row.regressionDiff === 'number' && Number.isFinite(row.regressionDiff)) {
    if (row.regressionDiff >= 1) return 'positive'
    if (row.regressionDiff <= -1) return 'negative'
  }
  if (typeof row.sourceRank !== 'number' || typeof row.adjustedRank !== 'number') return 'neutral'
  const movement = row.sourceRank - row.adjustedRank
  const round = Math.max(1, Math.ceil(row.sourceRank / draftSize))
  const threshold = round * 2
  if (movement >= threshold) return 'positive'
  if (movement <= -threshold) return 'negative'
  return 'neutral'
}

export function sourceLabel(id: string): string {
  if (id === 'fpros') return 'Fantasy Pros'
  if (id === 'espn') return 'ESPN'
  if (id === 'espn-auction') return 'ESPN Auction'
  if (id === 'yahoo-half') return 'Yahoo Half PPR'
  if (id === 'yahoo-full') return 'Yahoo Full PPR'
  return id.toUpperCase()
}
