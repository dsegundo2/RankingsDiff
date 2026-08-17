import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AdjustedProfile, DataManifest, PositionFilter, RankingRow, SourceCheckPayload, SortDirection, SortKey, TeamAsset, YahooProjectionMap } from '../types'
import { calculateRegression, filterRankings, formatRank, formatSignedValue, formatValue, rankingDifference, regressionDifference, sortRankings, sourceLabel, yahooProjectionId } from '../data/rankings'
import { DEFAULT_DRAFT_SIZE, DEFAULT_DRAFT_SLOT, MAX_DRAFT_SIZE, MIN_DRAFT_SIZE, rankingId, readAuctionDraftState, readDraftShare, readDraftState, writeAuctionDraftState, writeDraftState } from '../data/draftState'
import { DEFAULT_ROSTER_TARGETS, rosterTargetSlots, type RosterTargetGoals } from '../data/rosterTargets'
import { Filters } from './Filters'
import { RankingCard } from './RankingCard'
import { RankingsTable } from './RankingsTable'
import { SettingsPopover, type MatchHealth } from './SettingsPopover'
import { PositionBoard } from './PositionBoard'
import { RecentDraftPanel } from './RecentDraftPanel'
import { AuctionRosterPanel } from './AuctionRosterPanel'
import { withBasePath } from '../data/paths'
import { RankingsDiffChart } from './RankingsDiffChart'

type ViewMode = 'board' | 'positions'
type DraftMode = 'snake' | 'auction'
type PositionKey = Exclude<PositionFilter, 'ALL'>
type DraftSnapshot = { targets: string[]; drafted: string[]; picks: Record<string, number>; mine: string[]; prices: Record<string, number>; slots: Record<string, string> }
const allPositionKeys = new Set<PositionKey>(['RB', 'WR', 'QB', 'TE', 'K'])
const flexPositionKeys = new Set<PositionKey>(['RB', 'WR', 'TE'])
const DEFAULT_SHOW_YAHOO_PROJECTIONS = false
const DEFAULT_SHOW_REGRESSION_DIFF = false
const DEFAULT_DRAFT_MODE: DraftMode = 'snake'

function autoRosterSlot(row: RankingRow, drafted: Set<string>, slots: Record<string, string>, targetGoals: RosterTargetGoals): string {
  const occupied = new Set(Object.entries(slots).filter(([id]) => drafted.has(id)).map(([, slot]) => slot))
  const position = row.position.toUpperCase()
  const rosterSlots = rosterTargetSlots(targetGoals)
  const eligible = rosterSlots.filter((slot) => slot.startsWith(position) || (slot === 'FLEX' && ['RB', 'WR', 'TE'].includes(position)))
  const benches = rosterSlots.filter((slot) => slot.startsWith('BENCH'))
  return [...eligible, ...benches].find((slot) => !occupied.has(slot)) ?? benches[benches.length - 1] ?? rosterSlots[rosterSlots.length - 1]
}

function firstAvailableDraftRound(mine: Set<string>, prices: Record<string, number>): number {
  const usedRounds = new Set([...mine].map((id) => prices[id]).filter((round): round is number => Number.isInteger(round) && round > 0))
  let round = 1
  while (usedRounds.has(round)) round += 1
  return round
}

function snakePickForSlot(round: number, slot: number, draftSize: number): number {
  const pickInRound = round % 2 === 1 ? slot : draftSize - slot + 1
  return ((round - 1) * draftSize) + pickInRound
}
type Props = {
  manifest: DataManifest
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  sourceChecks?: SourceCheckPayload
  selectedSeason: number
  selectedSource: string
  yahooProjections: YahooProjectionMap
  adjustedProfiles: AdjustedProfile[]
  selectedAdjustedProfile: string
  onAdjustedProfile: (profile: string) => void
  onSeason: (season: number) => void
  onSource: (source: string) => void
  route: 'board' | 'analytics'
  onNavigate: (path: 'board' | 'analytics') => void
}

