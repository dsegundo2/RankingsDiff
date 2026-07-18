import { useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DataManifest, PositionFilter, RankingRow, SourceCheckPayload, SortDirection, SortKey, TeamAsset } from '../types'
import { filterRankings, sortRankings } from '../data/rankings'
import { rankingId, readDraftState, writeDraftState } from '../data/draftState'
import { DownloadPanel } from './DownloadPanel'
import { DraftStateControls } from './DraftStateControls'
import { Filters } from './Filters'
import { RankingCard } from './RankingCard'
import { RankingsTable } from './RankingsTable'
import { SettingsPopover } from './SettingsPopover'
import { PositionBoard } from './PositionBoard'

type ViewMode = 'board' | 'positions'
type PositionKey = Exclude<PositionFilter, 'ALL'>
type Props = {
  manifest: DataManifest
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  sourceChecks?: SourceCheckPayload
  selectedSeason: number
  selectedSource: string
  onSeason: (season: number) => void
  onSource: (source: string) => void
}

export function RankingsDashboard({ manifest, rows, teams, sourceChecks, selectedSeason, selectedSource, onSeason, onSource }: Props) {
  const [search, setSearch] = useState('')
  const [position, setPosition] = useState<PositionFilter>('ALL')
  const [sortKey, setSortKey] = useState<SortKey>('sourceRank')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [view, setView] = useState<ViewMode>('board')
  const [positionViews, setPositionViews] = useState<Set<PositionKey>>(new Set(['RB', 'WR', 'QB', 'TE']))
  const [targets, setTargets] = useState<Set<string>>(new Set())
  const [drafted, setDrafted] = useState<Set<string>>(new Set())
  const [showDrafted, setShowDrafted] = useState(true)
  const [hydratedStorageKey, setHydratedStorageKey] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const season = manifest.seasons.find((item) => item.season === selectedSeason) ?? manifest.seasons[0]
  const source = season?.sources.find((item) => item.id === selectedSource) ?? season?.sources[0]
  const storageKey = `rankingsdiff:draft:v1:${selectedSeason}:${selectedSource}`
  const filteredRows = useMemo(() => filterRankings(rows, search, view === 'positions' ? 'ALL' : position), [rows, search, position, view])
  const visibleRows = useMemo(() => sortRankings(filteredRows, sortKey, sortDirection).filter((row) => showDrafted || !drafted.has(rankingId(row))), [filteredRows, sortKey, sortDirection, showDrafted, drafted])
  const targetRows = useMemo(() => rows.filter((row) => targets.has(rankingId(row)) && !drafted.has(rankingId(row))), [rows, targets, drafted])

  useEffect(() => {
    setHydratedStorageKey('')
    const state = readDraftState(storageKey)
    setTargets(new Set(state.targets))
    setDrafted(new Set(state.drafted))
    setHydratedStorageKey(storageKey)
  }, [storageKey])

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return
    writeDraftState(storageKey, { targets: [...targets], drafted: [...drafted] })
  }, [storageKey, hydratedStorageKey, targets, drafted])

  useEffect(() => {
    function handleKeydown(event: KeyboardEvent) {
      const target = event.target instanceof HTMLElement ? event.target : null
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const input = searchInputRef.current ?? document.querySelector<HTMLInputElement>('[data-player-search]')
        input?.focus()
        input?.select()
        return
      }
      if (event.key === 'Escape') {
        setSettingsOpen(false)
        if (isTyping) {
          target?.blur()
          return
        }
      }
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return
      const shortcut = event.key.toLowerCase()
      const positionShortcuts: Record<string, PositionFilter> = { a: 'ALL', q: 'QB', r: 'RB', w: 'WR', t: 'TE' }
      const nextPosition = positionShortcuts[shortcut]
      if (nextPosition) {
        event.preventDefault()
        setPosition(nextPosition)
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [])

  function handleSort(key: SortKey) {
    if (key === sortKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDirection('asc') }
  }

  function handleSeasonFromSettings(nextSeason: number) {
    onSeason(nextSeason)
  }

  function handleSourceFromSettings(nextSource: string) {
    onSource(nextSource)
  }

  function toggleSet(setter: Dispatch<SetStateAction<Set<string>>>, id: string) {
    setter((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleDrafted(id: string) {
    toggleSet(setDrafted, id)
    setTargets((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }

  function togglePositionView(value: PositionKey) {
    setPositionViews((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function restoreDraft(nextTargets: string[], nextDrafted: string[]) {
    setTargets(new Set(nextTargets))
    setDrafted(new Set(nextDrafted))
  }

  function clearDraft() {
    setTargets(new Set())
    setDrafted(new Set())
  }

  return (
    <main className="dashboard">
      <section className="hero hero--compact">
        <div>
          <span className="eyebrow">Fantasy football</span>
          <h1>RankingsDiff</h1>
          <div className="view-summary" aria-live="polite">
            Looking at <strong>{selectedSeason}</strong> · <strong>{source?.label ?? selectedSource}</strong>
          </div>
        </div>
        <div className="hero-actions">
          <button className="sheet-switcher" type="button" onClick={() => setSettingsOpen(true)} aria-haspopup="dialog">
            <span>Switch sheet</span>
            <strong>{selectedSeason} · {source?.label ?? selectedSource}</strong>
          </button>
          <DownloadPanel source={source} generatedAt={manifest.generatedAt} count={visibleRows.length} />
        </div>
      </section>

      <div className="control-grid control-grid--single">
        <Filters
          search={search}
          position={position}
          searchInputRef={searchInputRef}
          onSearch={setSearch}
          onPosition={setPosition}
          showPositions={view === 'board'}
          selectedPositions={positionViews}
          onTogglePosition={togglePositionView}
        />
      </div>

      <section className="draft-toolbar" aria-label="Draft board controls">
        <div className="view-tabs" aria-label="Ranking view">
          <button type="button" className={view === 'board' ? 'active' : ''} aria-pressed={view === 'board'} onClick={() => setView('board')}>Draft board</button>
          <button type="button" className={view === 'positions' ? 'active' : ''} aria-pressed={view === 'positions'} onClick={() => setView('positions')}>By position</button>
        </div>
        <div className="draft-toolbar__actions">
          <label className="drafted-toggle"><input type="checkbox" checked={showDrafted} onChange={(event) => setShowDrafted(event.target.checked)} /> Show drafted</label>
          <DraftStateControls season={selectedSeason} source={selectedSource} targets={targets} drafted={drafted} onRestore={restoreDraft} onClear={clearDraft} />
        </div>
      </section>

      {view === 'board' ? (
        <div className="draft-board-layout">
          <div>
            <RankingsTable rows={visibleRows} teams={teams} source={selectedSource} sortKey={sortKey} sortDirection={sortDirection} targets={targets} drafted={drafted} onSort={handleSort} onTarget={(id) => toggleSet(setTargets, id)} onDrafted={toggleDrafted} />
            <section className="cards-list" aria-label="Mobile rankings cards">
              {visibleRows.map((row) => <RankingCard key={`${row.player}-${row.team}-${row.sourceRank}-card`} row={row} teams={teams} source={selectedSource} targeted={targets.has(rankingId(row))} drafted={drafted.has(rankingId(row))} onTarget={() => toggleSet(setTargets, rankingId(row))} onDrafted={() => toggleDrafted(rankingId(row))} />)}
            </section>
          </div>
          <aside className="target-queue" aria-label="Target queue">
            <div className="target-queue__heading"><span className="eyebrow">Target queue</span><strong>{targetRows.length}</strong></div>
            {targetRows.slice(0, 8).map((row) => <button type="button" key={rankingId(row)} onClick={() => toggleSet(setTargets, rankingId(row))}><span><strong>{row.player}</strong><small>{row.team} · {row.positionRank ?? row.position}</small></span><span aria-hidden="true">×</span></button>)}
            {!targetRows.length ? <p>Star players to keep them close while you filter.</p> : null}
          </aside>
        </div>
      ) : <PositionBoard rows={sortRankings(filteredRows, 'sourceRank', 'asc')} positions={positionViews} teams={teams} targets={targets} drafted={drafted} isEspn={selectedSource === 'espn'} showDrafted={showDrafted} onTarget={(id) => toggleSet(setTargets, id)} onDrafted={toggleDrafted} />}
      <SettingsPopover
        open={settingsOpen}
        manifest={manifest}
        selectedSeason={selectedSeason}
        selectedSource={source?.id ?? selectedSource}
        currentSource={source}
        sourceChecks={sourceChecks}
        onSeason={handleSeasonFromSettings}
        onSource={handleSourceFromSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  )
}
