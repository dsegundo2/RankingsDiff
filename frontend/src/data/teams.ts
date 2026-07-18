import type { TeamAsset } from '../types'

export const TEAM_ALIASES: Record<string, string> = {
  ARI: 'ARI', ATL: 'ATL', BAL: 'BAL', BUF: 'BUF', CAR: 'CAR', CHI: 'CHI', CIN: 'CIN', CLE: 'CLE', DAL: 'DAL', DEN: 'DEN', DET: 'DET', GB: 'GB', HOU: 'HOU', IND: 'IND', JAC: 'JAX', JAX: 'JAX', KC: 'KC', LV: 'LV', LAC: 'LAC', LA: 'LAR', LAR: 'LAR', MIA: 'MIA', MIN: 'MIN', NE: 'NE', NO: 'NO', NYG: 'NYG', NYJ: 'NYJ', PHI: 'PHI', PIT: 'PIT', SEA: 'SEA', SF: 'SF', TB: 'TB', TEN: 'TEN', WAS: 'WSH', WSH: 'WSH'
}

export function normalizeTeamAbbreviation(team?: string): string {
  const raw = (team ?? '').trim().toUpperCase()
  const parsed = raw.match(/[A-Z]{2,3}/)?.[0] ?? raw
  return TEAM_ALIASES[parsed] ?? parsed
}

export function getTeamAsset(teams: Record<string, TeamAsset>, team?: string): TeamAsset | undefined {
  const normalized = normalizeTeamAbbreviation(team)
  return teams[normalized]
}

export function hasTeamLogo(team?: TeamAsset): boolean {
  return Boolean(team?.logo)
}
