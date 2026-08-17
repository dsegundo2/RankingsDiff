export const STARTER_ROSTER_SLOTS = ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', 'FLEX'] as const

export type RosterTargetGoals = Record<string, number>

export const DEFAULT_ROSTER_TARGETS: RosterTargetGoals = {
  QB1: 15, RB1: 50, RB2: 20, WR1: 35, WR2: 20, TE1: 15, FLEX: 10,
  BENCH1: 5, BENCH2: 5, BENCH3: 5, BENCH4: 5, BENCH5: 5, BENCH6: 5, BENCH7: 5,
}

export function rosterTargetLabel(slot: string): string {
  return slot.startsWith('BENCH') ? `BN${slot.slice(5)}` : slot
}

function slotNumber(slot: string): number {
  return Number(slot.match(/\d+$/)?.[0] ?? 0)
}

export function rosterTargetSlots(targetGoals: RosterTargetGoals = DEFAULT_ROSTER_TARGETS): string[] {
  const extras = Object.keys(targetGoals).filter((slot) => !STARTER_ROSTER_SLOTS.includes(slot as typeof STARTER_ROSTER_SLOTS[number]))
  const positionExtras = extras.filter((slot) => !slot.startsWith('BENCH')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
  const bench = extras.filter((slot) => slot.startsWith('BENCH')).sort((a, b) => slotNumber(a) - slotNumber(b))
  return [...STARTER_ROSTER_SLOTS, ...positionExtras, ...bench]
}

export function rosterTargetTotal(targetGoals: RosterTargetGoals): number {
  return rosterTargetSlots(targetGoals).reduce((total, slot) => total + (targetGoals[slot] ?? 0), 0)
}

export function nextRosterSlot(targetGoals: RosterTargetGoals, prefix: 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'BENCH'): string {
  if (prefix === 'FLEX') {
    let number = targetGoals.FLEX === undefined ? 0 : 2
    while (targetGoals[number === 0 ? 'FLEX' : `FLEX${number}`] !== undefined) number += 1
    return number === 0 ? 'FLEX' : `FLEX${number}`
  }
  let number = 1
  while (targetGoals[`${prefix}${number}`] !== undefined) number += 1
  return `${prefix}${number}`
}
