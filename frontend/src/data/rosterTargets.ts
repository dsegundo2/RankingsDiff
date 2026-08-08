export const ROSTER_TARGET_SLOTS = ['QB1', 'RB1', 'RB2', 'WR1', 'WR2', 'TE1', 'FLEX', 'BENCH1', 'BENCH2', 'BENCH3', 'BENCH4', 'BENCH5'] as const

export type RosterTargetGoals = Record<string, number>

export const DEFAULT_ROSTER_TARGETS: RosterTargetGoals = {
  QB1: 15, RB1: 50, RB2: 20, WR1: 35, WR2: 20, TE1: 15, FLEX: 10,
  BENCH1: 5, BENCH2: 4, BENCH3: 4, BENCH4: 3, BENCH5: 2,
}

export function rosterTargetLabel(slot: string): string {
  return slot.startsWith('BENCH') ? `BN${slot.slice(5)}` : slot
}
