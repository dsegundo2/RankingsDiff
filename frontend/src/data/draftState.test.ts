import { beforeEach, describe, expect, it } from 'vitest'
import { createDraftFile, createDraftShareUrl, draftPickForIndex, draftPickLabel, parseDraftFile, rankingId, readDraftShare, readDraftState, snakeOverallPick, snakePickDetails, writeDraftState } from './draftState'

describe('draft state', () => {
  beforeEach(() => localStorage.clear())

  it('creates a stable player identifier', () => {
    expect(rankingId({ player: ' Ja\'Marr Chase ', team: 'CIN', position: 'WR' })).toBe("ja'marr chase|cin")
  })

  it('round-trips target and drafted selections', () => {
    writeDraftState('draft', { targets: ['one'], drafted: ['two'], picks: {}, draftSlot: 2, draftSize: 12, includeKeeperRound: true })
    expect(readDraftState('draft')).toEqual({ targets: ['one'], drafted: ['two'], picks: {}, draftSlot: 2, draftSize: 12, includeKeeperRound: true })
  })

  it('recovers from invalid cached data', () => {
    localStorage.setItem('draft', '{broken')
    expect(readDraftState('draft')).toEqual({ targets: [], drafted: [], picks: {}, draftSlot: 2, draftSize: 12, includeKeeperRound: true })
  })

  it('exports and restores player-keyed draft files', () => {
    const file = createDraftFile(2026, 'espn', {
      targets: ["ja'marr chase|cin"],
      drafted: ['jahmyr gibbs|det', 'jahmyr gibbs|det'],
      picks: { "ja'marr chase|cin": 1 },
      draftSlot: 7,
      draftSize: 10,
      includeKeeperRound: true,
      mine: ["ja'marr chase|cin"],
      prices: { "ja'marr chase|cin": 55 },
      slots: { "ja'marr chase|cin": 'WR1' },
      targetGoals: { WR1: 45 }
    })
    expect(parseDraftFile(JSON.stringify(file))).toMatchObject({
      version: 2,
      season: 2026,
      source: 'espn',
      players: { targets: ["ja'marr chase|cin"], drafted: ['jahmyr gibbs|det'], draftSlot: 7, draftSize: 10 },
      roster: { mine: ["ja'marr chase|cin"], prices: { "ja'marr chase|cin": 55 }, slots: { "ja'marr chase|cin": 'WR1' } },
      targetGoals: { WR1: 45 }
    })
  })

  it('rejects files without stable player keys', () => {
    expect(() => parseDraftFile('{"version":2}')).toThrow(/valid Draft Distillery/)
  })

  it('keeps older player-only backups restorable', () => {
    const parsed = parseDraftFile(JSON.stringify({ version: 1, season: 2025, source: 'espn', players: { targets: ['one|atl'], drafted: ['two|cin'] } }))
    expect(parsed.roster).toEqual({ mine: [], prices: {}, slots: {} })
    expect(parsed.targetGoals).toEqual({})
  })

  it('round-trips a portable cross-device draft link', () => {
    const url = createDraftShareUrl(2026, 'espn', { targets: ["ja'marr chase|cin"], drafted: ['jahmyr gibbs|det'], picks: { 'jahmyr gibbs|det': 1 }, draftSlot: 9, draftSize: 10, includeKeeperRound: true })
    const shared = readDraftShare(new URL(url).searchParams.get('draft'))
    expect(shared).toEqual({ season: 2026, source: 'espn', targets: ["ja'marr chase|cin"], drafted: ['jahmyr gibbs|det'], picks: { 'jahmyr gibbs|det': 1 }, draftSlot: 9, draftSize: 10, includeKeeperRound: true })
  })

  it('maps keeper round picks before the regular snake rounds', () => {
    expect(draftPickForIndex(0, 12, true)).toBe(-1)
    expect(draftPickForIndex(11, 12, true)).toBe(-12)
    expect(draftPickForIndex(12, 12, true)).toBe(1)
    expect(snakeOverallPick(0, 2, 12, true)).toBe(-2)
    expect(snakeOverallPick(1, 2, 12, true)).toBe(2)
    expect(snakeOverallPick(2, 2, 12, true)).toBe(23)
    expect(snakePickDetails(-2, 12, true)).toEqual({ round: 0, pickInRound: 2 })
    expect(snakePickDetails(2, 12, true)).toEqual({ round: 1, pickInRound: 2 })
    expect(draftPickLabel(-2, { round: 0, pickInRound: 2 })).toBe('Keeper 2')
  })

  it('migrates saved keeper-inclusive overall picks', () => {
    localStorage.setItem('draft', JSON.stringify({ drafted: ['one'], picks: { one: 13 }, draftSize: 12, includeKeeperRound: true }))
    expect(readDraftState('draft').picks).toEqual({ one: 1 })
  })
})
