import type { RankingRow } from '../types'

export const DEFAULT_DRAFT_SIZE = 12
export const DEFAULT_DRAFT_SLOT = 2
export const MIN_DRAFT_SIZE = 2
export const MAX_DRAFT_SIZE = 20
export type DraftState = { targets: string[]; drafted: string[]; picks: Record<string, number>; draftSlot: number; draftSize: number }
export type AuctionDraftState = { mine: string[]; prices: Record<string, number>; slots: Record<string, string> }
export type DraftSnapshotState = DraftState & AuctionDraftState & { targetGoals: Record<string, number> }
export type SharedDraft = DraftState & { season: number; source: string }
export type DraftFile = {
  version: 1 | 2
  exportedAt: string
  season: number
  source: string
  players: DraftState
  roster: AuctionDraftState
  targetGoals: Record<string, number>
}

export function rankingId(row: RankingRow): string {
  return `${row.player.trim().toLowerCase()}|${row.team.trim().toLowerCase()}`
}

function validDraftSize(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= MIN_DRAFT_SIZE && value <= MAX_DRAFT_SIZE
}

function validDraftSlot(value: unknown, draftSize: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= draftSize
}

function draftSettings(value: Partial<DraftState>): Pick<DraftState, 'draftSlot' | 'draftSize'> {
  const draftSize = validDraftSize(value.draftSize) ? value.draftSize : DEFAULT_DRAFT_SIZE
  return { draftSize, draftSlot: validDraftSlot(value.draftSlot, draftSize) ? value.draftSlot : Math.min(DEFAULT_DRAFT_SLOT, draftSize) }
}

export function readDraftState(key: string): DraftState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) ?? '{}') as Partial<DraftState>
    return {
      targets: Array.isArray(parsed.targets) ? parsed.targets.filter((value): value is string => typeof value === 'string') : [],
      drafted: Array.isArray(parsed.drafted) ? parsed.drafted.filter((value): value is string => typeof value === 'string') : [],
      picks: Object.fromEntries(Object.entries(parsed.picks ?? {}).filter(([, value]) => typeof value === 'number' && Number.isInteger(value) && value > 0)) as Record<string, number>,
      ...draftSettings(parsed)
    }
  } catch {
    return { targets: [], drafted: [], picks: {}, ...draftSettings({}) }
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

export function createDraftFile(season: number, source: string, state: DraftSnapshotState): DraftFile {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    season,
    source,
    players: { targets: stringList(state.targets), drafted: stringList(state.drafted), picks: state.picks, ...draftSettings(state) },
    roster: {
      mine: stringList(state.mine),
      prices: Object.fromEntries(Object.entries(state.prices).filter(([id, value]) => stringList([id]).length > 0 && typeof value === 'number' && Number.isFinite(value) && value >= 0)),
      slots: Object.fromEntries(Object.entries(state.slots).filter(([id, value]) => stringList([id]).length > 0 && typeof value === 'string' && value.length > 0))
    },
    targetGoals: Object.fromEntries(Object.entries(state.targetGoals).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0))
  }
}

export function parseDraftFile(contents: string): DraftFile {
  const parsed = JSON.parse(contents) as Partial<DraftFile>
  if ((parsed.version !== 1 && parsed.version !== 2) || !parsed.players || typeof parsed.season !== 'number' || typeof parsed.source !== 'string') {
    throw new Error('This is not a valid Draft Distillery draft file.')
  }
  const roster: Partial<AuctionDraftState> = parsed.version === 2 && parsed.roster ? parsed.roster : {}
  const prices = Object.fromEntries(Object.entries((roster.prices ?? {}) as Record<string, unknown>).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) as Record<string, number>
  const slots = Object.fromEntries(Object.entries((roster.slots ?? {}) as Record<string, unknown>).filter(([, value]) => typeof value === 'string' && value.length > 0)) as Record<string, string>
  const targetGoals = Object.fromEntries(Object.entries((parsed.targetGoals ?? {}) as Record<string, unknown>).filter(([, value]) => typeof value === 'number' && Number.isFinite(value) && value >= 0)) as Record<string, number>
  return {
    version: 2,
    exportedAt: typeof parsed.exportedAt === 'string' ? parsed.exportedAt : '',
    season: parsed.season,
    source: parsed.source,
    players: {
      targets: stringList(parsed.players.targets),
      drafted: stringList(parsed.players.drafted),
      picks: Object.fromEntries(Object.entries(parsed.players.picks ?? {}).filter(([id, value]) => stringList([id]).length > 0 && typeof value === 'number' && Number.isInteger(value) && value > 0)) as Record<string, number>,
      ...draftSettings(parsed.players)
    },
    roster: {
      mine: stringList(roster.mine),
      prices,
      slots: Object.fromEntries(Object.entries(slots).filter(([id]) => stringList([id]).length > 0))
    },
    targetGoals
  }
}

/** Encode a draft into a portable URL so a user can move the board between Safari devices. */
export function createDraftShareUrl(season: number, source: string, state: DraftState): string {
  const payload: SharedDraft = { season, source, targets: stringList(state.targets), drafted: stringList(state.drafted), picks: state.picks, ...draftSettings(state) }
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
    const settings = draftSettings(parsed)
    return { season: parsed.season, source: parsed.source, targets: stringList(parsed.targets), drafted: stringList(parsed.drafted), picks: parsed.picks ?? {}, ...settings }
  } catch {
    return undefined
  }
}
