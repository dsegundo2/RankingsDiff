import type { DraftRankingRow, HistoricalDraftRow, HistoricalSlotSummary, HistoricalTierSummary } from '../types'

export const HISTORICAL_SEASONS = [2022, 2023, 2024, 2025] as const
export const POSITIONS = ['QB', 'RB', 'WR', 'TE'] as const
export type HistoricalYear = { season: number; paid: number; expected: number; over_under: number }

/** Estimate a current auction price from both historical ranking signals. */
export function historicalPriceEstimate(basePrice: number, positionDiff?: number | null, overallDiff?: number | null): number {
  const signals = [positionDiff, overallDiff].filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
  if (!signals.length) return basePrice
  const averageDiff = signals.reduce((sum, value) => sum + value, 0) / signals.length
  // Round ties toward the higher dollar value: -2.5 becomes -2, 2.5 becomes 3.
  return Math.round(basePrice + Math.ceil(averageDiff))
}

export function median(values: number[]): number {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function tierSize(draftSize = 10): number {
  return draftSize >= 12 ? 5 : 6
}

function byPrice(left: DraftRankingRow, right: DraftRankingRow): number {
  return right.offer_amount - left.offer_amount || left.rank - right.rank
}

/** Adds stable ranks based on what the room actually paid, not source rank. */
export function enrichDraftRows(rows: DraftRankingRow[], draftSize = 10): HistoricalDraftRow[] {
  const ordered = [...rows].sort(byPrice)
  const positionRanks = new Map<string, number>()
  POSITIONS.forEach((position) => {
    ordered.filter((row) => row.position.toUpperCase() === position).forEach((row, index) => positionRanks.set(`${row.player}|${row.nfl_team}`, index + 1))
  })
  const size = tierSize(draftSize)
  return rows.map((row) => {
    const positionRank = positionRanks.get(`${row.player}|${row.nfl_team}`) ?? 0
    const tier = positionRank ? Math.ceil(positionRank / size) : 0
    return { ...row, overall_rank: ordered.findIndex((candidate) => candidate === row) + 1, position_rank: positionRank, tier, tier_label: positionRank ? `${row.position}${(tier - 1) * size + 1}–${tier * size}` : '—' }
  })
}

function weightedAverage(values: Array<{ value: number; weight: number }>): number | null {
  if (!values.length) return null
  const weight = values.reduce((sum, item) => sum + item.weight, 0)
  return values.reduce((sum, item) => sum + item.value * item.weight, 0) / weight
}

function recentWeight(season: number): number {
  const index = HISTORICAL_SEASONS.indexOf(season as typeof HISTORICAL_SEASONS[number])
  return index < 0 ? 1 : index + 1
}

export function slotSummaries(rowsBySeason: Record<number, DraftRankingRow[]>, position: string, draftSize = 10): HistoricalSlotSummary[] {
  const byRank = new Map<number, Array<{ paid: number; expected: number; delta: number; weight: number }>>()
  HISTORICAL_SEASONS.forEach((season) => enrichDraftRows(rowsBySeason[season] ?? [], draftSize).filter((row) => row.position.toUpperCase() === position).forEach((row) => {
    const values = byRank.get(row.position_rank) ?? []
    values.push({ paid: row.offer_amount, expected: row.espn_suggested_value, delta: row.value_diff, weight: recentWeight(season) })
    byRank.set(row.position_rank, values)
  }))
  return [...byRank.entries()].sort(([left], [right]) => left - right).map(([rank, values]) => ({
    rank, position, sample_size: values.length,
    average_paid: weightedAverage(values.map((value) => ({ value: value.paid, weight: value.weight }))),
    average_expected: weightedAverage(values.map((value) => ({ value: value.expected, weight: value.weight }))),
    average_over_under: weightedAverage(values.map((value) => ({ value: value.delta, weight: value.weight }))),
    highest_paid: Math.max(...values.map((value) => value.paid)),
    lowest_paid: Math.min(...values.map((value) => value.paid))
  }))
}

export function overallSummaries(rowsBySeason: Record<number, DraftRankingRow[]>, draftSize = 10): HistoricalSlotSummary[] {
  const byRank = new Map<number, Array<{ paid: number; expected: number; delta: number; weight: number }>>()
  HISTORICAL_SEASONS.forEach((season) => enrichDraftRows(rowsBySeason[season] ?? [], draftSize).forEach((row) => {
    const values = byRank.get(row.overall_rank) ?? []
    values.push({ paid: row.offer_amount, expected: row.espn_suggested_value, delta: row.value_diff, weight: recentWeight(season) })
    byRank.set(row.overall_rank, values)
  }))
  return [...byRank.entries()].sort(([left], [right]) => left - right).map(([rank, values]) => ({
    rank, position: 'OVERALL', sample_size: values.length,
    average_paid: weightedAverage(values.map((value) => ({ value: value.paid, weight: value.weight }))),
    average_expected: weightedAverage(values.map((value) => ({ value: value.expected, weight: value.weight }))),
    average_over_under: weightedAverage(values.map((value) => ({ value: value.delta, weight: value.weight }))),
    highest_paid: Math.max(...values.map((value) => value.paid)),
    lowest_paid: Math.min(...values.map((value) => value.paid))
  }))
}

export function slotHistory(rowsBySeason: Record<number, DraftRankingRow[]>, position: string, rank: number, draftSize = 10): HistoricalYear[] {
  return rankHistory(rowsBySeason, (row) => row.position.toUpperCase() === position && row.position_rank === rank, draftSize)
}

export function overallSlotHistory(rowsBySeason: Record<number, DraftRankingRow[]>, rank: number, draftSize = 10): HistoricalYear[] {
  return rankHistory(rowsBySeason, (row) => row.overall_rank === rank, draftSize)
}

function rankHistory(rowsBySeason: Record<number, DraftRankingRow[]>, matches: (row: HistoricalDraftRow) => boolean, draftSize: number): HistoricalYear[] {
  return HISTORICAL_SEASONS.flatMap((season) => {
    const match = enrichDraftRows(rowsBySeason[season] ?? [], draftSize).find(matches)
    return match ? [{ season, paid: match.offer_amount, expected: match.espn_suggested_value, over_under: match.value_diff }] : []
  })
}

export function tierSummaries(rowsBySeason: Record<number, DraftRankingRow[]>, position: string, draftSize = 10): HistoricalTierSummary[] {
  const size = tierSize(draftSize)
  const slots = slotSummaries(rowsBySeason, position, draftSize)
  const byTier = new Map<number, HistoricalSlotSummary[]>()
  slots.forEach((slot) => { const tier = Math.ceil(slot.rank / size); byTier.set(tier, [...(byTier.get(tier) ?? []), slot]) })
  return [...byTier.entries()].map(([tier, values]) => ({
    rank: tier, position, start_rank: (tier - 1) * size + 1, end_rank: tier * size,
    sample_size: values.reduce((sum, value) => sum + value.sample_size, 0),
    highest_paid: Math.max(...values.flatMap((value) => value.highest_paid === null ? [] : [value.highest_paid])),
    lowest_paid: Math.min(...values.flatMap((value) => value.lowest_paid === null ? [] : [value.lowest_paid])),
    average_paid: weightedAverage(values.flatMap((value) => value.average_paid === null ? [] : [{ value: value.average_paid, weight: value.sample_size }])),
    average_expected: weightedAverage(values.flatMap((value) => value.average_expected === null ? [] : [{ value: value.average_expected, weight: value.sample_size }])),
    average_over_under: weightedAverage(values.flatMap((value) => value.average_over_under === null ? [] : [{ value: value.average_over_under, weight: value.sample_size }]))
  }))
}
