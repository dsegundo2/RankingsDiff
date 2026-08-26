import { useMemo, useState } from 'react'
import type { DraftRankingRow } from '../types'
import { ViewTabs } from './ViewTabs'
import { enrichDraftRows, overallSummaries, slotSummaries } from '../data/draftAnalytics'
import type { TeamAsset } from '../types'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'
import { withBasePath } from '../data/paths'

type SortKey = 'rank' | 'player' | 'position' | 'offer_amount' | 'espn_suggested_value' | 'value_diff' | 'manager' | 'nfl_team'
type Props = { season: 2022 | 2023 | 2024 | 2025; rows: DraftRankingRow[]; rowsBySeason: Record<number, DraftRankingRow[]>; teams: Record<string, TeamAsset>; onNavigate: (path: 'board' | 'analytics' | 'draft') => void; onSeason: (season: 2022 | 2023 | 2024 | 2025) => void }
type HistoricalPosition = 'OVERALL' | 'RB' | 'WR' | 'QB' | 'TE'
type AverageSortKey = 'rank' | 'average_paid' | 'average_over_under'

const POSITION_ORDER = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'D/ST']
const DRAFT_SIZE = 10
const HISTORIC_LIMITS: Record<HistoricalPosition, number> = { OVERALL: 100, RB: 30, WR: 30, QB: 15, TE: 15 }
const HISTORIC_POSITIONS: HistoricalPosition[] = ['OVERALL', 'RB', 'WR', 'QB', 'TE']
const ESPN_REFERENCE_URLS: Record<number, string> = {
  2022: 'https://g.espncdn.com/s/ffldraftkit/22/NFLDK2022_CS_PPR300.pdf',
  2023: 'https://g.espncdn.com/s/ffldraftkit/23/NFL23_CS_PPR300.pdf?adddata=2023CS_PPR300',
  2024: 'https://g.espncdn.com/s/ffldraftkit/24/NFL24_CS_PPR300.pdf?adddata=2024CS_PPR300',
  2025: 'https://g.espncdn.com/s/ffldraftkit/25/NFL25_CS_PPR300.pdf?adddata=2025CS_PPR300'
}

function money(value: number): string { return `$${value}` }
function delta(value: number): string { return `${value > 0 ? '+' : ''}${money(value)}` }

