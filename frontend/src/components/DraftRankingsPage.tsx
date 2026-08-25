import { useMemo, useState } from 'react'
import type { DraftRankingRow } from '../types'
import { ViewTabs } from './ViewTabs'

type SortKey = 'rank' | 'player' | 'position' | 'offer_amount' | 'manager' | 'nfl_team'
type Props = { season: 2022 | 2023 | 2024 | 2025; rows: DraftRankingRow[]; rowsBySeason: Record<number, DraftRankingRow[]>; onNavigate: (path: 'board' | 'analytics' | 'draft') => void }
type HistoricalPosition = 'RB' | 'WR' | 'QB' | 'TE'

const POSITION_ORDER = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'D/ST']
const DRAFT_SIZE = 10
const STORAGE_KEY = 'rankingsdiff:auction-results:v1:2025'
const HISTORIC_LIMITS: Record<HistoricalPosition, number> = { RB: 30, WR: 30, QB: 15, TE: 15 }
const HISTORIC_POSITIONS: HistoricalPosition[] = ['RB', 'WR', 'QB', 'TE']

function rowId(row: DraftRankingRow): string { return `${row.player.toLowerCase()}|${row.nfl_team.toLowerCase()}` }
function money(value: number): string { return `$${value}` }

export function DraftRankingsPage({ season, rows, rowsBySeason, onNavigate }: Props) {
  const [view, setView] = useState<'results' | 'averages'>('results')
  const [averagePosition, setAveragePosition] = useState<HistoricalPosition>('RB')
  const [position, setPosition] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('offer_amount')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [showUndrafted, setShowUndrafted] = useState(true)
  const [drafted, setDrafted] = useState<Set<string>>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(`${STORAGE_KEY}:${season}`) ?? 'null') as string[] | null
      return saved ? new Set(saved) : new Set(rows.map(rowId))
    } catch { return new Set(rows.map(rowId)) }
  })

  function toggleDrafted(row: DraftRankingRow) {
    setDrafted((current) => {
      const next = new Set(current)
      const id = rowId(row)
      if (next.has(id)) next.delete(id); else next.add(id)
      localStorage.setItem(`${STORAGE_KEY}:${season}`, JSON.stringify([...next]))
      return next
    })
  }

  function sortBy(nextKey: SortKey) {
    if (sortKey === nextKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else { setSortKey(nextKey); setSortDirection(nextKey === 'offer_amount' ? 'desc' : 'asc') }
  }

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase()
    const visible = rows.filter((row) => {
      const matchesPosition = position === 'ALL' || row.position.toUpperCase() === position
      const matchesSearch = !query || [row.player, row.manager, row.nfl_team, row.position].some((value) => value.toLowerCase().includes(query))
      const matchesStatus = showUndrafted || drafted.has(rowId(row))
      return matchesPosition && matchesSearch && matchesStatus
    })
    return visible.sort((left, right) => {
      const a = left[sortKey]; const b = right[sortKey]
      const comparison = typeof a === 'number' && typeof b === 'number' ? a - b : String(a).localeCompare(String(b))
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [drafted, position, rows, search, showUndrafted, sortDirection, sortKey])

  const draftedCount = filteredRows.filter((row) => drafted.has(rowId(row))).length
  const undraftedCount = filteredRows.length - draftedCount
  const mostExpensive = useMemo(() => [...rows].sort((a, b) => b.offer_amount - a.offer_amount)[0], [rows])
  const mostExpensiveByPosition = useMemo(() => ['QB', 'RB', 'WR', 'TE', 'K'].map((key) => ({ position: key, row: rows.filter((row) => row.position === key).sort((a, b) => b.offer_amount - a.offer_amount)[0] })).filter((item) => item.row), [rows])
  const averageRows = useMemo(() => {
    const seasons: Array<2022 | 2023 | 2024 | 2025> = [2022, 2023, 2024, 2025]
    const bySeason = new Map<number, DraftRankingRow[]>()
    seasons.forEach((year) => bySeason.set(year, rowsBySeason[year] ?? []))
    return Array.from({ length: HISTORIC_LIMITS[averagePosition] }, (_, index) => {
      const prices = seasons.map((year) => bySeason.get(year)?.filter((row) => row.position === averagePosition).sort((a, b) => b.offer_amount - a.offer_amount)[index]?.offer_amount)
      const present = prices.filter((price): price is number => typeof price === 'number')
      return { rank: index + 1, prices, total: present.reduce((sum, price) => sum + price, 0), average: present.length ? present.reduce((sum, price) => sum + price, 0) / present.length : null }
    }).filter((row) => row.average !== null)
  }, [averagePosition, rowsBySeason])

  return <main className="dashboard draft-rankings-page">
    <section className="hero hero--compact hero--editorial" aria-label="Draft rankings header">
      <div className="hero__brand"><div className="loading-mark draft-rankings-mark" aria-hidden="true"><span>{season}</span></div><div><span className="eyebrow">Auction results</span><h1>{season} Draft</h1><p className="view-summary"><strong>{rows.length}</strong> players · <strong>{new Set(rows.map((row) => row.manager)).size}</strong> managers</p></div></div>
      <div className="hero__context"><ViewTabs active="draft" onNavigate={onNavigate} /></div>
    </section>

    <section className="draft-view-switcher" aria-label="Historic results views"><button type="button" className={view === 'results' ? 'active' : ''} onClick={() => setView('results')}>Player results</button><button type="button" className={view === 'averages' ? 'active' : ''} onClick={() => setView('averages')}>League averages</button></section>

    {view === 'averages' ? <section className="historic-averages" aria-label="League average auction prices">
      <div className="historic-averages__intro"><div><span className="eyebrow">Across 2022–2025</span><h2>League average prices</h2><p>Compare the average auction cost and total spend for each positional slot across the four historical drafts.</p></div><div className="position-pills">{HISTORIC_POSITIONS.map((key) => <button type="button" key={key} className={averagePosition === key ? 'active' : ''} onClick={() => setAveragePosition(key)}>{key} · top {HISTORIC_LIMITS[key]}</button>)}</div></div>
      <div className="table-wrap historic-averages__table-wrap"><table className="rankings-table historic-averages__table"><thead><tr><th>Slot</th><th>Average / year</th><th>Total</th><th>2022</th><th>2023</th><th>2024</th><th>2025</th></tr></thead><tbody>{averageRows.map((row) => <tr key={row.rank}><td><strong>{averagePosition}{row.rank}</strong></td><td className="num"><strong>{row.average === null ? '—' : money(Math.round(row.average))}</strong></td><td className="num">{money(row.total)}</td>{row.prices.map((price, index) => <td className="num" key={`${row.rank}-${index}`}>{price === undefined ? '—' : money(price)}</td>)}</tr>)}</tbody></table></div>
    </section> : <>

    <section className="draft-rankings-summary" aria-label="Draft highlights">
      <article><span className="eyebrow">Most expensive</span><strong>{mostExpensive ? `${mostExpensive.player} · ${money(mostExpensive.offer_amount)}` : '—'}</strong><small>{mostExpensive?.manager ?? ''}</small></article>
      {mostExpensiveByPosition.slice(0, 4).map(({ position: key, row }) => <article key={key}><span className="eyebrow">Top {key}</span><strong>{row.player} · {money(row.offer_amount)}</strong><small>{row.manager}</small></article>)}
    </section>

    <section className="draft-rankings-controls" aria-label="Draft rankings filters">
      <label className="search-field"><span>Search</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player, manager, team…" /></label>
      <div className="draft-position-filter"><span className="filter-label">Position</span><div className="position-pills">{POSITION_ORDER.map((key) => <button type="button" key={key} className={position === key ? 'active' : ''} onClick={() => setPosition(key)}>{key}</button>)}</div></div>
      <label className="drafted-toggle"><input type="checkbox" checked={showUndrafted} onChange={(event) => setShowUndrafted(event.target.checked)} /><span>Show undrafted</span></label>
    </section>

    <section className="draft-rankings-meta" aria-live="polite"><strong>{filteredRows.length}</strong> shown · <strong>{draftedCount}</strong> drafted · <strong>{undraftedCount}</strong> undrafted <span>Lines mark every {DRAFT_SIZE} players in the current view.</span></section>

    <div className="table-wrap draft-rankings-table-wrap"><table className="rankings-table draft-rankings-table"><thead><tr><th><button className="sort-button" onClick={() => sortBy('rank')}>Rank{sortKey === 'rank' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('player')}>Player{sortKey === 'player' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('position')}>Pos{sortKey === 'position' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('manager')}>Manager{sortKey === 'manager' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('offer_amount')}>Offer{sortKey === 'offer_amount' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th>Status</th></tr></thead><tbody>
      {filteredRows.map((row, index) => <>{index > 0 && index % DRAFT_SIZE === 0 ? <tr className="draft-rankings-divider" key={`divider-${index}`}><td colSpan={6}><span>Top {index}</span><small>{filteredRows.slice(0, index).filter((item) => drafted.has(rowId(item))).length} drafted · {index - filteredRows.slice(0, index).filter((item) => drafted.has(rowId(item))).length} undrafted</small></td></tr> : null}<tr className={drafted.has(rowId(row)) ? '' : 'is-undrafted'} key={rowId(row)}><td className="num">{row.rank}</td><td><strong>{row.player}</strong><small className="draft-rankings-team">{row.nfl_team}</small></td><td><span className={`pos-chip pos-${row.position.toLowerCase().replace('/', '-')}`}>{row.position}</span></td><td>{row.manager}</td><td className="num"><strong>{money(row.offer_amount)}</strong></td><td><button type="button" className="draft-status-button" onClick={() => toggleDrafted(row)}>{drafted.has(rowId(row)) ? 'Drafted' : 'Undrafted'}</button></td></tr></>)}
      {!filteredRows.length ? <tr><td colSpan={6}><div className="empty-state">No players match the current filters.</div></td></tr> : null}
    </tbody></table></div></>}
  </main>
}
