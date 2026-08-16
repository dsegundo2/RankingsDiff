import { useEffect, useMemo, useState } from 'react'
import type { AdjustedProfile, DataManifest, RankingRow, SourceCheckPayload, TeamAsset, YahooProjection, YahooProjectionMap } from './types'
import { RankingsDashboard } from './components/RankingsDashboard'
import { withBasePath } from './data/paths'
import { readDraftShare } from './data/draftState'
import { applyAdjustedProfile } from './data/rankings'
import { ThemeMockups } from './components/ThemeMockups'
import { ColumnMockups } from './components/ColumnMockups'
import { DraftCutoffMockups } from './components/DraftCutoffMockups'
import { DraftDividerMockups } from './components/DraftDividerMockups'
import { DraftedRowMockups } from './components/DraftedRowMockups'
import { HeroRecentMockups } from './components/HeroRecentMockups'
import { RankingLayoutMockups } from './components/RankingLayoutMockups'

const emptyManifest: DataManifest = { generatedAt: '', seasons: [] }

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(withBasePath(path), { signal })
  if (!response.ok) throw new Error(`Unable to load ${path}`)
  return response.json() as Promise<T>
}

function normalizeYahooProjections(payload: unknown): YahooProjectionMap {
  const items = Array.isArray(payload)
    ? payload
    : payload && typeof payload === 'object' && Array.isArray((payload as { players?: unknown }).players)
      ? (payload as { players: unknown[] }).players
      : payload && typeof payload === 'object'
        ? Object.entries(payload as Record<string, unknown>).map(([id, value]) => ({ id, ...(value as object) }))
        : []
  return items.reduce<YahooProjectionMap>((result, item) => {
    if (!item || typeof item !== 'object') return result
    const value = item as YahooProjection & { id?: string; name?: string; fullName?: string; position?: string; teamAbbr?: string }
    const keyParts = value.id?.split('|')
    const player = value.player ?? value.name ?? value.fullName ?? keyParts?.[0]
    const team = value.team ?? value.teamAbbr ?? keyParts?.[1]
    if (!player || !team) return result
    const id = `${player.trim().toLowerCase()}|${team.trim().toLowerCase().split(/\s|\(/)[0]}`
    result[id] = {
      player,
      team,
      week1Ppr: value.week1Ppr ?? (value as { week1?: number }).week1,
      week1HalfPpr: value.week1HalfPpr,
      seasonPpr: value.seasonPpr,
      seasonHalfPpr: value.seasonHalfPpr,
      weeklyAvgPpr: value.weeklyAvgPpr,
      weeklyAvgHalfPpr: value.weeklyAvgHalfPpr
    }
    return result
  }, {})
}

function LoadingState({ detail = 'Preparing your rankings board…' }: { detail?: string }) {
  return <main className="dashboard loading-shell" aria-live="polite" aria-busy="true">
    <div className="loading-mark" aria-hidden="true"><span>R</span><span>D</span></div>
    <span className="eyebrow">Fantasy football</span>
    <h1>RankingsDiff</h1>
    <div className="loading-progress"><span /></div>
    <p className="loading-title">Loading rankings…</p>
    <p className="loading-detail">{detail}</p>
    <p className="loading-hint">This usually takes a moment while the latest rankings and team art load.</p>
  </main>
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return <main className="dashboard loading-shell error-shell" role="alert">
    <div className="loading-mark loading-mark--error" aria-hidden="true">!</div>
    <span className="eyebrow">RankingsDiff</span>
    <h1>We couldn’t load the board</h1>
    <p className="loading-detail">{message}</p>
    <button className="primary-action" type="button" onClick={onRetry}>Try again</button>
  </main>
}

