import type { RankingRow } from '../types'

export type DraftState = { targets: string[]; drafted: string[] }
export type AuctionDraftState = { mine: string[]; prices: Record<string, number>; slots: Record<string, string> }
export type SharedDraft = DraftState & { season: number; source: string }
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

export function readAuctionDraftState(key: string): AuctionDraftState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<AuctionDraftState>
    const prices = Object.fromEntries(Object.entries(parsed.prices ?? {}).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0))
    const slots = Object.fromEntries(Object.entries(parsed.slots ?? {}).filter(([, value]) => typeof value === 'string' && value.length > 0))
    const mine = Array.isArray(parsed.mine) ? parsed.mine.filter((value): value is string => typeof value === 'string') : Object.keys(prices)
    return { mine, prices, slots }
  } catch {
    return { mine: [], prices: {}, slots: {} }
  }
}

export function writeAuctionDraftState(key: string, state: AuctionDraftState): void {
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

/** Encode a draft into a portable URL so a user can move the board between Safari devices. */
export function createDraftShareUrl(season: number, source: string, state: DraftState): string {
  const payload: SharedDraft = { season, source, targets: stringList(state.targets), drafted: stringList(state.drafted) }
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(payload))))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  const url = new URL(window.location.href)
  url.searchParams.set('draft', encoded)
  return url.toString()
}

export function readDraftShare(value: string | null): SharedDraft | undefined {
  if (!value) return undefined
  try {
    const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')
    const parsed = JSON.parse(decodeURIComponent(escape(atob(padded)))) as Partial<SharedDraft>
    if (typeof parsed.season !== 'number' || typeof parsed.source !== 'string') return undefined
    return { season: parsed.season, source: parsed.source, targets: stringList(parsed.targets), drafted: stringList(parsed.drafted) }
  } catch {
    return undefined
  }
}
