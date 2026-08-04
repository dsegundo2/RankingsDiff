import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Dispatch, SetStateAction } from 'react'
import type { DataManifest, PositionFilter, RankingRow, SourceCheckPayload, SortDirection, SortKey, TeamAsset } from '../types'
import { filterRankings, formatRank, formatSignedValue, formatValue, sortRankings, sourceLabel } from '../data/rankings'
import { rankingId, readDraftState, writeDraftState } from '../data/draftState'
import { Filters } from './Filters'
import { RankingCard } from './RankingCard'
import { RankingsTable } from './RankingsTable'
import { SettingsPopover } from './SettingsPopover'
import { PositionBoard } from './PositionBoard'
import { RecentDraftPanel } from './RecentDraftPanel'

type ViewMode = 'board' | 'positions'
type PositionKey = Exclude<PositionFilter, 'ALL'>
const allPositionKeys = new Set<PositionKey>(['RB', 'WR', 'QB', 'TE'])
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
  const [selectedId, setSelectedId] = useState<string>('')
  const [boardPositions, setBoardPositions] = useState<Set<PositionKey>>(new Set(allPositionKeys))
  const [positionViews, setPositionViews] = useState<Set<PositionKey>>(new Set(['RB', 'WR', 'QB', 'TE']))
  const [targets, setTargets] = useState<Set<string>>(new Set())
  const [drafted, setDrafted] = useState<Set<string>>(new Set())
  const [showDrafted, setShowDrafted] = useState(true)
  const [showTargetQueue, setShowTargetQueue] = useState(true)
  const [showMobileActions, setShowMobileActions] = useState(true)
  const [hydratedStorageKey, setHydratedStorageKey] = useState('')
  const [hydratedViewKey, setHydratedViewKey] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const season = manifest.seasons.find((item) => item.season === selectedSeason) ?? manifest.seasons[0]
  const source = season?.sources.find((item) => item.id === selectedSource) ?? season?.sources[0]
  const storageKey = `rankingsdiff:draft:v1:${selectedSeason}:${selectedSource}`
  const viewStorageKey = `rankingsdiff:view:v1:${selectedSeason}:${selectedSource}`
  const filteredRows = useMemo(() => {
    const searchedRows = filterRankings(rows, search, 'ALL')
    if (view === 'positions' || boardPositions.size === allPositionKeys.size) return searchedRows
    return searchedRows.filter((row) => boardPositions.has(row.position.toUpperCase() as PositionKey))
  }, [rows, search, view, boardPositions])
  const visibleRows = useMemo(() => sortRankings(filteredRows, sortKey, sortDirection).filter((row) => showDrafted || !drafted.has(rankingId(row))), [filteredRows, sortKey, sortDirection, showDrafted, drafted])
  const targetRows = useMemo(() => sortRankings(rows.filter((row) => targets.has(rankingId(row)) && !drafted.has(rankingId(row))), 'sourceRank', 'asc'), [rows, targets, drafted])
  const targetSummary = useMemo(() => {
    const positions = targetRows.reduce<Record<string, number>>((counts, row) => {
      const key = row.position.toUpperCase()
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {})
    return ['RB', 'WR', 'QB', 'TE'].filter((key) => positions[key]).map((key) => `${positions[key]} ${key}`).join(' · ')
  }, [targetRows])
  const positionRows = useMemo(() => sortRankings(filteredRows, 'sourceRank', 'asc'), [filteredRows])
  const visiblePositionRows = useMemo(() => {
    return ['RB', 'WR', 'QB', 'TE']
      .filter((pos): pos is PositionKey => positionViews.has(pos as PositionKey))
      .flatMap((pos) => positionRows.filter((row) => row.position.toUpperCase() === pos && (showDrafted || !drafted.has(rankingId(row)))))
  }, [positionRows, positionViews, showDrafted, drafted])
  const navigationRows = view === 'board' ? visibleRows : visiblePositionRows

  const toggleDrafted = useCallback((id: string) => {
    setDrafted((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setTargets((current) => {
      if (!current.has(id)) return current
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }, [])

  useEffect(() => {
    setHydratedStorageKey('')
    const state = readDraftState(storageKey)
    setTargets(new Set(state.targets))
    setDrafted(new Set(state.drafted))
    setHydratedStorageKey(storageKey)
  }, [storageKey])

  useEffect(() => {
    setHydratedViewKey('')
    try {
      const saved = JSON.parse(localStorage.getItem(viewStorageKey) ?? '{}') as Partial<{ search: string; position: PositionFilter; sortKey: SortKey; sortDirection: SortDirection; view: ViewMode; boardPositions: PositionKey[]; positionViews: PositionKey[]; showDrafted: boolean; showTargetQueue: boolean; showMobileActions: boolean }>
      if (typeof saved.search === 'string') setSearch(saved.search)
      if (saved.position && ['ALL', 'QB', 'RB', 'WR', 'TE'].includes(saved.position)) setPosition(saved.position)
      if (saved.sortKey) setSortKey(saved.sortKey)
      if (saved.sortDirection === 'asc' || saved.sortDirection === 'desc') setSortDirection(saved.sortDirection)
      if (saved.view === 'board' || saved.view === 'positions') setView(saved.view)
      if (Array.isArray(saved.boardPositions)) setBoardPositions(new Set(saved.boardPositions.filter((value): value is PositionKey => allPositionKeys.has(value))))
      if (Array.isArray(saved.positionViews)) setPositionViews(new Set(saved.positionViews.filter((value): value is PositionKey => allPositionKeys.has(value))))
      if (typeof saved.showDrafted === 'boolean') setShowDrafted(saved.showDrafted)
      if (typeof saved.showTargetQueue === 'boolean') setShowTargetQueue(saved.showTargetQueue)
      if (typeof saved.showMobileActions === 'boolean') setShowMobileActions(saved.showMobileActions)
    } catch { /* Ignore stale or manually edited view preferences. */ }
    setHydratedViewKey(viewStorageKey)
  }, [viewStorageKey])

  useEffect(() => {
    if (hydratedViewKey !== viewStorageKey) return
    localStorage.setItem(viewStorageKey, JSON.stringify({ search, position, sortKey, sortDirection, view, boardPositions: [...boardPositions], positionViews: [...positionViews], showDrafted, showTargetQueue, showMobileActions }))
  }, [hydratedViewKey, viewStorageKey, search, position, sortKey, sortDirection, view, boardPositions, positionViews, showDrafted, showTargetQueue, showMobileActions])

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return
    writeDraftState(storageKey, { targets: [...targets], drafted: [...drafted] })
  }, [storageKey, hydratedStorageKey, targets, drafted])

  useEffect(() => {
    if (!selectedId) return
    const ids = navigationRows.map(rankingId)
    if (!ids.includes(selectedId)) setSelectedId(ids[0] ?? '')
  }, [navigationRows, selectedId])

  useEffect(() => {
    if (!selectedId) return
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-ranking-id="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    })
  }, [selectedId])

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
        if (selectedId) {
          event.preventDefault()
          setSelectedId('')
          return
        }
      }
      if (isTyping || event.metaKey || event.ctrlKey || event.altKey) return
      const shortcut = event.key.toLowerCase()
      if (shortcut === ',') {
        event.preventDefault()
        setSettingsOpen(true)
        return
      }
      if (shortcut === 'f' && selectedId) {
        event.preventDefault()
        toggleSet(setTargets, selectedId)
        return
      }
      if (event.key === 'Enter' && selectedId) {
        event.preventDefault()
        toggleDrafted(selectedId)
        return
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!navigationRows.length) return
        event.preventDefault()
        const ids = navigationRows.map(rankingId)
        const selectedIndex = ids.indexOf(selectedId)
        const fallbackIndex = event.key === 'ArrowDown' ? 0 : ids.length - 1
        const nextIndex = selectedIndex === -1
          ? fallbackIndex
          : Math.max(0, Math.min(ids.length - 1, selectedIndex + (event.key === 'ArrowDown' ? 1 : -1)))
        setSelectedId(ids[nextIndex])
        return
      }
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        const direction = event.key === 'ArrowRight' ? 1 : -1
        if (view === 'positions') {
          const visiblePositions = ['RB', 'WR', 'QB', 'TE'].filter((pos): pos is PositionKey => positionViews.has(pos as PositionKey))
          if (!visiblePositions.length) return
          event.preventDefault()
          const selectedRow = navigationRows.find((row) => rankingId(row) === selectedId)
          const currentPosition = (selectedRow?.position.toUpperCase() as PositionKey | undefined) ?? visiblePositions[0]
          const currentPositionIndex = Math.max(0, visiblePositions.indexOf(currentPosition))
          const nextPosition = visiblePositions[(currentPositionIndex + direction + visiblePositions.length) % visiblePositions.length]
          const currentLaneRows = navigationRows.filter((row) => row.position.toUpperCase() === currentPosition)
          const currentLaneIndex = Math.max(0, currentLaneRows.findIndex((row) => rankingId(row) === selectedId))
          const nextLaneRows = navigationRows.filter((row) => row.position.toUpperCase() === nextPosition)
          if (nextLaneRows.length) setSelectedId(rankingId(nextLaneRows[Math.min(currentLaneIndex, nextLaneRows.length - 1)]))
          return
        }
        const positionOrder: PositionFilter[] = ['ALL', 'RB', 'WR', 'QB', 'TE']
        const currentFilter: PositionFilter = boardPositions.size === allPositionKeys.size ? 'ALL' : boardPositions.size === 1 ? [...boardPositions][0] : position
        const currentIndex = Math.max(0, positionOrder.indexOf(currentFilter))
        const nextFilter = positionOrder[(currentIndex + direction + positionOrder.length) % positionOrder.length]
        event.preventDefault()
        handleBoardPosition(nextFilter)
        return
      }
      const positionShortcuts: Record<string, PositionFilter> = { a: 'ALL', q: 'QB', r: 'RB', w: 'WR', t: 'TE' }
      const nextPosition = positionShortcuts[shortcut]
      if (nextPosition) {
        event.preventDefault()
        if (nextPosition === 'ALL') {
          setPosition('ALL')
          setBoardPositions(new Set(allPositionKeys))
        } else {
          setPosition(nextPosition)
          setBoardPositions(new Set([nextPosition]))
        }
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [boardPositions, drafted, navigationRows, position, positionViews, selectedId, toggleDrafted, view])

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

  function togglePositionView(value: PositionKey) {
    setPositionViews((current) => {
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next
    })
  }

  function selectOnlyPosition(value: PositionKey) {
    setPositionViews(new Set([value]))
  }

  function toggleBoardPosition(value: PositionKey) {
    setBoardPositions((current) => {
      if (current.size === allPositionKeys.size) return new Set([value])
      const next = new Set(current)
      if (next.has(value)) next.delete(value)
      else next.add(value)
      return next.size ? next : new Set(allPositionKeys)
    })
    setPosition(value)
  }

  function handleBoardPosition(value: PositionFilter) {
    if (value === 'ALL') {
      setBoardPositions(new Set(allPositionKeys))
      setPosition('ALL')
      return
    }
    setBoardPositions(new Set([value]))
    setPosition(value)
  }

  function selectOnlyBoardPosition(value: PositionKey) {
    setBoardPositions(new Set([value]))
    setPosition(value)
  }

  function restoreDraft(nextTargets: string[], nextDrafted: string[]) {
    setTargets(new Set(nextTargets))
    setDrafted(new Set(nextDrafted))
  }

  function clearDraft() {
    setTargets(new Set())
    setDrafted(new Set())
  }

  const targetQueue = showTargetQueue ? <aside className="target-queue" aria-label="Target queue">
    <div className="target-queue__heading">
      <div><span className="eyebrow">Target queue</span><h2>Shortlist</h2></div>
      <strong>{targetRows.length}</strong>
    </div>
    {targetRows.length ? <p className="target-queue__summary">{targetSummary || 'No position mix yet'} · sorted by source rank</p> : null}
    <div className="target-queue__list">
      {targetRows.slice(0, 12).map((row) => (
        <button type="button" key={rankingId(row)} onClick={() => toggleSet(setTargets, rankingId(row))} aria-label={`Remove ${row.player} from queue`}>
          <span className={`target-queue__pos pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span>
          <span className="target-queue__player">
            <strong>{row.player}</strong>
            <span className="target-queue__details">
              <small aria-label={`${sourceLabel(selectedSource)} and Adjusted rank`}>#{formatRank(row.sourceRank)} → #{formatRank(row.adjustedRank)}</small>
              {selectedSource === 'espn' ? <small aria-label="Source and Adjusted salary">{formatValue(row.sourceValue)} → {formatValue(row.adjustedValue)}</small> : null}
            </span>
          </span>
          <span className="target-queue__diff">{selectedSource === 'espn' ? formatSignedValue(row.diff) : formatRank(row.diff)}</span>
          <span className="target-queue__remove" aria-hidden="true">×</span>
        </button>
      ))}
    </div>
    {!targetRows.length ? <p>Star players to build a shortlist that stays visible while you search and filter.</p> : null}
  </aside> : null

  return (
    <main className={`dashboard ${showMobileActions ? '' : 'mobile-actions-hidden'}`}>
      <section className="hero hero--compact">
        <div>
          <span className="eyebrow">Fantasy football</span>
          <h1>RankingsDiff</h1>
          <div className="view-summary" aria-live="polite">
            Looking at <strong>{selectedSeason}</strong> · <strong>{source?.label ?? selectedSource}</strong>
          </div>
        </div>
      </section>

      <section className="search-panel" aria-label="Player search">
        <label className="header-search header-search--standalone">
          <span>Search players</span>
          <input data-player-search ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ja'Marr, CIN, RB…" />
        </label>
      </section>

      <section className="draft-toolbar" aria-label="Draft board controls">
        <button className="settings-icon-trigger" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" aria-haspopup="dialog" title={`${selectedSeason} · ${source?.label ?? selectedSource} · ${visibleRows.length.toLocaleString()} showing`}>
          <span aria-hidden="true">⚙</span>
        </button>
        <label className="drafted-toggle view-mode-toggle"><input type="checkbox" aria-label="By position" checked={view === 'positions'} onChange={(event) => setView(event.target.checked ? 'positions' : 'board')} /><span className="desktop-label">Position</span><span className="mobile-label">Pos</span></label>
        <Filters
          search={search}
          position={position}
          onSearch={setSearch}
          onPosition={view === 'board' ? handleBoardPosition : setPosition}
          showSearch={false}
          multiSelect={view === 'board'}
          selectedPositions={view === 'board' ? boardPositions : positionViews}
          showPositions={view === 'board'}
          onTogglePosition={view === 'board' ? toggleBoardPosition : togglePositionView}
          onSelectOnlyPosition={view === 'board' ? selectOnlyBoardPosition : selectOnlyPosition}
          compact
        />
        <div className="mobile-sort-control" aria-label="Mobile sort controls">
          <label htmlFor="mobile-sort">Sort by</label>
          <select id="mobile-sort" value={sortKey} onChange={(event) => handleSort(event.target.value as SortKey)}>
            <option value="player">Player</option>
            <option value="position">Position</option>
            <option value="sourceRank">{sourceLabel(selectedSource)} rank</option>
            <option value="adjustedRank">Adjusted rank</option>
            {selectedSource === 'espn' ? <option value="sourceValue">{sourceLabel(selectedSource)} price</option> : null}
            {selectedSource === 'espn' ? <option value="adjustedValue">Adjusted price</option> : null}
            <option value="diff">{selectedSource === 'espn' ? 'Value diff' : 'Diff'}</option>
          </select>
          <button type="button" className="mobile-sort-direction" onClick={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')} aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}>
            {sortDirection === 'asc' ? '↑' : '↓'} {sortDirection === 'asc' ? 'Ascending' : 'Descending'}
          </button>
        </div>
        <div className="draft-toolbar__actions">
          <label className="drafted-toggle"><input type="checkbox" aria-label="Show drafted" checked={showDrafted} onChange={(event) => setShowDrafted(event.target.checked)} /><span>Drafted</span></label>
          <label className="drafted-toggle mobile-actions-toggle"><input type="checkbox" aria-label="Show actions" checked={showMobileActions} onChange={(event) => setShowMobileActions(event.target.checked)} /><span>Actions</span></label>
        </div>
      </section>

      <RecentDraftPanel rows={rows} drafted={drafted} source={selectedSource} />

      {view === 'board' ? (
        <div className={`draft-board-layout${showTargetQueue ? '' : ' draft-board-layout--queue-hidden'}`}>
          <div>
            <RankingsTable rows={visibleRows} teams={teams} source={selectedSource} sortKey={sortKey} sortDirection={sortDirection} targets={targets} drafted={drafted} selectedId={selectedId} onSelect={setSelectedId} onSort={handleSort} onTarget={(id) => toggleSet(setTargets, id)} onDrafted={toggleDrafted} />
            <section className="cards-list" aria-label="Mobile rankings cards">
              {visibleRows.map((row) => {
                const id = rankingId(row)
                return <RankingCard key={`${row.player}-${row.team}-${row.sourceRank}-card`} row={row} teams={teams} source={selectedSource} targeted={targets.has(id)} drafted={drafted.has(id)} selected={selectedId === id} onSelect={() => setSelectedId(id)} onTarget={() => toggleSet(setTargets, id)} onDrafted={() => toggleDrafted(id)} />
              })}
            </section>
          </div>
          {targetQueue}
        </div>
      ) : (
        <div className={`draft-board-layout position-view-layout${showTargetQueue ? '' : ' draft-board-layout--queue-hidden'}`}>
          <PositionBoard rows={positionRows} positions={positionViews} teams={teams} targets={targets} drafted={drafted} selectedId={selectedId} onSelect={setSelectedId} isEspn={selectedSource === 'espn'} showDrafted={showDrafted} onTarget={(id) => toggleSet(setTargets, id)} onDrafted={toggleDrafted} />
          {targetQueue}
        </div>
      )}
      <SettingsPopover
        open={settingsOpen}
        manifest={manifest}
        selectedSeason={selectedSeason}
        selectedSource={source?.id ?? selectedSource}
        currentSource={source}
        sourceChecks={sourceChecks}
        generatedAt={manifest.generatedAt}
        visibleCount={visibleRows.length}
        targetCount={targetRows.length}
        showTargetQueue={showTargetQueue}
        targets={targets}
        drafted={drafted}
        onRestoreDraft={restoreDraft}
        onClearDraft={clearDraft}
        onShowTargetQueue={setShowTargetQueue}
        onSeason={handleSeasonFromSettings}
        onSource={handleSourceFromSettings}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  )
}
