import { useMemo, useState } from 'react'
import type { DraftRankingRow } from '../types'
import { ViewTabs } from './ViewTabs'
import { enrichDraftRows, slotSummaries, tierSummaries } from '../data/draftAnalytics'

type SortKey = 'rank' | 'player' | 'position' | 'offer_amount' | 'espn_suggested_value' | 'value_diff' | 'manager' | 'nfl_team'
type Props = { season: 2022 | 2023 | 2024 | 2025; rows: DraftRankingRow[]; rowsBySeason: Record<number, DraftRankingRow[]>; onNavigate: (path: 'board' | 'analytics' | 'draft') => void; onSeason: (season: 2022 | 2023 | 2024 | 2025) => void }
type HistoricalPosition = 'RB' | 'WR' | 'QB' | 'TE'

const POSITION_ORDER = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'D/ST']
const DRAFT_SIZE = 10
const HISTORIC_LIMITS: Record<HistoricalPosition, number> = { RB: 30, WR: 30, QB: 15, TE: 15 }
const HISTORIC_POSITIONS: HistoricalPosition[] = ['RB', 'WR', 'QB', 'TE']
const ESPN_REFERENCE_URLS: Record<number, string> = {
  2022: 'https://g.espncdn.com/s/ffldraftkit/22/NFLDK2022_CS_PPR300.pdf',
  2023: 'https://g.espncdn.com/s/ffldraftkit/23/NFL23_CS_PPR300.pdf?adddata=2023CS_PPR300',
  2024: 'https://g.espncdn.com/s/ffldraftkit/24/NFL24_CS_PPR300.pdf?adddata=2024CS_PPR300',
  2025: 'https://g.espncdn.com/s/ffldraftkit/25/NFL25_CS_PPR300.pdf?adddata=2025CS_PPR300'
}

function money(value: number): string { return `$${value}` }
function delta(value: number): string { return `${value > 0 ? '+' : ''}${money(value)}` }

