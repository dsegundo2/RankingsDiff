import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AdjustedProfile, DataManifest, PositionFilter, RankingRow, SourceCheckPayload, SortDirection, SortKey, TeamAsset } from '../types'
import { filterRankings, formatRank, formatSignedValue, formatValue, sortRankings, sourceLabel } from '../data/rankings'
import { rankingId, readAuctionDraftState, readDraftShare, readDraftState, writeAuctionDraftState, writeDraftState } from '../data/draftState'
import { DEFAULT_ROSTER_TARGETS, type RosterTargetGoals } from '../data/rosterTargets'
import { Filters } from './Filters'
import { RankingCard } from './RankingCard'
import { RankingsTable } from './RankingsTable'
import { SettingsPopover } from './SettingsPopover'
import { PositionBoard } from './PositionBoard'
import { RecentDraftPanel } from './RecentDraftPanel'
import { AuctionRosterPanel } from './AuctionRosterPanel'

type ViewMode = 'board' | 'positions'
type PositionKey = Exclude<PositionFilter, 'ALL'>
type DraftSnapshot = { targets: string[]; drafted: string[]; mine: string[]; prices: Record<string, number>; slots: Record<string, string> }
const allPositionKeys = new Set<PositionKey>(['RB', 'WR', 'QB', 'TE'])
const benchSlots = ['BENCH1', 'BENCH2', 'BENCH3', 'BENCH4', 'BENCH5']

function autoRosterSlot(row: RankingRow, drafted: Set<string>, slots: Record<string, string>): string {
  const occupied = new Set(Object.entries(slots).filter(([id]) => drafted.has(id)).map(([, slot]) => slot))
  const position = row.position.toUpperCase()
  const eligible = position === 'QB' ? ['QB1'] : position === 'RB' ? ['RB1', 'RB2', 'FLEX'] : position === 'WR' ? ['WR1', 'WR2', 'FLEX'] : position === 'TE' ? ['TE1', 'FLEX'] : []
  return [...eligible, ...benchSlots].find((slot) => !occupied.has(slot)) ?? benchSlots[benchSlots.length - 1]
}
type Props = {
  manifest: DataManifest
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  sourceChecks?: SourceCheckPayload
  selectedSeason: number
  selectedSource: string
  adjustedProfiles: AdjustedProfile[]
  selectedAdjustedProfile: string
  onAdjustedProfile: (profile: string) => void
  onSeason: (season: number) => void
  onSource: (source: string) => void
}

