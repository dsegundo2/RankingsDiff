import { beforeEach, describe, expect, it } from 'vitest'
import { rankingId, readDraftState, writeDraftState } from './draftState'

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
})
