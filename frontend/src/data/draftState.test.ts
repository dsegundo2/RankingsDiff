import { beforeEach, describe, expect, it } from 'vitest'
import { createDraftFile, createDraftShareUrl, parseDraftFile, rankingId, readDraftShare, readDraftState, writeDraftState } from './draftState'

describe('draft state', () => {
  beforeEach(() => localStorage.clear())

  it('creates a stable player identifier', () => {
    expect(rankingId({ player: ' Ja\'Marr Chase ', team: 'CIN', position: 'WR' })).toBe("ja'marr chase|cin")
  })

  it('round-trips target and drafted selections', () => {
    writeDraftState('draft', { targets: ['one'], drafted: ['two'] })
    expect(readDraftState('draft')).toEqual({ targets: ['one'], drafted: ['two'] })
  })

  it('recovers from invalid cached data', () => {
    localStorage.setItem('draft', '{broken')
    expect(readDraftState('draft')).toEqual({ targets: [], drafted: [] })
  })

  it('exports and restores player-keyed draft files', () => {
    const file = createDraftFile(2026, 'espn', {
      targets: ["ja'marr chase|cin"],
      drafted: ['jahmyr gibbs|det', 'jahmyr gibbs|det']
    })
    expect(parseDraftFile(JSON.stringify(file))).toMatchObject({
      version: 1,
      season: 2026,
      source: 'espn',
      players: { targets: ["ja'marr chase|cin"], drafted: ['jahmyr gibbs|det'] }
    })
  })

  it('rejects files without stable player keys', () => {
    expect(() => parseDraftFile('{"version":2}')).toThrow(/valid RankingsDiff/)
  })

  it('round-trips a portable cross-device draft link', () => {
    const url = createDraftShareUrl(2026, 'espn', { targets: ["ja'marr chase|cin"], drafted: ['jahmyr gibbs|det'] })
    const shared = readDraftShare(new URL(url).searchParams.get('draft'))
    expect(shared).toEqual({ season: 2026, source: 'espn', targets: ["ja'marr chase|cin"], drafted: ['jahmyr gibbs|det'] })
  })
})
