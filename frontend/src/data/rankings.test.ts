import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RankingRow } from '../types'
import { filterRankings, sortRankings } from './rankings'
import { getTeamAsset, hasTeamLogo, normalizeTeamAbbreviation } from './teams'

const rows: RankingRow[] = [
  { player: 'Ja\'Marr Chase', team: 'CIN', position: 'WR', sourceRank: 1, underdogRank: 3, diff: -2, positionTone: 'wr', diffTone: 'neutral' },
  { player: 'Josh Allen', team: 'BUF', position: 'QB', sourceRank: 10, underdogRank: 6, diff: 4, positionTone: 'qb', diffTone: 'neutral' },
  { player: 'Kyren Williams', team: 'LA', position: 'RB', sourceRank: 22, underdogRank: 41, diff: -19, positionTone: 'rb', diffTone: 'bad' }
]

describe('ranking helpers', () => {
  it('uses frontend-ready normalized ranking rows', () => {
    const generated = JSON.parse(readFileSync(join(process.cwd(), 'public/data/2026/fpros/rankings.json'), 'utf8'))
    expect(generated[0]).toMatchObject({ player: expect.any(String), team: expect.any(String), position: expect.any(String), sourceRank: expect.any(Number), underdogRank: expect.any(Number) })
    expect(generated[0]).not.toHaveProperty('RK')
    expect(generated[0]).not.toHaveProperty('PPR')
  })

  it('normalizes ESPN salary cap pricing fields', () => {
    const generated = JSON.parse(readFileSync(join(process.cwd(), 'public/data/2025/espn/rankings.json'), 'utf8'))
    expect(generated[0]).toMatchObject({
      player: expect.any(String),
      sourceRank: expect.any(Number),
      underdogRank: expect.any(Number),
      sourceValue: expect.any(Number),
      underdogValue: expect.any(Number),
      priceRank: expect.any(Number)
    })
    expect(generated[0]).not.toHaveProperty('ESPN Value')
    expect(generated[0]).not.toHaveProperty('UD Value')
    expect(generated[0]).not.toHaveProperty('PriceRank')
  })

  it('filters by search and position', () => {
    expect(filterRankings(rows, 'chase', 'ALL')).toHaveLength(1)
    expect(filterRankings(rows, '', 'QB').map((row) => row.player)).toEqual(['Josh Allen'])
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
})
