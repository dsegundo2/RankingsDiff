import { useMemo, useState } from 'react'
import type { PositionFilter, RankingRow, TeamAsset } from '../types'
import { calculateRegression, formatRank, formatValue, regressionDifference, sourceLabel } from '../data/rankings'
import { getTeamAsset } from '../data/teams'
import { rankingId } from '../data/draftState'
import { TeamBadge } from './TeamBadge'
import { ViewTabs } from './ViewTabs'

type Props = {
  rows: RankingRow[]
  teams: Record<string, TeamAsset>
  source: string
  drafted: Set<string>
  onNavigate: (path: 'board' | 'analytics' | 'draft') => void
  historicOnly?: boolean
}

type WindowOption = { id: string; label: string; start: number; end?: number }
type DisplayMode = 'fade' | 'hide' | 'equal'
type TrendMode = 'uniform' | 'regression'

const positionColors: Record<string, string> = { QB: 'var(--qb)', RB: 'var(--rb)', WR: 'var(--wr)', TE: 'var(--te)' }
const positionOptions: PositionFilter[] = ['ALL', 'QB', 'RB', 'WR', 'TE']
const tickOptions = [10, 12, 24, 36, 48]

function rankMax(rows: RankingRow[]): number {
  const ranks = rows.flatMap((row) => [row.sourceRank, row.adjustedRank]).filter((rank): rank is number => typeof rank === 'number' && Number.isFinite(rank) && rank > 0)
  return Math.max(72, ...ranks)
}

function windowOptions(maxRank: number): WindowOption[] {
  return [
    { id: 'first-100', label: 'Picks 0–100', start: 0, end: 100 },
    { id: '50-150', label: 'Picks 50–150', start: 50, end: 150 },
    { id: '100-200', label: 'Picks 100–200', start: 100, end: 200 },
    { id: 'custom', label: 'Custom range', start: 0, end: 100 },
    { id: 'full', label: 'Full board', start: 0, end: maxRank }
  ]
}

