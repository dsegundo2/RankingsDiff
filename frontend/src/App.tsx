import { useEffect, useMemo, useState } from 'react'
import type { DataManifest, RankingRow, SourceCheckPayload, TeamAsset } from './types'
import { RankingsDashboard } from './components/RankingsDashboard'
import { withBasePath } from './data/paths'

const emptyManifest: DataManifest = { generatedAt: '', seasons: [] }

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(withBasePath(path))
  if (!response.ok) throw new Error(`Unable to load ${path}`)
  return response.json() as Promise<T>
}

export default function App() {
  const [manifest, setManifest] = useState<DataManifest>(emptyManifest)
  const [teams, setTeams] = useState<Record<string, TeamAsset>>({})
  const [rows, setRows] = useState<RankingRow[]>([])
  const [sourceChecks, setSourceChecks] = useState<SourceCheckPayload | undefined>()
  const [selectedSeason, setSelectedSeason] = useState<number>(0)
  const [selectedSource, setSelectedSource] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    Promise.all([
      fetchJson<DataManifest>('/data/manifest.json'),
      fetchJson<Record<string, TeamAsset>>('/data/assets/espn_nfl_teams.json').catch(() => ({})),
      fetchJson<SourceCheckPayload>('/data/status/source_checks.json').catch(() => undefined)
    ]).then(([loadedManifest, loadedTeams, loadedChecks]) => {
      setManifest(loadedManifest)
      setTeams(loadedTeams)
      setSourceChecks(loadedChecks)
      const firstSeason = loadedManifest.seasons[0]
      setSelectedSeason(firstSeason?.season ?? 0)
      setSelectedSource(firstSeason?.sources[0]?.id ?? '')
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load data'))
  }, [])

  const selectedMeta = useMemo(() => {
    const season = manifest.seasons.find((item) => item.season === selectedSeason) ?? manifest.seasons[0]
    return season?.sources.find((item) => item.id === selectedSource) ?? season?.sources[0]
  }, [manifest, selectedSeason, selectedSource])

  useEffect(() => {
    if (!selectedMeta) return
    fetchJson<RankingRow[]>(selectedMeta.json).then(setRows).catch((reason) => setError(reason instanceof Error ? reason.message : 'Failed to load rankings'))
  }, [selectedMeta])

  function handleSeason(season: number) {
    setSelectedSeason(season)
    const nextSeason = manifest.seasons.find((item) => item.season === season)
    setSelectedSource(nextSeason?.sources[0]?.id ?? '')
  }

  if (error) return <main className="dashboard"><div className="empty-state error">{error}</div></main>
  if (!manifest.seasons.length || !selectedSource) return <main className="dashboard"><div className="empty-state">Loading rankings…</div></main>

  return <RankingsDashboard manifest={manifest} rows={rows} teams={teams} sourceChecks={sourceChecks} selectedSeason={selectedSeason} selectedSource={selectedSource} onSeason={handleSeason} onSource={setSelectedSource} />
}
