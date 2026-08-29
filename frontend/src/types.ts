export type DiffTone = 'very-good' | 'good' | 'neutral' | 'bad' | 'very-bad'
export type PositionTone = 'qb' | 'rb' | 'wr' | 'te' | 'other'
export type PositionFilter = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'FX'

export type RankingRow = {
  player: string
  team: string
  position: string
  headshotUrl?: string
  positionRank?: string
  sourceRank?: number
  adjustedRank?: number
  adjustedRankHalfPpr?: number
  diff?: number
  rankingDiff?: number
  sourceValue?: number
  adjustedValue?: number
  priceRank?: number
  yahooProjection?: number
  regressionDiff?: number
  notes?: string
  diffTone?: DiffTone
  positionTone?: PositionTone
}

export type DraftRankingRow = {
  manager: string
  rank: number
  player: string
  nfl_team: string
  position: string
  offer_amount: number
  espn_suggested_value: number
  value_diff: number
}

export type HistoricalDraftRow = DraftRankingRow & {
  overall_rank: number
  position_rank: number
  tier: number
  tier_label: string
}

export type HistoricalSlotSummary = {
  rank: number
  position: string
  sample_size: number
  average_paid: number | null
  average_expected: number | null
  average_over_under: number | null
  highest_paid: number | null
  lowest_paid: number | null
}

export type HistoricalTierSummary = HistoricalSlotSummary & {
  start_rank: number
  end_rank: number
}

export type YahooProjection = {
  player?: string
  team?: string
  week1Ppr?: number
  week1HalfPpr?: number
  seasonPpr?: number
  seasonHalfPpr?: number
  weeklyAvgPpr?: number
  weeklyAvgHalfPpr?: number
}

export type YahooProjectionColumn = 'season' | 'week1'

export type YahooProjectionMap = Record<string, YahooProjection>

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
  sourceUpdated?: string | null
  sourceUpdatedAt?: string | null
  observedAt?: string | null
  adjustedProfiles?: AdjustedProfile[]
  scoring?: 'full-ppr' | 'half-ppr' | string
  scoringOptions?: string[]
  scoringNote?: string
}

export type AdjustedProfile = {
  id: 'full-ppr' | 'half-ppr' | string
  label: string
  shortLabel?: string
  sourceUpdated?: string | null
  sourceUpdatedAt?: string | null
  observedAt?: string | null
  sourceUrl?: string
}

export type SeasonManifest = {
  season: number
  sources: SourceManifest[]
  yahooProjections?: string
}

export type DataManifest = {
  generatedAt: string
  seasons: SeasonManifest[]
}

export type SortKey = 'sourceRank' | 'adjustedRank' | 'diff' | 'rankingDiff' | 'regressionDiff' | 'player' | 'position' | 'sourceValue' | 'adjustedValue' | 'priceRank' | 'yahooProjection'
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