export function RankingsDiffChart({ rows, teams, source, drafted, onNavigate, historicOnly = false }: Props) {
  const maxRank = rankMax(rows)
  const windows = windowOptions(maxRank)
  const [position, setPosition] = useState<PositionFilter>('ALL')
  const [status, setStatus] = useState<'everyone' | 'available' | 'drafted'>('everyone')
  const [range, setRange] = useState(100)
  const [windowId, setWindowId] = useState('first-100')
  const [customStart, setCustomStart] = useState(0)
  const [customEnd, setCustomEnd] = useState(100)
  const [tick, setTick] = useState(12)
  const [trend, setTrend] = useState<TrendMode>('uniform')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('fade')
  const [hoveredId, setHoveredId] = useState<string>('')
  const selectedWindow = windows.find((item) => item.id === windowId) ?? windows[0]
  const activeWindow = windowId === 'custom' ? { ...selectedWindow, start: Math.max(0, customStart), end: Math.max(customStart + 1, customEnd) } : selectedWindow
  const windowEnd = activeWindow.end ?? maxRank
  const windowLabel = windowId === 'custom' ? `Picks ${activeWindow.start}–${windowEnd}` : activeWindow.label

  const chartRows = useMemo(() => {
    const inWindow = rows.filter((row) => {
      const sourceRank = row.sourceRank
      const adjustedRank = row.adjustedRank
      const hasValidRanks = typeof sourceRank === 'number' && Number.isFinite(sourceRank) && sourceRank > 0 && typeof adjustedRank === 'number' && Number.isFinite(adjustedRank) && adjustedRank > 0
      if (!hasValidRanks) return false
      return sourceRank >= activeWindow.start && sourceRank <= windowEnd && adjustedRank >= activeWindow.start && adjustedRank <= windowEnd
    })
    const matching = inWindow.filter((row) => {
      const matchesPosition = position === 'ALL' || row.position.toUpperCase() === position
      const matchesStatus = status === 'everyone' || (drafted.has(rankingId(row)) ? status === 'drafted' : status === 'available')
      return matchesPosition && matchesStatus
    })
    const sorted = matching.sort((a, b) => (a.sourceRank ?? 9999) - (b.sourceRank ?? 9999))
    if (range === 0) return sorted
    if (status === 'drafted') return sorted.slice(0, range)
    return sorted.filter((row) => !drafted.has(rankingId(row))).slice(0, range)
  }, [activeWindow.start, drafted, position, range, rows, status, windowEnd])

  const plot = useMemo(() => {
    const width = 960
    const height = 560
    const left = 70
    const right = 22
    const top = 22
    const bottom = 58
    const x = (value: number) => left + ((value - activeWindow.start) / Math.max(1, windowEnd - activeWindow.start)) * (width - left - right)
    const y = (value: number) => top + (1 - (value - activeWindow.start) / Math.max(1, windowEnd - activeWindow.start)) * (height - top - bottom)
    const firstTick = activeWindow.start === 0 ? 0 : Math.ceil(activeWindow.start / tick) * tick
    const ticks = Array.from({ length: Math.floor((windowEnd - firstTick) / tick) + 1 }, (_, index) => firstTick + index * tick).filter((value) => value <= windowEnd)
    return { width, height, left, right, top, bottom, x, y, ticks }
  }, [activeWindow.start, tick, windowEnd])

  const regression = useMemo(() => calculateRegression(chartRows), [chartRows])

  const trendValue = (value: number) => trend === 'uniform' ? value : regression.slope * value + regression.intercept
  const trendDistance = (row: RankingRow) => {
    if (trend !== 'regression' || typeof row.sourceRank !== 'number' || typeof row.adjustedRank !== 'number') return undefined
    return regressionDifference(row, regression, chartRows)
  }

  const hovered = chartRows.find((row) => `${row.player}|${row.team}` === hoveredId)
  const statusLabel = status === 'everyone' ? 'Everyone' : status === 'available' ? 'Available' : 'Drafted'

  return <main className="rankings-diff-page" aria-label="Rankings diff analytics">
    <header className="rankings-diff-page__header">
      <div>
        <span className="eyebrow">Analytics</span>
        <h1>Rankings diff</h1>
        <p>{sourceLabel(source)} base rank vs. adjusted overall rank</p>
      </div>
      <ViewTabs active="analytics" onNavigate={onNavigate} hideBoard={historicOnly} />
    </header>

    <section className="rankings-diff-controls" aria-label="Rankings diff filters">
      <div className="rankings-diff-controls__row">
        <label>Chart window<select value={windowId} onChange={(event) => setWindowId(event.target.value)}>{windows.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>
        <label>Player range<select value={range} onChange={(event) => setRange(Number(event.target.value))}><option value={10}>Top 10 available</option><option value={20}>Top 20 available</option><option value={50}>Top 50 available</option><option value={100}>Top 100 available</option><option value={0}>Everyone</option></select></label>
        <label>X-axis ticks<select value={tick} onChange={(event) => setTick(Number(event.target.value))}>{tickOptions.map((option) => <option key={option} value={option}>Every {option} ranks</option>)}</select></label>
        <label>Trend line<select value={trend} onChange={(event) => setTrend(event.target.value as TrendMode)}><option value="uniform">Uniform</option><option value="regression">Regression</option></select></label>
      </div>
      {windowId === 'custom' ? <div className="rankings-diff-controls__custom"><label>Start pick<input type="number" min="0" value={customStart} onChange={(event) => setCustomStart(Number(event.target.value) || 0)} /></label><label>End pick<input type="number" min={customStart + 1} value={customEnd} onChange={(event) => setCustomEnd(Number(event.target.value) || customStart + 1)} /></label></div> : null}
      <div className="rankings-diff-controls__row rankings-diff-controls__row--secondary">
        <fieldset><legend>Position</legend><div className="analytics-segmented">{positionOptions.map((option) => <button key={option} type="button" className={position === option ? 'active' : ''} aria-pressed={position === option} onClick={() => setPosition(option)}>{option === 'ALL' ? 'All' : option}</button>)}</div></fieldset>
        <fieldset><legend>Player status</legend><div className="analytics-segmented"><button type="button" className={status === 'everyone' ? 'active' : ''} aria-pressed={status === 'everyone'} onClick={() => setStatus('everyone')}>Everyone</button><button type="button" className={status === 'available' ? 'active' : ''} aria-pressed={status === 'available'} onClick={() => setStatus('available')}>Available</button><button type="button" className={status === 'drafted' ? 'active' : ''} aria-pressed={status === 'drafted'} onClick={() => setStatus('drafted')}>Drafted</button></div></fieldset>
        <fieldset><legend>Drafted display</legend><div className="analytics-segmented"><button type="button" className={displayMode === 'fade' ? 'active' : ''} aria-pressed={displayMode === 'fade'} onClick={() => setDisplayMode('fade')}>Fade</button><button type="button" className={displayMode === 'hide' ? 'active' : ''} aria-pressed={displayMode === 'hide'} onClick={() => setDisplayMode('hide')}>Hide</button><button type="button" className={displayMode === 'equal' ? 'active' : ''} aria-pressed={displayMode === 'equal'} onClick={() => setDisplayMode('equal')}>Equal</button></div></fieldset>
      </div>
    </section>

    <section className="rankings-diff-card">
      <div className="rankings-diff-card__header"><div><h2>Adjusted overall rank</h2><p>Showing {chartRows.length.toLocaleString()} players · {windowLabel} · {statusLabel}</p></div><div className="rankings-diff-legend">{(['QB', 'RB', 'WR', 'TE'] as const).map((item) => <span key={item}><i style={{ background: positionColors[item] }} />{item}</span>)}</div></div>
      <div className="rankings-diff-chart-wrap">
        <svg className="rankings-diff-chart" viewBox={`0 0 ${plot.width} ${plot.height}`} role="img" aria-label="Scatter plot comparing base ranking to adjusted overall ranking">
          {plot.ticks.map((value) => <g key={value}><line className="rankings-diff-grid" x1={plot.x(value)} y1={plot.top} x2={plot.x(value)} y2={plot.height - plot.bottom} /><line className="rankings-diff-grid" x1={plot.left} y1={plot.y(value)} x2={plot.width - plot.right} y2={plot.y(value)} /><text className="rankings-diff-axis" x={plot.x(value)} y={plot.height - 26} textAnchor="middle">{value}</text><text className="rankings-diff-axis" x={plot.left - 12} y={plot.y(value) + 4} textAnchor="end">{value}</text></g>)}
          <line className={`rankings-diff-parity rankings-diff-parity--${trend}`} x1={plot.x(activeWindow.start)} y1={plot.y(trendValue(activeWindow.start))} x2={plot.x(windowEnd)} y2={plot.y(trendValue(windowEnd))} />
          {chartRows.map((row) => {
            const id = `${row.player}|${row.team}`
            const isDrafted = drafted.has(rankingId(row))
            const opacity = isDrafted ? displayMode === 'fade' ? .28 : displayMode === 'hide' ? 0 : 1 : 1
            const distance = trendDistance(row)
            const distanceLabel = typeof distance === 'number' ? `, ${distance >= 0 ? '+' : ''}${distance.toFixed(1)} versus regression` : ''
            return <circle key={id} className="rankings-diff-point" tabIndex={0} aria-label={`${row.player}, ${row.team}, base rank ${formatRank(row.sourceRank)}, adjusted rank ${formatRank(row.adjustedRank)}${distanceLabel}`} cx={plot.x(row.sourceRank ?? activeWindow.start)} cy={plot.y(row.adjustedRank ?? activeWindow.start)} r={hoveredId === id ? 9 : 7} fill={positionColors[row.position.toUpperCase()] ?? 'var(--muted)'} opacity={opacity} onMouseEnter={() => setHoveredId(id)} onMouseLeave={() => setHoveredId('')} onFocus={() => setHoveredId(id)} onBlur={() => setHoveredId('')}><title>{row.player}</title></circle>
          })}
          <text className="rankings-diff-axis-title" x={plot.width / 2} y={plot.height - 4} textAnchor="middle">Base ranking ({sourceLabel(source)})</text>
          <text className="rankings-diff-axis-title" transform={`translate(14 ${plot.height / 2}) rotate(-90)`} textAnchor="middle">Adjusted overall rank <tspan className="rankings-diff-better">← better</tspan></text>
        </svg>
        {hovered ? <div className="rankings-diff-tooltip" role="status"><div className="rankings-diff-tooltip__title"><TeamBadge team={hovered.team} asset={getTeamAsset(teams, hovered.team)} /><strong>{hovered.player}</strong><span className={`rankings-diff-status rankings-diff-status--${drafted.has(rankingId(hovered)) ? 'drafted' : 'available'}`}>{drafted.has(rankingId(hovered)) ? 'Drafted' : 'Available'}</span></div><p>{hovered.position.toUpperCase()} · Base #{formatRank(hovered.sourceRank)} · Adjusted #{formatRank(hovered.adjustedRank)}</p><p>{formatValue(hovered.sourceValue)} source · {formatValue(hovered.adjustedValue)} adjusted</p>{typeof trendDistance(hovered) === 'number' ? <p className="rankings-diff-tooltip__trend">{trendDistance(hovered)! >= 0 ? '+' : ''}{trendDistance(hovered)!.toFixed(1)} Trend · {trendDistance(hovered)! >= 0 ? 'above' : 'below'} line</p> : null}</div> : null}
      </div>
    </section>
  </main>
}
