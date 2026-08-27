import { describe, expect, it } from 'vitest'
import { DEFAULT_ROSTER_TARGETS, nextRosterSlot, rosterTargetSlots, rosterTargetTotal } from './rosterTargets'

describe('roster targets', () => {
  it('starts with a 200 budget and seven bench positions', () => {
    expect(rosterTargetTotal(DEFAULT_ROSTER_TARGETS)).toBe(210)
    expect(rosterTargetSlots(DEFAULT_ROSTER_TARGETS).filter((slot) => slot.startsWith('BENCH'))).toHaveLength(7)
  })

  it('supports adding the next position or bench slot', () => {
    expect(nextRosterSlot(DEFAULT_ROSTER_TARGETS, 'BENCH')).toBe('BENCH8')
    expect(nextRosterSlot(DEFAULT_ROSTER_TARGETS, 'WR')).toBe('WR3')
    expect(nextRosterSlot(DEFAULT_ROSTER_TARGETS, 'FLEX')).toBe('FLEX3')
  })
})