export function DraftRankingsPage({ season, rows, rowsBySeason, teams, onNavigate, onSeason }: Props) {
  const [view, setView] = useState<'results' | 'averages'>('results')
  const [averagePosition, setAveragePosition] = useState<HistoricalPosition>('RB')
  const [averageSortKey, setAverageSortKey] = useState<AverageSortKey>('rank')
  const [averageSortDirection, setAverageSortDirection] = useState<'asc' | 'desc'>('asc')
  const [position, setPosition] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('offer_amount')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  function sortBy(nextKey: SortKey) {
    if (sortKey === nextKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else { setSortKey(nextKey); setSortDirection(nextKey === 'offer_amount' || nextKey === 'espn_suggested_value' || nextKey === 'value_diff' ? 'desc' : 'asc') }
  }

  const historicalRows = useMemo(() => enrichDraftRows(rows), [rows])
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const visible = historicalRows.filter((row) => {
      const matchesPosition = position === 'ALL' || row.position.toUpperCase() === position
      const matchesSearch = !query || [row.player, row.manager, row.nfl_team, row.position].some((value) => value.toLowerCase().includes(query))
      return matchesPosition && matchesSearch
    })
    return visible.sort((left, right) => {
      // The table displays the paid-order rank calculated by enrichDraftRows.
      // `rank` is the source row order and is not necessarily the same value.
      const a = sortKey === 'rank' ? left.overall_rank : left[sortKey]
      const b = sortKey === 'rank' ? right.overall_rank : right[sortKey]
      const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [historicalRows, position, search, sortDirection, sortKey])
  const mostExpensive = useMemo(() => [...rows].sort((a, b) => b.offer_amount - a.offer_amount)[0], [rows])
  const mostExpensiveByPosition = useMemo(() => ['QB', 'RB', 'WR', 'TE', 'K'].map((key) => ({ position: key, row: rows.filter((row) => row.position === key).sort((a, b) => b.offer_amount - a.offer_amount)[0] })).filter((item) => item.row), [rows])
  const slotRows = useMemo(() => averagePosition === 'OVERALL' ? overallSummaries(rowsBySeason) : slotSummaries(rowsBySeason, averagePosition), [averagePosition, rowsBySeason])
  const sortedSlotRows = useMemo(() => [...slotRows].sort((left, right) => {
    const leftValue = left[averageSortKey] ?? Number.NEGATIVE_INFINITY
    const rightValue = right[averageSortKey] ?? Number.NEGATIVE_INFINITY
    return (Number(leftValue) - Number(rightValue)) * (averageSortDirection === 'asc' ? 1 : -1)
  }), [averageSortDirection, averageSortKey, slotRows])
  function sortAverageBy(key: AverageSortKey) {
    if (averageSortKey === key) setAverageSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else { setAverageSortKey(key); setAverageSortDirection(key === 'rank' ? 'asc' : 'desc') }
  }
  function averageSortLabel(key: AverageSortKey): string { return averageSortKey === key ? (averageSortDirection === 'asc' ? ' ↑' : ' ↓') : '' }

  return <main className="dashboard draft-rankings-page">
    <section className="hero hero--compact hero--editorial" aria-label="Draft rankings header">
      <div className="hero__brand"><img className="hero__mark" src={withBasePath('/assets/rankingsdiff-mark.png')} alt="RankingsDiff" /><div><span className="eyebrow">Auction results</span><h1>{season} Draft</h1><p className="view-summary"><strong>{rows.length}</strong> players · <strong>{new Set(rows.map((row) => row.manager)).size}</strong> managers</p></div></div>
      <div className="hero__context"><ViewTabs active="draft" onNavigate={onNavigate} /></div>
    </section>

    <section className="historic-controls" aria-label="Historic results filters">
      <label><span>View</span><select aria-label="Historic results view" value={view} onChange={(event) => setView(event.target.value as 'results' | 'averages')}><option value="results">Player results</option><option value="averages">League averages</option></select></label>
      <label><span>Year</span><select aria-label="Draft season" value={season} onChange={(event) => onSeason(Number(event.target.value) as 2022 | 2023 | 2024 | 2025)}>{([2022, 2023, 2024, 2025] as const).map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
      {view === 'results' ? <><label className="historic-controls__search"><span>Search players</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player, manager, team…" /></label><div className="historic-controls__positions"><span>Position</span><div className="position-pills">{POSITION_ORDER.map((key) => <button type="button" key={key} className={position === key ? 'active' : ''} onClick={() => setPosition(key)}>{key}</button>)}</div></div></> : <label><span>Position</span><select aria-label="Average position" value={averagePosition} onChange={(event) => setAveragePosition(event.target.value as HistoricalPosition)}>{HISTORIC_POSITIONS.map((key) => <option value={key} key={key}>{key === 'OVERALL' ? 'Overall' : key} · top {HISTORIC_LIMITS[key]}</option>)}</select></label>}
    </section>

    {view === 'averages' ? <section className="historic-averages" aria-label="Historical auction price signals">
      <div className="historic-averages__intro"><div><h2>League average prices</h2><span className="historic-averages__meta">Tier size 6 · sample {slotRows[0]?.sample_size ?? 0} seasons</span></div></div>
      <div className="table-wrap historic-averages__table-wrap"><table className="rankings-table historic-averages__table"><thead><tr><th><button type="button" onClick={() => sortAverageBy('rank')}>Slot{averageSortLabel('rank')}</button></th><th><button type="button" onClick={() => sortAverageBy('average_paid')}>Avg paid{averageSortLabel('average_paid')}</button></th><th>Avg expected</th><th><button type="button" onClick={() => sortAverageBy('average_over_under')}>Over / under{averageSortLabel('average_over_under')}</button></th><th>Highest paid</th><th>Lowest paid</th></tr></thead><tbody>{sortedSlotRows.slice(0, HISTORIC_LIMITS[averagePosition]).map((summary, index) => { const tierBreak = averageSortKey === 'rank' && (index === 0 || index % 10 === 0); return <tr className={tierBreak ? "historic-tier-start" : undefined} key={summary.rank}><td><strong>{averagePosition === 'OVERALL' ? `Overall ${summary.rank}` : `${averagePosition}${summary.rank}`}</strong></td><td className="num"><strong>{summary.average_paid === null ? '—' : money(Math.round(summary.average_paid))}</strong></td><td className="num">{summary.average_expected === null ? '—' : money(Math.round(summary.average_expected))}</td><td className={`num draft-value-diff ${summary.average_over_under && summary.average_over_under > 1 ? 'is-over' : summary.average_over_under && summary.average_over_under < -1 ? 'is-under' : ''}`}>{summary.average_over_under === null ? '—' : delta(Math.round(summary.average_over_under))}</td><td className="num">{summary.highest_paid === null ? '—' : money(summary.highest_paid)}</td><td className="num">{summary.lowest_paid === null ? '—' : money(summary.lowest_paid)}</td></tr> })}</tbody></table></div>
    </section> : <>

    <section className="draft-rankings-summary" aria-label="Draft highlights">
      <article><span className="eyebrow">Most expensive</span><strong>{mostExpensive ? `${mostExpensive.player} · ${money(mostExpensive.offer_amount)}` : '—'}</strong><small>{mostExpensive?.manager ?? ''}</small></article>
      {mostExpensiveByPosition.slice(0, 4).map(({ position: key, row }) => <article key={key}><span className="eyebrow">Top {key}</span><strong>{row.player} · {money(row.offer_amount)}</strong><small>{row.manager}</small></article>)}
    </section>

    <section className="draft-rankings-meta" aria-live="polite"><strong>{filteredRows.length}</strong> shown <span>Tier size 6 · sample 4 seasons · lines mark every {DRAFT_SIZE} players.</span></section>

    <div className="table-wrap draft-rankings-table-wrap"><table className="rankings-table draft-rankings-table"><thead><tr><th><button className="sort-button" onClick={() => sortBy('rank')}>Rank{sortKey === 'rank' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('player')}>Player{sortKey === 'player' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('position')}>Pos{sortKey === 'position' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('manager')}>Manager{sortKey === 'manager' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('offer_amount')}>Paid{sortKey === 'offer_amount' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('espn_suggested_value')}>ESPN value / expected{sortKey === 'espn_suggested_value' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('value_diff')}>Over / under{sortKey === 'value_diff' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th>Slot</th></tr></thead><tbody>
      {filteredRows.map((row, index) => <>{index > 0 && index % DRAFT_SIZE === 0 ? <tr className="draft-rankings-divider" key={`divider-${index}`}><td colSpan={8}><span>Top {index}</span></td></tr> : null}<tr key={`${row.player}|${row.nfl_team}`}><td className="num">{row.overall_rank}</td><td><div className="draft-player-cell"><TeamBadge team={normalizeTeamAbbreviation(row.nfl_team)} asset={getTeamAsset(teams, normalizeTeamAbbreviation(row.nfl_team))} /><span><strong>{row.player}</strong></span></div></td><td><span className={`pos-chip pos-${row.position.toLowerCase().replace('/', '-')}`}>{row.position}</span></td><td>{row.manager}</td><td className="num"><strong>{money(row.offer_amount)}</strong></td><td className="num">{money(row.espn_suggested_value)}</td><td className={`num draft-value-diff ${row.value_diff > 1 ? 'is-over' : row.value_diff < -1 ? 'is-under' : ''}`}><strong>{delta(row.value_diff)}</strong></td><td className="num"><strong>{row.position_rank ? `${row.position}${row.position_rank}` : '—'}</strong></td></tr></>)}
      {!filteredRows.length ? <tr><td colSpan={8}><div className="empty-state">No players match the current filters.</div></td></tr> : null}
    </tbody></table></div><footer className="draft-reference"><span>Reference: ESPN PPR auction values for {season}</span><a href={ESPN_REFERENCE_URLS[season]} target="_blank" rel="noreferrer">View original ESPN rankings PDF ↗</a></footer></>}
  </main>
}
