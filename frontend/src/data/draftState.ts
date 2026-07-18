import type { RankingRow } from '../types'

export type DraftState = { targets: string[]; drafted: string[] }

export function rankingId(row: RankingRow): string {
  return `${row.player.trim().toLowerCase()}|${row.team.trim().toLowerCase()}`
}

export function readDraftState(key: string): DraftState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<DraftState>
    return {
      targets: Array.isArray(parsed.targets) ? parsed.targets.filter((value): value is string => typeof value === 'string') : [],
      drafted: Array.isArray(parsed.drafted) ? parsed.drafted.filter((value): value is string => typeof value === 'string') : []
    }
  } catch {
    return { targets: [], drafted: [] }
  }
}

export function writeDraftState(key: string, state: DraftState): void {
  localStorage.setItem(key, JSON.stringify(state))
}