export function RankingsDashboard({ manifest, rows, teams, yahooProjections, sourceChecks, selectedSeason, selectedSource, adjustedProfiles, selectedAdjustedProfile, onAdjustedProfile, onSeason, onSource, route, onNavigate }: Props) {
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
  const [draftPicks, setDraftPicks] = useState<Record<string, number>>({})
  const [draftSlot, setDraftSlot] = useState(DEFAULT_DRAFT_SLOT)
  const [draftSize, setDraftSize] = useState(DEFAULT_DRAFT_SIZE)
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
  const [showYahooProjections, setShowYahooProjections] = useState(DEFAULT_SHOW_YAHOO_PROJECTIONS)
  const [showRegressionDiff, setShowRegressionDiff] = useState(DEFAULT_SHOW_REGRESSION_DIFF)
  const [draftMode, setDraftMode] = useState<DraftMode>(DEFAULT_DRAFT_MODE)
  const [hydratedStorageKey, setHydratedStorageKey] = useState('')
  const [hydratedViewKey, setHydratedViewKey] = useState('')
  const [hydratedTargetKey, setHydratedTargetKey] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const workbenchRef = useRef<HTMLDivElement>(null)
  const historyRef = useRef<DraftSnapshot[]>([{ targets: [], drafted: [], picks: {}, mine: [], prices: {}, slots: {} }])
  const historyIndexRef = useRef(0)
  const season = manifest.seasons.find((item) => item.season === selectedSeason) ?? manifest.seasons[0]
  const source = season?.sources.find((item) => item.id === selectedSource) ?? season?.sources[0]
  const projectionMode = selectedAdjustedProfile === 'half-ppr' ? 'half' : 'full'
  const storageKey = `rankingsdiff:draft:v1:${selectedSeason}:${selectedSource}`
  const auctionStorageKey = `rankingsdiff:auction:v1:${selectedSeason}:${selectedSource}`
  const viewStorageKey = `rankingsdiff:view:v1:${selectedSeason}:${selectedSource}`
  const targetStorageKey = `rankingsdiff:roster-targets:v1:${selectedSeason}:${selectedSource}`

  const handleSort = useCallback((key: SortKey) => {
    if (key === sortKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDirection('asc') }
  }, [sortKey])

  useEffect(() => {
    const workbench = workbenchRef.current
    if (!workbench) return
    const updateHeight = () => workbench.parentElement?.style.setProperty('--sticky-workbench-height', `${workbench.getBoundingClientRect().height}px`)
    updateHeight()
    const observer = new ResizeObserver(updateHeight)
    observer.observe(workbench)
    return () => observer.disconnect()
  }, [showDraftLog, stickyWorkbench, showMobileActions, view, selectedSeason, selectedSource])
  const displayRows = useMemo(() => rows.map((row) => selectedSource === 'espn' && draftMode === 'snake' ? { ...row, diff: rankingDifference(row) } : row), [draftMode, rows, selectedSource])
  const rowsWithYahooProjection = useMemo(() => displayRows.map((row) => ({ ...row, yahooProjection: yahooProjections[yahooProjectionId(row.player, row.team)]?.[projectionMode === 'half' ? 'week1HalfPpr' : 'week1Ppr'] })), [displayRows, projectionMode, yahooProjections])
  const filteredRows = useMemo(() => {
    const searchedRows = filterRankings(rowsWithYahooProjection, search, 'ALL', teams)
    if (search.trim().length > 0) return searchedRows
    if (view === 'positions' || boardPositions.size === allPositionKeys.size) return searchedRows
    return searchedRows.filter((row) => boardPositions.has(row.position.toUpperCase() as PositionKey))
  }, [rowsWithYahooProjection, search, teams, view, boardPositions])
  const regressionRows = useMemo(() => {
    const line = calculateRegression(filteredRows)
    return filteredRows.map((row) => ({ ...row, regressionDiff: regressionDifference(row, line, filteredRows) }))
  }, [filteredRows])
  const visibleRows = useMemo(() => sortRankings(regressionRows, sortKey, sortDirection).filter((row) => showDrafted || !drafted.has(rankingId(row))), [regressionRows, sortKey, sortDirection, showDrafted, drafted])
  const matchHealth = useMemo<MatchHealth>(() => ({
    total: rows.length,
    full: rows.filter((row) => typeof row.adjustedRank === 'number' && Number.isFinite(row.adjustedRank)).length,
    half: rows.filter((row) => typeof row.adjustedRankHalfPpr === 'number' && Number.isFinite(row.adjustedRankHalfPpr)).length,
  }), [rows])
  const targetRows = useMemo(() => sortRankings(rows.filter((row) => targets.has(rankingId(row)) && !drafted.has(rankingId(row))), sortKey, 'asc'), [rows, sortKey, targets, drafted])
  const targetSummary = useMemo(() => {
    const positions = targetRows.reduce<Record<string, number>>((counts, row) => {
      const key = row.position.toUpperCase()
      counts[key] = (counts[key] ?? 0) + 1
      return counts
    }, {})
    return ['RB', 'WR', 'QB', 'TE'].filter((key) => positions[key]).map((key) => `${positions[key]} ${key}`).join(' · ')
  }, [targetRows])
  const draftedCounts = useMemo(() => {
    const counts: Record<PositionFilter, number> = { ALL: 0, RB: 0, WR: 0, QB: 0, TE: 0, K: 0, FX: 0 }
    rows.forEach((row) => {
      if (!drafted.has(rankingId(row))) return
      const positionKey = row.position.toUpperCase() as PositionFilter
      if (positionKey in counts) {
        counts[positionKey] += 1
        counts.ALL += 1
      }
    })
    counts.FX = counts.RB + counts.WR + counts.TE
    return counts
  }, [rows, drafted])
  const positionRows = useMemo(() => sortRankings(filteredRows, 'sourceRank', 'asc'), [filteredRows])
  const visiblePositionRows = useMemo(() => {
    return ['RB', 'WR', 'QB', 'TE', 'K']
      .filter((pos): pos is PositionKey => positionViews.has(pos as PositionKey))
      .flatMap((pos) => positionRows.filter((row) => row.position.toUpperCase() === pos && (showDrafted || !drafted.has(rankingId(row)))))
  }, [positionRows, positionViews, showDrafted, drafted])
  const navigationRows = view === 'board' ? visibleRows : visiblePositionRows
  function yahooProjectionFor(row: RankingRow) {
    return yahooProjections[yahooProjectionId(row.player, row.team)]
  }

  function focusSearchForNextPlayer() {
    searchInputRef.current?.focus()
    searchInputRef.current?.select()
  }

  const applyDraftState = useCallback((nextTargets: Set<string>, nextDrafted: Set<string>, nextPrices = draftPrices, nextSlots = draftSlots, nextMine = mine, nextPicks = draftPicks, record = true) => {
    if (record) {
      const snapshot: DraftSnapshot = { targets: [...nextTargets], drafted: [...nextDrafted], picks: nextPicks, mine: [...nextMine], prices: nextPrices, slots: nextSlots }
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
    setDraftPicks(nextPicks)
  }, [draftPicks, draftPrices, draftSlots, mine])

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
    const nextPicks = { ...draftPicks }
    if (wasDrafted) {
      nextMine.delete(id)
      delete nextPrices[id]
      delete nextSlots[id]
      delete nextPicks[id]
    } else {
      nextPicks[id] = Math.max(0, ...Object.values(nextPicks)) + 1
      const isMyPick = draftMode === 'snake' && Array.from({ length: 17 }, (_, index) => snakePickForSlot(index + 1, draftSlot, draftSize)).includes(nextPicks[id])
      if (isMyPick) {
        nextMine.add(id)
        const row = rows.find((candidate) => rankingId(candidate) === id)
        if (row) nextSlots[id] = autoRosterSlot(row, nextDrafted, draftSlots, targetGoals)
        if (draftMode === 'snake') nextPrices[id] = firstAvailableDraftRound(nextMine, nextPrices)
      }
    }
    applyDraftState(nextTargets, nextDrafted, nextPrices, nextSlots, nextMine, nextPicks)
  }, [applyDraftState, drafted, draftMode, draftPicks, draftPrices, draftSize, draftSlot, draftSlots, mine, rows, targetGoals, targets])

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
      if (row) {
        nextSlots[id] = autoRosterSlot(row, drafted, draftSlots, targetGoals)
        if (draftMode === 'snake') nextPrices[id] = firstAvailableDraftRound(nextMine, nextPrices)
      }
    }
    applyDraftState(new Set(targets), new Set(drafted), nextPrices, nextSlots, nextMine, draftPicks)
  }, [applyDraftState, drafted, draftMode, draftPicks, draftPrices, draftSlots, mine, rows, targetGoals, targets])

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
    applyDraftState(new Set(snapshot.targets), new Set(snapshot.drafted), snapshot.prices, snapshot.slots, new Set(snapshot.mine), snapshot.picks, false)
  }, [applyDraftState])

  useEffect(() => {
    setHydratedStorageKey('')
    const state = readDraftState(storageKey)
    const auctionState = readAuctionDraftState(auctionStorageKey)
    const shared = readDraftShare(new URLSearchParams(window.location.search).get('draft'))
    const initialState = shared?.season === selectedSeason && shared.source === selectedSource ? shared : state
    const initialPicks = Object.keys(initialState.picks ?? {}).length ? initialState.picks : Object.fromEntries(initialState.drafted.map((id, index) => [id, index + 1]))
    const initialMine = new Set(auctionState.mine.filter((id) => initialState.drafted.includes(id)))
    const initialPrices = { ...auctionState.prices }
    if (draftMode === 'snake') {
      initialMine.forEach((id) => {
        if (initialPrices[id] === undefined) initialPrices[id] = firstAvailableDraftRound(initialMine, initialPrices)
      })
    }
    setTargets(new Set(initialState.targets))
    setDrafted(new Set(initialState.drafted))
    setDraftPicks(initialPicks)
    setDraftSize(initialState.draftSize ?? DEFAULT_DRAFT_SIZE)
    setDraftSlot(Math.min(initialState.draftSize ?? DEFAULT_DRAFT_SIZE, initialState.draftSlot ?? DEFAULT_DRAFT_SLOT))
    setMine(initialMine)
    setDraftPrices(initialPrices)
    setDraftSlots(auctionState.slots)
    historyRef.current = [{ targets: [...initialState.targets], drafted: [...initialState.drafted], picks: initialPicks, mine: [...initialMine], prices: initialPrices, slots: auctionState.slots }]
    historyIndexRef.current = 0
    setHydratedStorageKey(storageKey)
  }, [auctionStorageKey, draftMode, selectedSeason, selectedSource, storageKey])

  useEffect(() => {
    setHydratedTargetKey('')
    try {
      const saved = JSON.parse(localStorage.getItem(targetStorageKey) ?? '{}') as Record<string, unknown>
      const next = { ...DEFAULT_ROSTER_TARGETS }
      Object.entries(saved).forEach(([slot, value]) => {
        if (/^(QB|RB|WR|TE|FLEX|BENCH)\d*$/.test(slot) && typeof value === 'number' && Number.isFinite(value)) next[slot] = Math.max(0, value)
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
      const saved = JSON.parse(localStorage.getItem(viewStorageKey) ?? '{}') as Partial<{ search: string; position: PositionFilter; sortKey: SortKey; sortDirection: SortDirection; view: ViewMode; boardPositions: PositionKey[]; positionViews: PositionKey[]; showDrafted: boolean; showTargetQueue: boolean; showDraftLog: boolean; showRosterPanel: boolean; stickyWorkbench: boolean; showMobileActions: boolean; showYahooProjections: boolean; showRegressionDiff: boolean; draftMode: DraftMode }>
      if (typeof saved.search === 'string') setSearch(saved.search)
      if (saved.position && ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'FX'].includes(saved.position)) setPosition(saved.position)
      if (saved.sortKey && ['sourceRank', 'adjustedRank', 'yahooProjection', 'diff', 'regressionDiff'].includes(saved.sortKey)) setSortKey(saved.sortKey)
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
      if (typeof saved.showYahooProjections === 'boolean') setShowYahooProjections(saved.showYahooProjections)
      if (typeof saved.showRegressionDiff === 'boolean') setShowRegressionDiff(saved.showRegressionDiff)
      setDraftMode(selectedSource === 'espn' && (saved.draftMode === 'snake' || saved.draftMode === 'auction') ? saved.draftMode : DEFAULT_DRAFT_MODE)
    } catch { /* Ignore stale or manually edited view preferences. */ }
    setHydratedViewKey(viewStorageKey)
  }, [selectedSource, viewStorageKey])

  useEffect(() => {
    if (hydratedViewKey !== viewStorageKey) return
    localStorage.setItem(viewStorageKey, JSON.stringify({ search, position, sortKey, sortDirection, view, boardPositions: [...boardPositions], positionViews: [...positionViews], showDrafted, showTargetQueue, showDraftLog, showRosterPanel, stickyWorkbench, showMobileActions, showYahooProjections, showRegressionDiff, draftMode }))
  }, [hydratedViewKey, viewStorageKey, search, position, sortKey, sortDirection, view, boardPositions, positionViews, showDrafted, showTargetQueue, showDraftLog, showRosterPanel, stickyWorkbench, showMobileActions, showYahooProjections, showRegressionDiff, draftMode])

  useEffect(() => {
    if (hydratedStorageKey !== storageKey) return
    writeDraftState(storageKey, { targets: [...targets], drafted: [...drafted], picks: draftPicks, draftSlot, draftSize })
  }, [storageKey, hydratedStorageKey, targets, drafted, draftPicks, draftSlot, draftSize])

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
      if (shortcut === 's') {
        event.preventDefault()
        handleSort(sortKey === 'sourceRank' ? 'adjustedRank' : 'sourceRank')
        return
      }
      if (shortcut === 'd') {
        event.preventDefault()
        setShowDrafted((current) => !current)
        return
      }
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
          const visiblePositions = ['RB', 'WR', 'QB', 'TE', 'K'].filter((pos): pos is PositionKey => positionViews.has(pos as PositionKey))
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
        const positionOrder: PositionFilter[] = ['ALL', 'RB', 'WR', 'QB', 'TE', 'K']
        const currentFilter: PositionFilter = boardPositions.size === allPositionKeys.size ? 'ALL' : boardPositions.size === 1 ? [...boardPositions][0] : position
        const currentIndex = Math.max(0, positionOrder.indexOf(currentFilter))
        const nextFilter = positionOrder[(currentIndex + direction + positionOrder.length) % positionOrder.length]
        event.preventDefault()
        handleBoardPosition(nextFilter)
        return
      }
      const positionShortcuts: Record<string, PositionFilter> = { a: 'ALL', q: 'QB', r: 'RB', w: 'WR', t: 'TE', k: 'K', f: 'FX' }
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
          else if (nextPosition === 'FX') setPositionViews(new Set(flexPositionKeys))
          else togglePositionView(nextPosition)
        } else if (nextPosition === 'ALL') {
          setPosition('ALL')
          setBoardPositions(new Set(allPositionKeys))
        } else if (nextPosition === 'FX') {
          setPosition('FX')
          setBoardPositions(new Set(flexPositionKeys))
        } else {
          setPosition(nextPosition)
          setBoardPositions(new Set([nextPosition]))
        }
      }
    }
    document.addEventListener('keydown', handleKeydown)
    return () => document.removeEventListener('keydown', handleKeydown)
  }, [boardPositions, drafted, draftPlayer, handleSort, moveDraftHistory, navigationRows, position, positionViews, selectedId, sortKey, toggleDrafted, toggleMine, toggleTarget, view])

  function handleSeasonFromSettings(nextSeason: number) {
    onSeason(nextSeason)
  }

  function handleSourceFromSettings(nextSource: string) {
    if (nextSource !== 'espn') setDraftMode(DEFAULT_DRAFT_MODE)
    onSource(nextSource)
  }

  function handleDraftModeFromSettings(nextMode: DraftMode) {
    if (selectedSource === 'espn') setDraftMode(nextMode)
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

  function handlePositionViewFilter(value: PositionFilter) {
    if (value === 'ALL') {
      setPosition('ALL')
      setPositionViews(new Set(allPositionKeys))
      return
    }
    if (value === 'FX') {
      setPositionViews(new Set(flexPositionKeys))
      setPosition(value)
      return
    }
    togglePositionView(value)
    setPosition(value)
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
    if (value === 'FX') {
      setBoardPositions(new Set(flexPositionKeys))
      setPosition(value)
      return
    }
    setBoardPositions(new Set([value]))
    setPosition(value)
  }

  function selectOnlyBoardPosition(value: PositionKey) {
    setBoardPositions(new Set([value]))
    setPosition(value)
  }

  function restoreDraft(state: { targets: string[]; drafted: string[]; picks: Record<string, number>; draftSlot: number; draftSize: number; mine: string[]; prices: Record<string, number>; slots: Record<string, string>; targetGoals: Record<string, number> }) {
    applyDraftState(new Set(state.targets), new Set(state.drafted), state.prices, state.slots, new Set(state.mine), state.picks)
    const nextSize = Math.min(MAX_DRAFT_SIZE, Math.max(MIN_DRAFT_SIZE, state.draftSize || DEFAULT_DRAFT_SIZE))
    setDraftSize(nextSize)
    setDraftSlot(Math.min(nextSize, Math.max(1, state.draftSlot || DEFAULT_DRAFT_SLOT)))
    if (Object.keys(state.targetGoals).length) setTargetGoals((current) => ({ ...current, ...state.targetGoals }))
  }

  function updateDraftSize(value: number): void {
    const nextSize = Math.min(MAX_DRAFT_SIZE, Math.max(MIN_DRAFT_SIZE, value))
    setDraftSize(nextSize)
    setDraftSlot((current) => Math.min(current, nextSize))
  }

  function updateDraftPick(id: string, value: number | undefined) {
    setDraftPicks((current) => {
      const next = { ...current }
      if (value === undefined || !Number.isInteger(value) || value < 1) delete next[id]
      else next[id] = value
      return next
    })
  }

  function reorderDraftPicks(fromId: string, toId: string) {
    const ordered = [...drafted]
    const fromIndex = ordered.indexOf(fromId)
    const toIndex = ordered.indexOf(toId)
    if (fromIndex < 0 || toIndex < 0) return
    ordered.splice(fromIndex, 1)
    ordered.splice(toIndex, 0, fromId)
    const nextPicks = Object.fromEntries(ordered.map((id, index) => [id, index + 1]))
    const ownPicks = new Set(Array.from({ length: 17 }, (_, index) => snakePickForSlot(index + 1, draftSlot, draftSize)))
    const nextDrafted = new Set(ordered)
    const nextMine = new Set<string>()
    const nextPrices: Record<string, number> = {}
    const nextSlots: Record<string, string> = {}
    ordered.forEach((id) => {
      if (!ownPicks.has(nextPicks[id])) return
      nextMine.add(id)
      nextPrices[id] = Math.floor((nextPicks[id] - 1) / draftSize) + 1
      const row = rows.find((candidate) => rankingId(candidate) === id)
      if (row) nextSlots[id] = draftSlots[id] ?? autoRosterSlot(row, nextDrafted, nextSlots, targetGoals)
    })
    applyDraftState(new Set(targets), nextDrafted, nextPrices, nextSlots, nextMine, nextPicks)
  }

  function clearDraft() {
    applyDraftState(new Set(), new Set(), {}, {}, new Set(), {})
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

  function updateTargetGoals(next: RosterTargetGoals) {
    const validSlots = new Set(rosterTargetSlots(next))
    setTargetGoals(next)
    setDraftSlots((current) => Object.fromEntries(Object.entries(current).filter(([, slot]) => validSlots.has(slot))))
  }

  const targetQueue = showTargetQueue ? <aside className="target-queue" aria-label="Target queue">
    <div className="target-queue__heading">
      <div><span className="eyebrow">Target queue</span><h2>Shortlist</h2></div>
      <strong>{targetRows.length}</strong>
    </div>
    {targetRows.length ? <p className="target-queue__summary">{targetSummary || 'No position mix yet'} · sorted by {sortKey === 'adjustedRank' ? 'adjusted rank' : sortKey === 'sourceRank' ? 'base rank' : sortKey}</p> : null}
    <div className="target-queue__list">
      {targetRows.slice(0, 12).map((row) => (
        <button type="button" key={rankingId(row)} onClick={() => toggleTarget(rankingId(row))} aria-label={`Remove ${row.player} from queue`}>
          <span className={`target-queue__pos pos-${row.positionTone ?? 'other'}`}>{row.positionRank ?? row.position}</span>
          <span className="target-queue__player">
            <strong>{row.player}</strong>
            <span className="target-queue__details">
              <small aria-label={`${sourceLabel(selectedSource)} and Adjusted rank`}>#{formatRank(row.sourceRank)} → #{formatRank(row.adjustedRank)}</small>
              {selectedSource === 'espn' && draftMode === 'auction' ? <small aria-label="Source and Adjusted salary">{formatValue(row.sourceValue)} → {formatValue(row.adjustedValue)}</small> : <small aria-label="Base and Adjusted draft rank">Draft rank #{formatRank(row.sourceRank)} → #{formatRank(row.adjustedRank)}</small>}
            </span>
          </span>
          <span className="target-queue__diff">{selectedSource === 'espn' ? formatSignedValue(row.diff) : formatRank(row.diff)}</span>
          <span className="target-queue__remove" aria-hidden="true">×</span>
        </button>
      ))}
    </div>
    {!targetRows.length ? <p>Star players to build a shortlist that stays visible while you search and filter.</p> : null}
  </aside> : null

  return (<>
    <main className={`dashboard ${showMobileActions ? '' : 'mobile-actions-hidden'}`} hidden={route === 'analytics'}>
      <section className="hero hero--compact hero--editorial" aria-label="RankingsDiff header">
        <div className="hero__brand">
          <img className="hero__mark" src={withBasePath('/assets/rankingsdiff-mark.png')} alt="RankingsDiff" />
          <div>
            <span className="eyebrow">Fantasy football</span>
            <h1>RankingsDiff</h1>
          </div>
        </div>
        <div className="hero__context">
          <div className="hero__context-actions"><span>Draft board</span><button className="settings-icon-trigger" type="button" onClick={() => setSettingsOpen(true)} aria-label="Settings" aria-haspopup="dialog" title={`${selectedSeason} · ${source?.label ?? selectedSource} · ${visibleRows.length.toLocaleString()} showing`}><img src={withBasePath('/assets/settings.svg')} alt="" aria-hidden="true" /></button></div>
          <div className="hero__context-bottom">
            <div className="view-summary" aria-live="polite">
              <strong>{selectedSeason}</strong> · <strong>{(source?.label ?? selectedSource).replace(/\s+vs\s+Yahoo$/i, '')}</strong> · <strong>{projectionMode === 'half' ? 'Half PPR' : 'Full PPR'}</strong> · <strong>{draftMode === 'auction' ? 'Auction' : 'Snake'}</strong> · <strong>{draftSlot}/{draftSize}</strong>
            </div>
            <button className="analytics-link" type="button" onClick={() => onNavigate('analytics')}>Rankings diff</button>
          </div>
        </div>
      </section>

      <div ref={workbenchRef} className={`dashboard-workbench${stickyWorkbench ? ' dashboard-workbench--sticky' : ''}`}>
      {showDraftLog ? <RecentDraftPanel rows={rows} drafted={drafted} picks={draftPicks} draftSize={draftSize} mine={mine} teams={teams} mode={draftMode} onMine={toggleMine} onUndraft={toggleDrafted} onPick={updateDraftPick} onReorder={reorderDraftPicks} /> : null}

      <section className="search-panel" aria-label="Player search and filters">
        <Filters
          search={search}
          position={position}
          searchInputRef={searchInputRef}
          onSearch={setSearch}
          onPosition={view === 'board' ? handleBoardPosition : handlePositionViewFilter}
          multiSelect
          selectedPositions={view === 'board' ? boardPositions : positionViews}
          showPositions
          onTogglePosition={view === 'board' ? toggleBoardPosition : togglePositionView}
          onSelectOnlyPosition={view === 'board' ? selectOnlyBoardPosition : selectOnlyPosition}
          draftedCounts={draftedCounts}
          compact
        />
        <div className="search-sort-control" aria-label="Sort controls">
          <label htmlFor="search-sort">Sort by</label>
          <span className="search-sort-control__select"><select id="search-sort" value={sortKey} onChange={(event) => handleSort(event.target.value as SortKey)}>
              <option value="sourceRank">Base rank</option>
              <option value="adjustedRank">Adjusted rank</option>
              <option value="yahooProjection">Yahoo projection</option>
              <option value="regressionDiff">Trend</option>
              <option value="diff">Delta</option>
            </select><span className="search-sort-control__chevron" aria-hidden="true">⌄</span></span>
          <button type="button" className="search-sort-direction" onClick={() => setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')} aria-label={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`} title={`Sort ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}>
            {sortDirection === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </section>

      <section className="draft-toolbar" aria-label="Draft board controls">
        <div className="draft-toolbar__actions">
          <label className="drafted-toggle mobile-actions-toggle"><input type="checkbox" aria-label="Show actions" checked={showMobileActions} onChange={(event) => setShowMobileActions(event.target.checked)} /><span>Actions</span></label>
        </div>
      </section>
      </div>

      {view === 'board' ? (
        <div className={`draft-board-layout${showTargetQueue ? '' : ' draft-board-layout--queue-hidden'}${stickyWorkbench ? ' draft-board-layout--sticky-roster' : ''}`} data-roster-visible={showRosterPanel ? 'true' : 'false'}>
          <div>
            <RankingsTable rows={visibleRows} teams={teams} source={selectedSource} sortKey={sortKey} sortDirection={sortDirection} draftSlot={draftSlot} draftSize={draftSize} yahooProjectionMode={projectionMode} showYahooProjections={showYahooProjections} showRegressionDiff={showRegressionDiff} showAuctionValues={draftMode === 'auction'} yahooProjectionFor={yahooProjectionFor} targets={targets} drafted={drafted} mine={mine} selectedId={selectedId} onSelect={setSelectedId} onSort={handleSort} onTarget={toggleTarget} onDrafted={draftPlayer} onMine={toggleMine} stickyHeaders={stickyWorkbench} />
            <section className="cards-list" aria-label="Mobile rankings cards">
              {visibleRows.map((row) => {
                const id = rankingId(row)
                return <RankingCard key={`${row.player}-${row.team}-${row.sourceRank}-card`} row={row} teams={teams} source={selectedSource} sortKey={sortKey === 'adjustedRank' ? 'adjustedRank' : 'sourceRank'} showAuctionValues={draftMode === 'auction'} targeted={targets.has(id)} drafted={drafted.has(id)} mine={mine.has(id)} selected={selectedId === id} onSelect={() => setSelectedId(id)} onTarget={() => toggleTarget(id)} onDrafted={() => draftPlayer(id)} onMine={() => toggleMine(id)} />
              })}
            </section>
          </div>
          <div className="draft-side-stack">{showRosterPanel ? <AuctionRosterPanel rows={rows} teams={teams} targetGoals={targetGoals} drafted={mine} targetRows={targetRows} showTargetQueue={showTargetQueue} mode={draftMode} source={selectedSource as 'espn' | 'fpros'} prices={draftPrices} slots={draftSlots} onPrice={updateDraftPrice} onMoveSlot={moveDraftSlot} onTarget={toggleTarget} /> : targetQueue}</div>
        </div>
      ) : (
        <div className={`draft-board-layout position-view-layout${showTargetQueue ? '' : ' draft-board-layout--queue-hidden'}${stickyWorkbench ? ' draft-board-layout--sticky-roster' : ''}`} data-roster-visible={showRosterPanel ? 'true' : 'false'}>
          <PositionBoard rows={positionRows} positions={positionViews} teams={teams} targets={targets} drafted={drafted} mine={mine} selectedId={selectedId} onSelect={setSelectedId} isEspn={selectedSource === 'espn'} showAuctionValues={draftMode === 'auction'} showDrafted={showDrafted} onTarget={toggleTarget} onDrafted={draftPlayer} onMine={toggleMine} />
          <div className="draft-side-stack">{showRosterPanel ? <AuctionRosterPanel rows={rows} teams={teams} targetGoals={targetGoals} drafted={mine} targetRows={targetRows} showTargetQueue={showTargetQueue} mode={draftMode} source={selectedSource as 'espn' | 'fpros'} prices={draftPrices} slots={draftSlots} onPrice={updateDraftPrice} onMoveSlot={moveDraftSlot} onTarget={toggleTarget} /> : targetQueue}</div>
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
        matchHealth={matchHealth}
        visibleCount={visibleRows.length}
        targetCount={targetRows.length}
        showTargetQueue={showTargetQueue}
        showDrafted={showDrafted}
        showDraftLog={showDraftLog}
        showRosterPanel={showRosterPanel}
        stickyWorkbench={stickyWorkbench}
        showYahooProjections={showYahooProjections}
        showRegressionDiff={showRegressionDiff}
        viewMode={view}
        targets={targets}
        drafted={drafted}
        picks={draftPicks}
        draftSlot={draftSlot}
        draftSize={draftSize}
        mine={mine}
        prices={draftPrices}
        slots={draftSlots}
        targetGoals={targetGoals}
        onRestoreDraft={restoreDraft}
        onClearDraft={clearDraft}
        onShowTargetQueue={setShowTargetQueue}
        onShowDrafted={setShowDrafted}
        onShowDraftLog={setShowDraftLog}
        onShowRosterPanel={setShowRosterPanel}
        onShowStickyWorkbench={setStickyWorkbench}
        onShowYahooProjections={setShowYahooProjections}
        onShowRegressionDiff={setShowRegressionDiff}
        onViewMode={(value) => setView(value)}
        onSeason={handleSeasonFromSettings}
        onSource={handleSourceFromSettings}
        draftMode={draftMode}
        onDraftMode={handleDraftModeFromSettings}
        onTargetGoals={updateTargetGoals}
        onDraftSlot={setDraftSlot}
        onDraftSize={updateDraftSize}
        onClose={() => setSettingsOpen(false)}
      />
    </main>
    <div hidden={route !== 'analytics'}>
      <RankingsDiffChart rows={displayRows} teams={teams} source={selectedSource} drafted={drafted} onBack={() => onNavigate('board')} />
    </div>
  </>)
}
