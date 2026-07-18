import type { RankingRow } from '../types'

export type DraftState = { targets: string[]; drafted: string[] }
export type DraftFile = {
  version: 1
  exportedAt: string
  season: number
  source: string
  players: DraftState
}

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

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.includes('|')))]
}

export function createDraftFile(season: number, source: string, state: DraftState): DraftFile {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    season,
    source,
    players: { targets: stringList(state.targets), drafted: stringList(state.drafted) }
  }
}

export function parseDraftFile(contents: string): DraftFile {
  const parsed = JSON.parse(contents) as Partial<DraftFile>
  if (parsed.version !== 1 || !parsed.players || typeof parsed.season !== 'number' || typeof parsed.source !== 'string') {
    throw new Error('This is not a valid RankingsDiff draft file.')
  }
  return {
    version: 1,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
    season: parsed.season,
    source: parsed.source,
    players: {
      targets: stringList(parsed.players.targets),
      drafted: stringList(parsed.players.drafted)
    }
  }
}
