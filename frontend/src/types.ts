export type DiffTone = 'very-good' | 'good' | 'neutral' | 'bad' | 'very-bad'
export type PositionTone = 'qb' | 'rb' | 'wr' | 'te' | 'other'
export type PositionFilter = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE'

export type RankingRow = {
  player: string
  team: string
  position: string
  positionRank?: string
  sourceRank?: number
  underdogRank?: number
  diff?: number
  sourceValue?: number
  underdogValue?: number
  priceRank?: number
  notes?: string
  diffTone?: DiffTone
  positionTone?: PositionTone
}

export type TeamAsset = {
  id: string
  abbreviation: string
  displayName: string
  shortDisplayName: string
  color?: string
  alternateColor?: string
  logo?: string
  darkLogo?: string
}

export type SourceLink = {
  label: string
  url: string
}

export type SourceManifest = {
  id: string
  label: string
  rowCount: number
  json: string
  csv: string
  xlsx?: string
  sourceLinks?: SourceLink[]
}

export type SeasonManifest = {
  season: number
  sources: SourceManifest[]
}

export type DataManifest = {
  generatedAt: string
  seasons: SeasonManifest[]
}

export type SortKey = 'sourceRank' | 'underdogRank' | 'diff' | 'player' | 'position' | 'sourceValue' | 'underdogValue' | 'priceRank'
export type SortDirection = 'asc' | 'desc'

export type RankingSource = 'fpros' | 'espn' | string


export type SourceCheckStatus = 'changed' | 'unchanged' | 'error'

export type SourceCheckEntry = {
  id: string
  season: number
  source: string
  sourceLabel: string
  kind: string
  file: string
  lastCheckedAt: string
  lastChangedAt: string
  previousChecksum?: string | null
  currentChecksum?: string | null
  status: SourceCheckStatus
  message?: string
}

export type SourceCheckPayload = {
  generatedAt: string
  checks: SourceCheckEntry[]
}
