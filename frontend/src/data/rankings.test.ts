import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RankingRow } from '../types'
import { applyAdjustedProfile, filterRankings, rankingDifference, sortRankings } from './rankings'
import { getTeamAsset, hasTeamLogo, normalizeTeamAbbreviation } from './teams'

const rows: RankingRow[] = [
  { player: 'Ja\'Marr Chase', team: 'CIN', position: 'WR', sourceRank: 1, adjustedRank: 3, diff: -2, positionTone: 'wr', diffTone: 'neutral' },
  { player: 'Josh Allen', team: 'BUF', position: 'QB', sourceRank: 10, adjustedRank: 6, diff: 4, positionTone: 'qb', diffTone: 'neutral' },
  { player: 'Kyren Williams', team: 'LA', position: 'RB', sourceRank: 22, adjustedRank: 41, diff: -19, positionTone: 'rb', diffTone: 'bad' }
]

describe('ranking helpers', () => {
  it('uses frontend-ready normalized ranking rows', () => {
    const generated = JSON.parse(readFileSync(join(process.cwd(), 'public/data/2026/fpros/rankings.json'), 'utf8'))
    expect(generated[0]).toMatchObject({ player: expect.any(String), team: expect.any(String), position: expect.any(String), sourceRank: expect.any(Number), adjustedRank: expect.any(Number) })
    expect(generated[0]).not.toHaveProperty('RK')
    expect(generated[0]).not.toHaveProperty('PPR')
  })

  it('normalizes ESPN salary cap pricing fields', () => {
    const generated = JSON.parse(readFileSync(join(process.cwd(), 'public/data/2025/espn/rankings.json'), 'utf8'))
    expect(generated[0]).toMatchObject({
      player: expect.any(String),
      sourceRank: expect.any(Number),
      adjustedRank: expect.any(Number),
      sourceValue: expect.any(Number),
      adjustedValue: expect.any(Number),
      priceRank: expect.any(Number)
    })
    expect(generated[0]).not.toHaveProperty('ESPN Value')
    expect(generated[0]).not.toHaveProperty('Adjusted Value')
    expect(generated[0]).not.toHaveProperty('PriceRank')
  })

  it('filters by search and position', () => {
    expect(filterRankings(rows, 'chase', 'ALL')).toHaveLength(1)
    expect(filterRankings(rows, '', 'QB').map((row) => row.player)).toEqual(['Josh Allen'])
  })

  it('filters by team abbreviation, city, or nickname', () => {
    const teamRows: RankingRow[] = [
      { player: 'Jahmyr Gibbs', team: 'DET', position: 'RB' },
      { player: 'Amon-Ra St. Brown', team: 'DET', position: 'WR' },
      { player: 'Josh Allen', team: 'BUF', position: 'QB' }
    ]
    const teams = {
      DET: { id: '8', abbreviation: 'DET', displayName: 'Detroit Lions', shortDisplayName: 'Lions' },
      BUF: { id: '4', abbreviation: 'BUF', displayName: 'Buffalo Bills', shortDisplayName: 'Bills' }
    }
    expect(filterRankings(teamRows, 'DET', 'ALL', teams).map((row) => row.player)).toEqual(['Jahmyr Gibbs', 'Amon-Ra St. Brown'])
    expect(filterRankings(teamRows, 'Detroit', 'ALL', teams)).toHaveLength(2)
    expect(filterRankings(teamRows, 'Lions', 'ALL', teams)).toHaveLength(2)
  })

  it('sorts numeric and text fields', () => {
    expect(sortRankings(rows, 'sourceRank', 'desc')[0].player).toBe('Kyren Williams')
    expect(sortRankings(rows, 'player', 'asc')[0].player).toBe('Ja\'Marr Chase')
  })

  it('normalizes team aliases', () => {
    expect(normalizeTeamAbbreviation('JAC')).toBe('JAX')
    expect(normalizeTeamAbbreviation('LA')).toBe('LAR')
    expect(normalizeTeamAbbreviation('WAS')).toBe('WSH')
  })

  it('detects missing-logo fallback state', () => {
    const teams = { CIN: { id: '4', abbreviation: 'CIN', displayName: 'Cincinnati Bengals', shortDisplayName: 'Bengals' } }
    expect(getTeamAsset(teams, 'CIN')?.displayName).toContain('Bengals')
    expect(hasTeamLogo(teams.CIN)).toBe(false)
  })

  it('recalculates rank deltas when the adjusted profile changes', () => {
    const yahooRows: RankingRow[] = [{
      player: 'Bijan Robinson', team: 'ATL', position: 'RB', sourceRank: 2,
      adjustedRank: 4, adjustedRankHalfPpr: 2, diff: -2, diffTone: 'neutral'
    }]
    expect(applyAdjustedProfile(yahooRows, 'full-ppr', 'yahoo-half')[0]).toMatchObject({ adjustedRank: 4, diff: -2 })
    expect(applyAdjustedProfile(yahooRows, 'half-ppr', 'yahoo-half')[0]).toMatchObject({ adjustedRank: 2, diff: 0, diffTone: 'neutral' })
  })

  it('keeps ESPN value deltas tied to values, not rank profile', () => {
    const espnRows: RankingRow[] = [{
      player: 'Player', team: 'ATL', position: 'RB', sourceRank: 2,
      adjustedRank: 4, adjustedRankHalfPpr: 3, sourceValue: 10, adjustedValue: 14, diff: 4
    }]
    expect(applyAdjustedProfile(espnRows, 'half-ppr', 'espn')[0]).toMatchObject({ adjustedRank: 3, diff: 4 })
  })

  it('calculates ESPN snake deltas from picks', () => {
    expect(rankingDifference({ sourceRank: 22, adjustedRank: 10, player: 'Kenneth Walker', team: 'KC', position: 'RB' })).toBe(12)
    expect(rankingDifference({ sourceRank: 198, adjustedRank: 115, player: 'Jordan Love', team: 'GB', position: 'QB' })).toBe(83)
    expect(rankingDifference({ player: 'Missing rank', team: 'FA', position: 'RB' })).toBeUndefined()
  })
})
