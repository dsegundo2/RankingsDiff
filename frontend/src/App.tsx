import { useEffect, useMemo, useState } from 'react'
import type { DataManifest, RankingRow, SourceCheckPayload, TeamAsset } from './types'
import { RankingsDashboard } from './components/RankingsDashboard'
import { withBasePath } from './data/paths'
import { readDraftShare } from './data/draftState'

const emptyManifest: DataManifest = { generatedAt: '', seasons: [] }

async function fetchJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(withBasePath(path), { signal })
  if (!response.ok) throw new Error(`Unable to load ${path}`)
  return response.json() as Promise<T>
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

export default function App() {
  const [manifest, setManifest] = useState<DataManifest>(emptyManifest)
  const [teams, setTeams] = useState<Record<string, TeamAsset>>({})
  const [rows, setRows] = useState<RankingRow[]>([])
  const [sourceChecks, setSourceChecks] = useState<SourceCheckPayload | undefined>()
  const [selectedSeason, setSelectedSeason] = useState<number>(0)
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [error, setError] = useState<string>('')
  const [manifestLoading, setManifestLoading] = useState(true)
  const [, setRowsLoading] = useState(true)
  const [hasLoadedRows, setHasLoadedRows] = useState(false)
  const [retryKey, setRetryKey] = useState(0)

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
      let saved: { season?: number; source?: string } = {}
      try { saved = JSON.parse(localStorage.getItem('rankingsdiff:sheet:v1') ?? '{}') as typeof saved } catch { /* Ignore stale preferences. */ }
      const savedSeason = loadedManifest.seasons.find((item) => item.season === sharedDraft?.season) ?? loadedManifest.seasons.find((item) => item.season === saved.season) ?? firstSeason
      const savedSource = savedSeason?.sources.find((item) => item.id === (sharedDraft?.source ?? saved.source)) ?? savedSeason?.sources[0]
      setSelectedSeason(savedSeason?.season ?? 0)
      setSelectedSource(savedSource?.id ?? '')
    }).catch((reason) => {
      if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'Failed to load data')
    }).finally(() => {
      window.clearTimeout(timeout)
      setManifestLoading(false)
    })
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [retryKey])

  useEffect(() => {
    if (selectedSeason && selectedSource) localStorage.setItem('rankingsdiff:sheet:v1', JSON.stringify({ season: selectedSeason, source: selectedSource }))
  }, [selectedSeason, selectedSource])

  const selectedMeta = useMemo(() => {
    const season = manifest.seasons.find((item) => item.season === selectedSeason) ?? manifest.seasons[0]
    return season?.sources.find((item) => item.id === selectedSource) ?? season?.sources[0]
  }, [manifest, selectedSeason, selectedSource])

  useEffect(() => {
    if (!selectedMeta) return
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12000)
    setRowsLoading(true)
    fetchJson<RankingRow[]>(selectedMeta.json, controller.signal).then((loadedRows) => {
      setRows(loadedRows)
      setRowsLoading(false)
      setHasLoadedRows(true)
    }).catch((reason) => {
      if (reason?.name !== 'AbortError') setError(reason instanceof Error ? reason.message : 'Failed to load rankings')
      setRowsLoading(false)
    }).finally(() => window.clearTimeout(timeout))
    return () => { window.clearTimeout(timeout); controller.abort() }
  }, [selectedMeta, retryKey])

  function handleSeason(season: number) {
    setSelectedSeason(season)
    const nextSeason = manifest.seasons.find((item) => item.season === season)
    setSelectedSource(nextSeason?.sources[0]?.id ?? '')
  }

  if (error) return <ErrorState message={error} onRetry={() => { setRows([]); setRowsLoading(true); setHasLoadedRows(false); setRetryKey((current) => current + 1) }} />
  if (manifestLoading || !manifest.seasons.length || !selectedSource || !hasLoadedRows) return <LoadingState detail={manifestLoading ? undefined : `Loading ${selectedMeta?.label ?? 'the selected source'} rankings…`} />

  return <RankingsDashboard manifest={manifest} rows={rows} teams={teams} sourceChecks={sourceChecks} selectedSeason={selectedSeason} selectedSource={selectedSource} onSeason={handleSeason} onSource={setSelectedSource} />
}