export function DraftRankingsPage({ season, rows, rowsBySeason, onNavigate, onSeason }: Props) {
  const [view, setView] = useState<'results' | 'averages'>('results')
  const [averagePosition, setAveragePosition] = useState<HistoricalPosition>('RB')
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
      const a = left[sortKey]; const b = right[sortKey]
      const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [historicalRows, position, search, sortDirection, sortKey])
  const mostExpensive = useMemo(() => [...rows].sort((a, b) => b.offer_amount - a.offer_amount)[0], [rows])
  const mostExpensiveByPosition = useMemo(() => ['QB', 'RB', 'WR', 'TE', 'K'].map((key) => ({ position: key, row: rows.filter((row) => row.position === key).sort((a, b) => b.offer_amount - a.offer_amount)[0] })).filter((item) => item.row), [rows])
  const slotRows = useMemo(() => slotSummaries(rowsBySeason, averagePosition), [averagePosition, rowsBySeason])
  const tierRows = useMemo(() => tierSummaries(rowsBySeason, averagePosition), [averagePosition, rowsBySeason])
  const sampleSize = slotRows[0]?.sample_size ?? 0

  return <main className="dashboard draft-rankings-page">
    <section className="hero hero--compact hero--editorial" aria-label="Draft rankings header">
      <div className="hero__brand"><div className="loading-mark draft-rankings-mark" aria-hidden="true"><span>{season}</span></div><div><span className="eyebrow">Auction results</span><h1>{season} Draft</h1><p className="view-summary"><strong>{rows.length}</strong> players · <strong>{new Set(rows.map((row) => row.manager)).size}</strong> managers</p></div></div>
      <div className="hero__context"><ViewTabs active="draft" onNavigate={onNavigate} /></div>
    </section>

    <section className="draft-view-switcher" aria-label="Historic results views"><button type="button" className={view === 'results' ? 'active' : ''} onClick={() => setView('results')}>Player results</button><button type="button" className={view === 'averages' ? 'active' : ''} onClick={() => setView('averages')}>League averages</button></section>
    <nav className="historic-season-tabs" aria-label="Draft season">{([2022, 2023, 2024, 2025] as const).map((year) => <button type="button" key={year} className={season === year ? 'active' : ''} aria-current={season === year ? 'page' : undefined} onClick={() => onSeason(year)}>{year}</button>)}</nav>

    {view === 'averages' ? <section className="historic-averages" aria-label="Historical auction price signals">
      <div className="historic-averages__intro"><div><span className="eyebrow">Historical price signals · across 2022–2025</span><h2>League average prices</h2><p>Use the exact positional slot first, then the tier for a steadier read. Over / under is actual paid minus that season’s ESPN expectation.</p></div><div className="position-pills">{HISTORIC_POSITIONS.map((key) => <button type="button" key={key} className={averagePosition === key ? 'active' : ''} onClick={() => setAveragePosition(key)}>{key} · top {HISTORIC_LIMITS[key]}</button>)}</div></div>
      <div className="historic-signal-cards"><article><span className="eyebrow">Tier size</span><strong>6 {averagePosition.toLowerCase()}s</strong><small>10-team default</small></article><article><span className="eyebrow">Sample</span><strong>{sampleSize} seasons</strong><small>2022–2025 · recent weighted</small></article><article><span className="eyebrow">Read first</span><strong>Exact slot</strong><small>Tier smooths noisy years</small></article></div>
      <div className="table-wrap historic-averages__table-wrap"><table className="rankings-table historic-averages__table"><thead><tr><th>Slot / tier</th><th>Avg paid</th><th>Avg expected</th><th>Over / under</th><th>Sample</th><th>Tier avg</th><th>Tier O/U</th><th>Seasons 2022–2025</th></tr></thead><tbody>{slotRows.slice(0, HISTORIC_LIMITS[averagePosition]).map((summary) => { const tier = tierRows.find((item) => summary.rank >= item.start_rank && summary.rank <= item.end_rank); return <tr key={summary.rank}><td><span className="historic-slot-label"><strong>{averagePosition}{summary.rank}</strong><span className="historic-tier-pill">Tier {tier?.rank ?? '—'}</span></span></td><td className="num"><strong>{summary.average_paid === null ? '—' : money(Math.round(summary.average_paid))}</strong></td><td className="num">{summary.average_expected === null ? '—' : money(Math.round(summary.average_expected))}</td><td className={`num draft-value-diff ${summary.average_over_under && summary.average_over_under > 0 ? 'is-over' : summary.average_over_under && summary.average_over_under < 0 ? 'is-under' : ''}`}>{summary.average_over_under === null ? '—' : delta(Math.round(summary.average_over_under))}</td><td className="num">{summary.sample_size}</td><td className="num">{tier?.average_paid === null || !tier ? '—' : money(Math.round(tier.average_paid))}</td><td className={`num draft-value-diff ${tier?.average_over_under && tier.average_over_under > 0 ? 'is-over' : tier?.average_over_under && tier.average_over_under < 0 ? 'is-under' : ''}`}>{tier?.average_over_under == null ? '—' : delta(Math.round(tier.average_over_under))}</td><td className="num">2022–2025</td></tr> })}</tbody></table></div>
    </section> : <>

    <section className="draft-rankings-summary" aria-label="Draft highlights">
      <article><span className="eyebrow">Most expensive</span><strong>{mostExpensive ? `${mostExpensive.player} · ${money(mostExpensive.offer_amount)}` : '—'}</strong><small>{mostExpensive?.manager ?? ''}</small></article>
      {mostExpensiveByPosition.slice(0, 4).map(({ position: key, row }) => <article key={key}><span className="eyebrow">Top {key}</span><strong>{row.player} · {money(row.offer_amount)}</strong><small>{row.manager}</small></article>)}
    </section>

    <section className="draft-rankings-controls" aria-label="Draft rankings filters">
      <label className="search-field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player, manager, team…" /></label>
      <div className="draft-position-filter"><span className="filter-label">Position</span><div className="position-pills">{POSITION_ORDER.map((key) => <button type="button" key={key} className={position === key ? 'active' : ''} onClick={() => setPosition(key)}>{key}</button>)}</div></div>
    </section>

    <section className="draft-rankings-meta" aria-live="polite"><strong>{filteredRows.length}</strong> shown <span>Lines mark every {DRAFT_SIZE} players in the current view.</span></section>

    <div className="table-wrap draft-rankings-table-wrap"><table className="rankings-table draft-rankings-table"><thead><tr><th><button className="sort-button" onClick={() => sortBy('rank')}>Rank{sortKey === 'rank' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('player')}>Player{sortKey === 'player' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('position')}>Pos{sortKey === 'position' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('manager')}>Manager{sortKey === 'manager' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('offer_amount')}>Paid{sortKey === 'offer_amount' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('espn_suggested_value')}>ESPN value / expected{sortKey === 'espn_suggested_value' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('value_diff')}>Over / under{sortKey === 'value_diff' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th>Slot</th><th>Tier</th></tr></thead><tbody>
      {filteredRows.map((row, index) => <>{index > 0 && index % DRAFT_SIZE === 0 ? <tr className="draft-rankings-divider" key={`divider-${index}`}><td colSpan={9}><span>Top {index}</span></td></tr> : null}<tr key={`${row.player}|${row.nfl_team}`}><td className="num">{row.rank}</td><td><strong>{row.player}</strong><small className="draft-rankings-team">{row.nfl_team}</small></td><td><span className={`pos-chip pos-${row.position.toLowerCase().replace('/', '-')}`}>{row.position}</span></td><td>{row.manager}</td><td className="num"><strong>{money(row.offer_amount)}</strong></td><td className="num">{money(row.espn_suggested_value)}</td><td className={`num draft-value-diff ${row.value_diff > 0 ? 'is-over' : row.value_diff < 0 ? 'is-under' : ''}`}><strong>{delta(row.value_diff)}</strong></td><td className="num"><strong>{row.position_rank ? `${row.position}${row.position_rank}` : '—'}</strong></td><td>{row.tier_label}</td></tr></>)}
      {!filteredRows.length ? <tr><td colSpan={9}><div className="empty-state">No players match the current filters.</div></td></tr> : null}
    </tbody></table></div><footer className="draft-reference"><span>Reference: ESPN PPR auction values for {season}</span><a href={ESPN_REFERENCE_URLS[season]} target="_blank" rel="noreferrer">View original ESPN rankings PDF ↗</a></footer></>}
  </main>
}
