import { describe, expect, it } from 'vitest'
import { enrichDraftRows, overallSummaries, slotSummaries, tierSize, tierSummaries } from './draftAnalytics'
import type { DraftRankingRow } from '../types'

const row = (player: string, position: string, paid: number, expected = paid - 2): DraftRankingRow => ({ manager: 'A', rank: 1, player, nfl_team: player, position, offer_amount: paid, espn_suggested_value: expected, value_diff: paid - expected })

describe('draft analytics', () => {
  it('uses auction prices to derive position ranks and configurable tiers', () => {
    const rows = [row('RB one', 'RB', 50), row('RB two', 'RB', 40), row('WR one', 'WR', 60)]
    expect(tierSize(10)).toBe(6)
    expect(tierSize(12)).toBe(5)
    expect(enrichDraftRows(rows)[1]).toMatchObject({ overall_rank: 3, position_rank: 2, tier: 1, tier_label: 'RB1–6' })
  })

  it('summarizes exact slots and tiers with recent seasons weighted more', () => {
    const rowsBySeason = { 2022: [row('RB one', 'RB', 40)], 2023: [row('RB one', 'RB', 50)], 2024: [row('RB one', 'RB', 60)], 2025: [row('RB one', 'RB', 70)] }
    expect(slotSummaries(rowsBySeason, 'RB')[0]).toMatchObject({ rank: 1, sample_size: 4, average_paid: 60 })
    expect(tierSummaries(rowsBySeason, 'RB')[0]).toMatchObject({ start_rank: 1, end_rank: 6, average_paid: 60, average_over_under: 2 })
  })

  it('summarizes overall paid slots separately from positional slots', () => {
    const rowsBySeason = { 2022: [row('RB one', 'RB', 60), row('WR one', 'WR', 50)], 2023: [row('RB one', 'RB', 70), row('WR one', 'WR', 40)] }
    expect(overallSummaries(rowsBySeason)).toHaveLength(2)
    expect(overallSummaries(rowsBySeason)[0]).toMatchObject({ position: 'OVERALL', rank: 1 })
    expect(overallSummaries(rowsBySeason)[0].average_paid).toBeCloseTo(66.67, 2)
  })
})