export function RankingsDashboard({ manifest, rows, teams, sourceChecks, selectedSeason, selectedSource, adjustedProfiles, selectedAdjustedProfile, onAdjustedProfile, onSeason, onSource }: Props) {
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
  const [mine, setMine] = useState<Set<string>>(new Set())
  const [draftPrices, setDraftPrices] = useState<Record<string, number>>({})
  const [draftSlots, setDraftSlots] = useState<Record<string, string>>({})
  const [targetGoals, setTargetGoals] = useState<RosterTargetGoals>(DEFAULT_ROSTER_TARGETS)
  const [showDrafted, setShowDrafted] = useState(true)
  const [showTargetQueue, setShowTargetQueue] = useState(true)
  const [showDraftLog, setShowDraftLog] = useState(true)
  const [showRosterPanel, setShowRosterPanel] = useState(true)
  const [stickyWorkbench, setStickyWorkbench] = useState(false)
  const [showMobileActions, setShowMobileActions] = useState(true)
  const [hydratedStorageKey, setHydratedStorageKey] = useState('')
  const [hydratedViewKey, setHydratedViewKey] = useState('')
  const [hydratedTargetKey, setHydratedTargetKey] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const historyRef = useRef<DraftSnapshot[]>([{ targets: [], drafted: [], mine: [], prices: {}, slots: {} }])
  const historyIndexRef = useRef(0)
  const season = manifest.seasons.find((item) => item.season === selectedSeason) ?? manifest.seasons[0]
  const source = season?.sources.find((item) => item.id === selectedSource) ?? season?.sources[0]
  const storageKey = `rankingsdiff:draft:v1:${selectedSeason}:${selectedSource}`
  const auctionStorageKey = `rankingsdiff:auction:v1:${selectedSeason}:${selectedSource}`
  const viewStorageKey = `rankingsdiff:view:v1:${selectedSeason}:${selectedSource}`
  const targetStorageKey = `rankingsdiff:roster-targets:v1:${selectedSeason}:${selectedSource}`
  const filteredRows = useMemo(() => {
    const searchedRows = filterRankings(rows, search, 'ALL', teams)
    if (view === 'positions' || boardPositions.size === allPositionKeys.size) return searchedRows
    return searchedRows.filter((row) => boardPositions.has(row.position.toUpperCase() as PositionKey))
  }, [rows, search, teams, view, boardPositions])
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
  const draftedCounts = useMemo(() => {
    const counts: Record<PositionFilter, number> = { ALL: 0, RB: 0, WR: 0, QB: 0, TE: 0 }
    rows.forEach((row) => {
      if (!drafted.has(rankingId(row))) return
      const positionKey = row.position.toUpperCase() as PositionFilter
      if (positionKey in counts) {
        counts[positionKey] += 1
        counts.ALL += 1
      }
    })
    return counts
  }, [rows, drafted])
  const positionRows = useMemo(() => sortRankings(filteredRows, 'sourceRank', 'asc'), [filteredRows])
  const visiblePositionRows = useMemo(() => {
    return ['RB', 'WR', 'QB', 'TE']
      .filter((pos): pos is PositionKey => positionViews.has(pos as PositionKey))
      .flatMap((pos) => positionRows.filter((row) => row.position.toUpperCase() === pos && (showDrafted || !drafted.has(rankingId(row)))))
  }, [positionRows, positionViews, showDrafted, drafted])
  const navigationRows = view === 'board' ? visibleRows : visiblePositionRows

  function focusSearchForNextPlayer() {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }

  const applyDraftState = useCallback((nextTargets: Set<string>, nextDrafted: Set<string>, nextPrices = draftPrices, nextSlots = draftSlots, nextMine = mine, record = true) => {
    if (record) {
      const snapshot: DraftSnapshot = { targets: [...nextTargets], drafted: [...nextDrafted], mine: [...nextMine], prices: nextPrices, slots: nextSlots }
      const current = historyRef.current[historyIndexRef.current]
      if (JSON.stringify(current) !== JSON.stringify(snapshot)) {
        historyRef.current = [...historyRef.current.slice(0, historyIndexRef.current + 1), snapshot].slice(-100)
        historyIndexRef.current = historyRef.current.length - 1
      }
    }
    setTargets(nextTargets)
    setDrafted(nextDrafted)
    setMine(nextMine)
    setDraftPrices(nextPrices)
    setDraftSlots(nextSlots)
  }, [draftPrices, draftSlots, mine])

  const toggleDrafted = useCallback((id: string) => {
    const wasDrafted = drafted.has(id)
    const nextDrafted = new Set(drafted)
    if (wasDrafted) nextDrafted.delete(id)
    else nextDrafted.add(id)
    const nextTargets = new Set(targets)
    nextTargets.delete(id)
    const nextMine = new Set(mine)
    const nextPrices = { ...draftPrices }
    const nextSlots = { ...draftSlots }
    if (wasDrafted) {
      nextMine.delete(id)
      delete nextPrices[id]
      delete nextSlots[id]
    }
    applyDraftState(nextTargets, nextDrafted, nextPrices, nextSlots, nextMine)
  }, [applyDraftState, drafted, draftPrices, draftSlots, mine, targets])

  const toggleMine = useCallback((id: string) => {
    if (!drafted.has(id)) return
    const nextMine = new Set(mine)
    const nextPrices = { ...draftPrices }
    const nextSlots = { ...draftSlots }
    if (nextMine.has(id)) {
      nextMine.delete(id)
      delete nextPrices[id]
      delete nextSlots[id]
    } else {
      nextMine.add(id)
      const row = rows.find((candidate) => rankingId(candidate) === id)
      if (row) nextSlots[id] = autoRosterSlot(row, drafted, draftSlots)
    }
    applyDraftState(new Set(targets), new Set(drafted), nextPrices, nextSlots, nextMine)
  }, [applyDraftState, drafted, draftPrices, draftSlots, mine, rows, targets])

  const toggleTarget = useCallback((id: string) => {
    const nextTargets = new Set(targets)
    if (nextTargets.has(id)) nextTargets.delete(id)
    else nextTargets.add(id)
    applyDraftState(nextTargets, new Set(drafted))
  }, [applyDraftState, drafted, targets])

  const draftPlayer = useCallback((id: string) => {
    const isDrafting = !drafted.has(id)
    toggleDrafted(id)
    if (isDrafting && search.trim()) {
      setSearch('')
      window.requestAnimationFrame(focusSearchForNextPlayer)
    }
  }, [drafted, search, toggleDrafted])

  const moveDraftHistory = useCallback((direction: -1 | 1) => {
    const nextIndex = historyIndexRef.current + direction
    if (nextIndex < 0 || nextIndex >= historyRef.current.length) return
    historyIndexRef.current = nextIndex
    const snapshot = historyRef.current[nextIndex]
    applyDraftState(new Set(snapshot.targets), new Set(snapshot.drafted), snapshot.prices, snapshot.slots, new Set(snapshot.mine), false)
  }, [applyDraftState])

  useEffect(() => {
    setHydratedStorageKey('')
    const state = readDraftState(storageKey)
    const auctionState = readAuctionDraftState(auctionStorageKey)
    const shared = readDraftShare(new URLSearchParams(window.location.search).get('draft'))
    const initialState = shared?.season === selectedSeason && shared.source === selectedSource ? shared : state
    setTargets(new Set(initialState.targets))
    setDrafted(new Set(initialState.drafted))
    setMine(new Set(auctionState.mine.filter((id) => initialState.drafted.includes(id))))
    setDraftPrices(auctionState.prices)
    setDraftSlots(auctionState.slots)
    historyRef.current = [{ targets: [...initialState.targets], drafted: [...initialState.drafted], mine: auctionState.mine, prices: auctionState.prices, slots: auctionState.slots }]
    historyIndexRef.current = 0
    setHydratedStorageKey(storageKey)
  }, [auctionStorageKey, selectedSeason, selectedSource, storageKey])

  useEffect(() => {
    setHydratedTargetKey('')
    try {
      const saved = JSON.parse(localStorage.getItem(targetStorageKey) ?? '{}') as Record<string, unknown>
      const next = { ...DEFAULT_ROSTER_TARGETS }
      Object.keys(next).forEach((slot) => {
        if (typeof saved[slot] === 'number' && Number.isFinite(saved[slot])) next[slot] = Math.max(0, saved[slot] as number)
      })
      setTargetGoals(next)
    } catch {
      setTargetGoals(DEFAULT_ROSTER_TARGETS)
    }
    setHydratedTargetKey(targetStorageKey)
  }, [targetStorageKey])

  useEffect(() => {
    if (hydratedTargetKey !== targetStorageKey) return
    localStorage.setItem(targetStorageKey, JSON.stringify(targetGoals))
  }, [hydratedTargetKey, targetGoals, targetStorageKey])

  useEffect(() => {
    setHydratedViewKey('')
    try {
      const saved = JSON.parse(localStorage.getItem(viewStorageKey) ?? '{}') as Partial<{ search: string; position: PositionFilter; sortKey: SortKey; sortDirection: SortDirection; view: ViewMode; boardPositions: PositionKey[]; positionViews: PositionKey[]; showDrafted: boolean; showTargetQueue: boolean; showDraftLog: boolean; showRosterPanel: boolean; stickyWorkbench: boolean; showMobileActions: boolean }>
      if (typeof saved.search === 'string') setSearch(saved.search)
      if (saved.position && ['ALL', 'QB', 'RB', 'WR', 'TE'].includes(saved.position)) setPosition(saved.position)
      if (saved.sortKey) setSortKey(saved.sortKey)
      if (saved.sortDirection === 'asc' || saved.sortDirection === 'desc') setSortDirection(saved.sortDirection)
      if (saved.view === 'board' || saved.view === 'positions') setView(saved.view)
      if (Array.isArray(saved.boardPositions)) setBoardPositions(new Set(saved.boardPositions.filter((value): value is PositionKey => allPositionKeys.has(value))))
      if (Array.isArray(saved.positionViews)) setPositionViews(new Set(saved.positionViews.filter((value): value is PositionKey => allPositionKeys.has(value))))
      if (typeof saved.showDrafted === 'boolean') setShowDrafted(saved.showDrafted)
      if (typeof saved.showTargetQueue === 'boolean') setShowTargetQueue(saved.showTargetQueue)
      if (typeof saved.showDraftLog === 'boolean') setShowDraftLog(saved.showDraftLog)
      if (typeof saved.showRosterPanel === 'boolean') setShowRosterPanel(saved.showRosterPanel)
      if (typeof saved.stickyWorkbench === 'boolean') setStickyWorkbench(saved.stickyWorkbench)
      if (typeof saved.showMobileActions === 'boolean') setShowMobileActions(saved.showMobileActions)
    } catch { /* Ignore stale or manually edited view preferences. */ }
    setHydratedViewKey(viewStorageKey)
  }, [viewStorageKey])

  useEffect(() => {
    if (hydratedViewKey !== viewStorageKey) return
    localStorage.setItem(viewStorageKey, JSON.stringify({ search, position, sortKey, sortDirection, view, boardPositions: [...boardPositions], positionViews: [...positionViews], showDrafted, showTargetQueue, showDraftLog, showRosterPanel, stickyWorkbench, showMobileActions }))
  }, [hydratedViewKey, viewStorageKey, search, position, sortKey, sortDirection, view, boardPositions, positionViews, showDrafted, showTargetQueue, showDraftLog, showRosterPanel, stickyWorkbench, showMobileActions])

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return
    writeDraftState(storageKey, { targets: [...targets], drafted: [...drafted] })
  }, [storageKey, hydratedStorageKey, targets, drafted])

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return
    writeAuctionDraftState(auctionStorageKey, { mine: [...mine], prices: draftPrices, slots: draftSlots })
  }, [auctionStorageKey, draftPrices, draftSlots, hydratedStorageKey, mine, storageKey])

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
      const isPlayerSearch = target === searchInputRef.current
      if (!isTyping && (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        moveDraftHistory(event.shiftKey ? 1 : -1)
        return
      }
      if (!isTyping && event.ctrlKey && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        moveDraftHistory(1)
        return
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        const input = searchInputRef.current ?? document.querySelector<HTMLInputElement>('[data-player-search]')
        input?.focus()
        input?.select()
        return
      }
      if (event.key === '/' && !isTyping && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        focusSearchForNextPlayer()
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
      if (isPlayerSearch && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
        if (!navigationRows.length) return
        event.preventDefault()
        setSelectedId(rankingId(navigationRows[event.key === 'ArrowDown' ? 0 : navigationRows.length - 1]))
        return
      }
      if (isPlayerSearch && event.key === 'Enter') {
        if (!navigationRows.length) return
        event.preventDefault()
        draftPlayer(rankingId(navigationRows[0]))
        return
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
        if (drafted.has(selectedId)) toggleMine(selectedId)
        else toggleTarget(selectedId)
        return
      }
      if (event.key === 'Enter' && selectedId) {
        event.preventDefault()
        const isDrafting = !drafted.has(selectedId)
        draftPlayer(selectedId)
        if (isDrafting) {
          const selectedRow = navigationRows.find((row) => rankingId(row) === selectedId)
          const laneRows = view === 'positions' && selectedRow
            ? navigationRows.filter((row) => row.position.toUpperCase() === selectedRow.position.toUpperCase())
            : navigationRows
          const selectedIndex = laneRows.findIndex((row) => rankingId(row) === selectedId)
          const nextRow = laneRows[selectedIndex + 1]
          if (nextRow) setSelectedId(rankingId(nextRow))
        }
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
      if (shortcut === 'p') {
        event.preventDefault()
        setView((current) => current === 'positions' ? 'board' : 'positions')
        return
      }
      const nextPosition = positionShortcuts[shortcut]
      if (nextPosition) {
        event.preventDefault()
        if (view === 'positions') {
          if (nextPosition === 'ALL') setPositionViews(new Set(allPositionKeys))
          else togglePositionView(nextPosition)
        } else if (nextPosition === 'ALL') {
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
  }, [boardPositions, drafted, draftPlayer, moveDraftHistory, navigationRows, position, positionViews, selectedId, toggleDrafted, toggleMine, toggleTarget, view])

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
    applyDraftState(new Set(nextTargets), new Set(nextDrafted), {}, {}, new Set())
  }

  function clearDraft() {
    applyDraftState(new Set(), new Set(), {}, {}, new Set())
  }

  function updateDraftPrice(id: string, value: number | undefined) {
    setDraftPrices((current) => {
      const next = { ...current }
      if (value === undefined || !Number.isFinite(value) || value < 0) delete next[id]
      else next[id] = value
      return next
    })
  }

  function moveDraftSlot(id: string, value: string) {
    setDraftSlots((current) => {
      const next = { ...current }
      const source = next[id]
      const occupant = Object.entries(next).find(([pickId, slot]) => pickId !== id && slot === value)?.[0]
      next[id] = value
      if (occupant) {
        if (source) next[occupant] = source
        else delete next[occupant]
      }
      return next
    })
  }

  const targetQueue = showTargetQueue ? <aside className="target-queue" aria-label="Target queue">
    <div className="target-queue__heading">
      <div><span className="eyebrow">Target queue</span><h2>Shortlist</h2></div>
      <strong>{targetRows.length}</strong>
    </div>
    {targetRows.length ? <p className="target-queue__summary">{targetSummary || 'No position mix yet'} · sorted by source rank</p> : null}
    <div className="target-queue__list">
      {targetRows.slice(0, 12).map((row) => (
        <button type="button" key={rankingId(row)} onClick={() => toggleTarget(rankingId(row))} aria-label={`Remove ${row.player} from queue`}>
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

      <div className={`dashboard-workbench${stickyWorkbench ? ' dashboard-workbench--sticky' : ''}`}>
      {showDraftLog ? <RecentDraftPanel rows={rows} drafted={drafted} mine={mine} teams={teams} onMine={toggleMine} /> : null}

      <section className="search-panel" aria-label="Player search">
        <label className="header-search header-search--standalone">
          <span>Search players</span>
          <div className="search-input-wrap">
            <input data-player-search ref={searchInputRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Ja'Marr, CIN, RB…" />
            {search ? <button className="search-clear" type="button" onClick={() => { setSearch(''); searchInputRef.current?.focus() }} aria-label="Clear player search">×</button> : null}
          </div>
        </label>
        <div className="search-meta" aria-live="polite"><span>{visibleRows.length.toLocaleString()} player{visibleRows.length === 1 ? '' : 's'} showing</span><span className="search-meta__hint">Click a player to select · Enter drafts · ↑↓ moves</span></div>
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
          draftedCounts={draftedCounts}
          compact
        />
        <div className="mobile-sort-control" aria-label="Mobile sort controls">
          <label htmlFor="mobile-sort">Sort by</label>
          <select id="mobile-sort" value={sortKey} onChange={(event) => handleSort(event.target.value as SortKey)}>
            <option value="player">Player</option>
            <option value="position">Position</option>
            <option value="sourceRank">{sourceLabel(selectedSource)} rank</option>
            <option value="adjustedRank">Adjusted rank</option>
            <option value="diff">Delta</option>
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
      </div>

      {view === 'board' ? (
        <div className={`draft-board-layout${showTargetQueue ? '' : ' draft-board-layout--queue-hidden'}`} data-roster-visible={showRosterPanel ? 'true' : 'false'}>
          <div>
            <RankingsTable rows={visibleRows} teams={teams} source={selectedSource} sortKey={sortKey} sortDirection={sortDirection} targets={targets} drafted={drafted} mine={mine} selectedId={selectedId} onSelect={setSelectedId} onSort={handleSort} onTarget={toggleTarget} onDrafted={draftPlayer} onMine={toggleMine} />
            <section className="cards-list" aria-label="Mobile rankings cards">
              {visibleRows.map((row) => {
                const id = rankingId(row)
                return <RankingCard key={`${row.player}-${row.team}-${row.sourceRank}-card`} row={row} teams={teams} source={selectedSource} targeted={targets.has(id)} drafted={drafted.has(id)} mine={mine.has(id)} selected={selectedId === id} onSelect={() => setSelectedId(id)} onTarget={() => toggleTarget(id)} onDrafted={() => draftPlayer(id)} onMine={() => toggleMine(id)} />
              })}
            </section>
          </div>
          <div className="draft-side-stack">{showRosterPanel ? <AuctionRosterPanel rows={rows} teams={teams} targetGoals={targetGoals} drafted={mine} targetRows={targetRows} showTargetQueue={showTargetQueue} mode={selectedSource === 'espn' ? 'auction' : 'snake'} source={selectedSource as 'espn' | 'fpros'} prices={draftPrices} slots={draftSlots} onPrice={updateDraftPrice} onMoveSlot={moveDraftSlot} onTarget={toggleTarget} /> : targetQueue}</div>
        </div>
      ) : (
        <div className={`draft-board-layout position-view-layout${showTargetQueue ? '' : ' draft-board-layout--queue-hidden'}`} data-roster-visible={showRosterPanel ? 'true' : 'false'}>
          <PositionBoard rows={positionRows} positions={positionViews} teams={teams} targets={targets} drafted={drafted} mine={mine} selectedId={selectedId} onSelect={setSelectedId} isEspn={selectedSource === 'espn'} showDrafted={showDrafted} onTarget={toggleTarget} onDrafted={draftPlayer} onMine={toggleMine} />
          <div className="draft-side-stack">{showRosterPanel ? <AuctionRosterPanel rows={rows} teams={teams} targetGoals={targetGoals} drafted={mine} targetRows={targetRows} showTargetQueue={showTargetQueue} mode={selectedSource === 'espn' ? 'auction' : 'snake'} source={selectedSource as 'espn' | 'fpros'} prices={draftPrices} slots={draftSlots} onPrice={updateDraftPrice} onMoveSlot={moveDraftSlot} onTarget={toggleTarget} /> : targetQueue}</div>
        </div>
      )}
      <SettingsPopover
        open={settingsOpen}
        manifest={manifest}
        selectedSeason={selectedSeason}
        selectedSource={source?.id ?? selectedSource}
        currentSource={source}
        adjustedProfiles={adjustedProfiles}
        selectedAdjustedProfile={selectedAdjustedProfile}
        onAdjustedProfile={onAdjustedProfile}
        sourceChecks={sourceChecks}
        generatedAt={manifest.generatedAt}
        visibleCount={visibleRows.length}
        targetCount={targetRows.length}
        showTargetQueue={showTargetQueue}
        showDraftLog={showDraftLog}
        showRosterPanel={showRosterPanel}
        stickyWorkbench={stickyWorkbench}
        targets={targets}
        drafted={drafted}
        targetGoals={targetGoals}
        onRestoreDraft={restoreDraft}
        onClearDraft={clearDraft}
        onShowTargetQueue={setShowTargetQueue}
        onShowDraftLog={setShowDraftLog}
        onShowRosterPanel={setShowRosterPanel}
        onShowStickyWorkbench={setStickyWorkbench}
        onSeason={handleSeasonFromSettings}
        onSource={handleSourceFromSettings}
        onTargetGoals={setTargetGoals}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
  )
}