function AppData() {
  const [route, setRoute] = useState<'board' | 'analytics'>(() => window.location.pathname.endsWith('/analytics/rankings-diff') ? 'analytics' : 'board')
  const [manifest, setManifest] = useState<DataManifest>(emptyManifest)
  const [teams, setTeams] = useState<Record<string, TeamAsset>>({})
  const [rows, setRows] = useState<RankingRow[]>([])
  const [yahooProjections, setYahooProjections] = useState<YahooProjectionMap>({})
  const [sourceChecks, setSourceChecks] = useState<SourceCheckPayload | undefined>()
  const [selectedSeason, setSelectedSeason] = useState<number>(0)
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [selectedAdjustedProfile, setSelectedAdjustedProfile] = useState('full-ppr')
  const [error, setError] = useState<string>('')
  const [manifestLoading, setManifestLoading] = useState(true)
  const [, setRowsLoading] = useState(true)
  const [hasLoadedRows, setHasLoadedRows] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    const handlePopState = () => setRoute(window.location.pathname.endsWith('/analytics/rankings-diff') ? 'analytics' : 'board')
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  function navigate(nextRoute: 'board' | 'analytics') {
    const path = nextRoute === 'analytics' ? `${import.meta.env.BASE_URL}analytics/rankings-diff` : (import.meta.env.BASE_URL || '/')
    window.history.pushState({}, '', path)
    setRoute(nextRoute)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  useEffect(() => {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    setManifestLoading(true)
    setError('')
    Promise.all([
      fetchJson<DataManifest>('/data/manifest.json', controller.signal),
      fetchJson<Record<string, TeamAsset>>('/data/assets/espn_nfl_teams.json', controller.signal).catch(() => ({})),
      fetchJson<SourceCheckPayload>('/data/status/source_checks.json', controller.signal).catch(() => undefined)
    ]).then(([loadedManifest, loadedTeams, loadedChecks]) => {
      setManifest(loadedManifest)
      setTeams(loadedTeams)
      setSourceChecks(loadedChecks)
      const firstSeason = loadedManifest.seasons[0]
      const sharedDraft = readDraftShare(new URLSearchParams(window.location.search).get('draft'))
      let saved: { season?: number; source?: string; adjustedProfile?: string } = {}
      try { saved = JSON.parse(localStorage.getItem('rankingsdiff:sheet:v1') ?? '{}') as typeof saved } catch { /* Ignore stale preferences. */ }
      const savedSeason = loadedManifest.seasons.find((item) => item.season === sharedDraft?.season) ?? loadedManifest.seasons.find((item) => item.season === saved.season) ?? firstSeason
      const savedSource = savedSeason?.sources.find((item) => item.id === (sharedDraft?.source ?? saved.source)) ?? savedSeason?.sources[0]
      setSelectedSeason(savedSeason?.season ?? 0)
      setSelectedSource(savedSource?.id ?? '')
      setSelectedAdjustedProfile(saved.adjustedProfile ?? 'full-ppr')
    }).catch((reason) => {
      if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'Failed to load data')
    }).finally(() => {
      window.clearTimeout(timeout)
      setManifestLoading(false)
    })
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [retryKey])

  useEffect(() => {
    if (selectedSeason && selectedSource) localStorage.setItem('rankingsdiff:sheet:v1', JSON.stringify({ season: selectedSeason, source: selectedSource, adjustedProfile: selectedAdjustedProfile }))
  }, [selectedAdjustedProfile, selectedSeason, selectedSource])

  const selectedMeta = useMemo(() => {
    const season = manifest.seasons.find((item) => item.season === selectedSeason) ?? manifest.seasons[0]
    return season?.sources.find((item) => item.id === selectedSource) ?? season?.sources[0]
  }, [manifest, selectedSeason, selectedSource])
  const adjustedProfiles = selectedMeta?.adjustedProfiles ?? []
  const selectedProfile: AdjustedProfile | undefined = adjustedProfiles.find((profile) => profile.id === selectedAdjustedProfile) ?? adjustedProfiles[0]

  useEffect(() => {
    if (!selectedMeta) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    // Do not render the previous sheet's calculated values while the new
    // sheet is loading. This is especially noticeable when switching between
    // Yahoo base sheets, which can have different rank universes.
    setRows([])
    setYahooProjections({})
    setRowsLoading(true)
    const seasonMeta = manifest.seasons.find((item) => item.season === selectedSeason)
    const projectionRequest = seasonMeta?.yahooProjections
      ? fetchJson<unknown>(seasonMeta.yahooProjections, controller.signal).then(normalizeYahooProjections).catch(() => ({} as YahooProjectionMap))
      : Promise.resolve({} as YahooProjectionMap)
    Promise.all([fetchJson<RankingRow[]>(selectedMeta.json, controller.signal), projectionRequest]).then(([loadedRows, loadedProjections]) => {
      setRows(loadedRows)
      setYahooProjections(loadedProjections)
      setRowsLoading(false)
      setHasLoadedRows(true)
    }).catch((reason) => {
      if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'Failed to load rankings')
      setHasLoadedRows(false)
      setRowsLoading(false)
    }).finally(() => window.clearTimeout(timeout))
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [manifest, selectedMeta, selectedSeason, retryKey])

  function handleSeason(season: number) {
    setSelectedSeason(season)
    const nextSeason = manifest.seasons.find((item) => item.season === season)
    setSelectedSource(nextSeason?.sources[0]?.id ?? '')
  }

  if (error) return <ErrorState message={error} onRetry={() => { setRows([]); setRowsLoading(true); setHasLoadedRows(false); setRetryKey((current) => current + 1) }} />
  if (manifestLoading || !manifest.seasons.length || !selectedSource || !hasLoadedRows) return <LoadingState detail={manifestLoading ? undefined : `Loading ${selectedMeta?.label ?? 'the selected source'} rankings…`} />

  const displayedRows = applyAdjustedProfile(rows, selectedProfile?.id ?? 'full-ppr', selectedSource)
  return <RankingsDashboard manifest={manifest} rows={displayedRows} teams={teams} yahooProjections={yahooProjections} sourceChecks={sourceChecks} selectedSeason={selectedSeason} selectedSource={selectedSource} adjustedProfiles={adjustedProfiles} selectedAdjustedProfile={selectedProfile?.id ?? 'full-ppr'} onAdjustedProfile={setSelectedAdjustedProfile} onSeason={handleSeason} onSource={setSelectedSource} route={route} onNavigate={navigate} />
}

export default function App() {
  if (window.location.pathname.endsWith('/draft-divider-mockups')) return <DraftDividerMockups />
  if (window.location.pathname.endsWith('/drafted-row-mockups')) return <DraftedRowMockups />
  if (window.location.pathname.endsWith('/hero-recent-mockups')) return <HeroRecentMockups />
  if (window.location.pathname.endsWith('/ranking-layout-mockups')) return <RankingLayoutMockups />
  if (window.location.pathname.endsWith('/draft-cutoff-mockups')) return <DraftCutoffMockups />
  if (window.location.pathname.endsWith('/column-mockups')) return <ColumnMockups />
  if (window.location.pathname.endsWith('/mockups')) return <ThemeMockups />
  return <div className="app-theme app-theme--studio-mint"><AppData /></div>
}
