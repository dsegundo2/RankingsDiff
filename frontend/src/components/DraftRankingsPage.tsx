import { useMemo, useState } from 'react'
import type { DraftRankingRow } from '../types'
import { ViewTabs } from './ViewTabs'
import { enrichDraftRows, HISTORICAL_SEASONS, median, overallSummaries, POSITIONS, slotSummaries } from '../data/draftAnalytics'
import type { TeamAsset } from '../types'
import { getTeamAsset, normalizeTeamAbbreviation } from '../data/teams'
import { TeamBadge } from './TeamBadge'
import { withBasePath } from '../data/paths'

type SortKey = 'rank' | 'player' | 'position' | 'offer_amount' | 'espn_suggested_value' | 'value_diff' | 'manager' | 'nfl_team'
type HistoricView = 'players' | 'averages'
type AverageSortKey = 'rank' | 'average_over_under' | 'highest_paid' | 'lowest_paid'
type Props = { season: 2022 | 2023 | 2024 | 2025; rows: DraftRankingRow[]; rowsBySeason: Record<number, DraftRankingRow[]>; teams: Record<string, TeamAsset>; onNavigate: (path: 'board' | 'analytics' | 'draft') => void; onSeason: (season: 2022 | 2023 | 2024 | 2025) => void }

const POSITION_ORDER = ['ALL', 'QB', 'RB', 'WR', 'TE', 'K', 'D/ST']
const DRAFT_SIZE = 10
const ESPN_REFERENCE_URLS: Record<number, string> = {
  2022: 'https://g.espncdn.com/s/ffldraftkit/22/NFLDK2022_CS_PPR300.pdf',
  2023: 'https://g.espncdn.com/s/ffldraftkit/23/NFL23_CS_PPR300.pdf?adddata=2023CS_PPR300',
  2024: 'https://g.espncdn.com/s/ffldraftkit/24/NFL24_CS_PPR300.pdf?adddata=2024CS_PPR300',
  2025: 'https://g.espncdn.com/s/ffldraftkit/25/NFL25_CS_PPR300.pdf?adddata=2025CS_PPR300'
}

function moneyTenth(value: number): string { return `$${Math.abs(value).toFixed(1)}` }
function deltaTenth(value: number): string { return `${value > 0 ? '+' : value < 0 ? '-' : ''}${moneyTenth(value)}` }

function HistoricPlayer({ row, teams, detail }: { row?: DraftRankingRow; teams: Record<string, TeamAsset>; detail?: string }) {
  if (!row) return <>—</>
  const team = normalizeTeamAbbreviation(row.nfl_team)
  return <span className="historic-player"><TeamBadge team={team} asset={getTeamAsset(teams, team)} /><span>{row.player}{detail ? ` · ${detail}` : ''}</span></span>
}

export function DraftRankingsPage({ season, rows, rowsBySeason, teams, onNavigate, onSeason }: Props) {
  const [position, setPosition] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('offer_amount')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [historicView, setHistoricView] = useState<HistoricView>('players')
  const [averageSortKey, setAverageSortKey] = useState<AverageSortKey>('rank')
  const [averageSortDirection, setAverageSortDirection] = useState<'asc' | 'desc'>('asc')
  function sortBy(nextKey: SortKey) {
    if (sortKey === nextKey) setSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else { setSortKey(nextKey); setSortDirection(nextKey === 'offer_amount' || nextKey === 'espn_suggested_value' || nextKey === 'value_diff' ? 'desc' : 'asc') }
  }
  function sortAveragesBy(nextKey: AverageSortKey) {
    if (averageSortKey === nextKey) setAverageSortDirection((current) => current === 'asc' ? 'desc' : 'asc')
    else { setAverageSortKey(nextKey); setAverageSortDirection(nextKey === 'rank' ? 'asc' : 'desc') }
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
  const allDraftRows = useMemo(() => HISTORICAL_SEASONS.flatMap((year) => (rowsBySeason[year] ?? []).map((row) => ({ ...row, season: year }))), [rowsBySeason])
  const managerPatterns = useMemo(() => {
    const leagueByYear = new Map<number, number>()
    HISTORICAL_SEASONS.forEach((year) => { const yearRows = rowsBySeason[year] ?? []; leagueByYear.set(year, yearRows.length ? yearRows.reduce((sum, row) => sum + row.offer_amount, 0) / yearRows.length : 0) })
    return [...new Set(allDraftRows.map((row) => row.manager))].sort().map((manager) => {
      const managerRows = allDraftRows.filter((row) => row.manager === manager)
      const years = HISTORICAL_SEASONS.map((year) => { const values = (rowsBySeason[year] ?? []).filter((row) => row.manager === manager); const average = values.length ? values.reduce((sum, row) => sum + row.offer_amount, 0) / values.length : null; return { year, average, variance: average === null ? null : average - (leagueByYear.get(year) ?? 0) } })
      const average = managerRows.length ? managerRows.reduce((sum, row) => sum + row.offer_amount, 0) / managerRows.length : 0
      const leagueAverage = allDraftRows.length ? allDraftRows.reduce((sum, row) => sum + row.offer_amount, 0) / allDraftRows.length : 0
      const biggest = [...managerRows].sort((left, right) => right.offer_amount - left.offer_amount)[0]
      const highs = Object.fromEntries(POSITIONS.map((position) => { const candidates = managerRows.filter((candidate) => candidate.position.toUpperCase() === position); const highest = Math.max(...candidates.map((candidate) => candidate.offer_amount), -Infinity); return [position, candidates.filter((candidate) => candidate.offer_amount === highest)] })) as Record<string, DraftRankingRow[]>
      return { manager, years, average, variance: average - leagueAverage, biggest, highs }
    })
  }, [allDraftRows, rowsBySeason])
  const positionPatterns = useMemo(() => POSITIONS.map((position) => {
    const values = allDraftRows.filter((row) => row.position.toUpperCase() === position)
    const average = values.length ? values.reduce((sum, row) => sum + row.offer_amount, 0) / values.length : 0
    const leagueAverage = allDraftRows.length ? allDraftRows.reduce((sum, row) => sum + row.offer_amount, 0) / allDraftRows.length : 0
    const totalSpend = allDraftRows.reduce((sum, row) => sum + row.offer_amount, 0)
    const medianPaid = median(values.map((row) => row.offer_amount))
    const highest = [...values].sort((left, right) => right.offer_amount - left.offer_amount)[0]
    const positionSpend = values.reduce((sum, row) => sum + row.offer_amount, 0)
    return { position, average, median: medianPaid, highest, variance: average - leagueAverage, share: totalSpend ? positionSpend / totalSpend : 0 }
  }), [allDraftRows])
  const historicAverages = useMemo(() => position === 'ALL' ? overallSummaries(rowsBySeason, DRAFT_SIZE) : slotSummaries(rowsBySeason, position, DRAFT_SIZE), [position, rowsBySeason])
  const sortedHistoricAverages = useMemo(() => [...historicAverages].sort((left, right) => {
    const a = left[averageSortKey] ?? 0
    const b = right[averageSortKey] ?? 0
    const comparison = a - b
    return averageSortDirection === 'asc' ? comparison : -comparison
  }), [averageSortDirection, averageSortKey, historicAverages])
  const allTimeRecords = useMemo(() => ['ALL', ...POSITIONS].map((key) => {
    const values = allDraftRows.filter((row) => key === 'ALL' || row.position.toUpperCase() === key)
    const row = [...values].sort((left, right) => right.offer_amount - left.offer_amount)[0]
    return { key, row }
  }), [allDraftRows])
  const yearPatterns = useMemo(() => HISTORICAL_SEASONS.map((year, index) => {
    const values = rowsBySeason[year] ?? []
    const average = values.length ? values.reduce((sum, row) => sum + row.offer_amount, 0) / values.length : null
    const previous = index ? rowsBySeason[HISTORICAL_SEASONS[index - 1]] ?? [] : []
    const previousAverage = previous.length ? previous.reduce((sum, row) => sum + row.offer_amount, 0) / previous.length : null
    const biggest = [...values].sort((left, right) => right.offer_amount - left.offer_amount)[0]
    return { year, average, change: average === null || previousAverage === null ? null : average - previousAverage, biggest }
  }), [rowsBySeason])
  const averageLabel = position === 'ALL' ? 'Overall' : position
  const averageMoney = (value: number | null) => value === null ? '—' : `$${value.toFixed(1)}`
  const averageDelta = (value: number | null) => value === null ? '—' : `${value >= 0 ? '+' : '-'}$${Math.abs(value).toFixed(1)}`

  return <main className="dashboard draft-rankings-page">
    <section className="hero hero--compact hero--editorial" aria-label="Draft rankings header">
      <div className="hero__brand"><img className="hero__mark" src={withBasePath('/assets/rankingsdiff-mark.png')} alt="RankingsDiff" /><div><span className="eyebrow">Auction results</span><h1>{season} Draft</h1><p className="view-summary"><strong>{rows.length}</strong> players · <strong>{new Set(rows.map((row) => row.manager)).size}</strong> managers</p></div></div>
      <div className="hero__context"><ViewTabs active="draft" onNavigate={onNavigate} /></div>
    </section>

    <section className="historic-controls" aria-label="Historic results filters">
      <fieldset className="historic-controls__view"><legend>View</legend><div className="historic-view-toggle" role="group" aria-label="Historic results view">
        <button type="button" className={historicView === 'players' ? 'active' : ''} aria-pressed={historicView === 'players'} onClick={() => setHistoricView('players')}>Player results</button>
        <button type="button" className={historicView === 'averages' ? 'active' : ''} aria-pressed={historicView === 'averages'} onClick={() => setHistoricView('averages')}>League averages</button>
      </div></fieldset>
      <label><span>Year</span><select aria-label="Draft season" value={season} onChange={(event) => onSeason(Number(event.target.value) as 2022 | 2023 | 2024 | 2025)}>{([2022, 2023, 2024, 2025] as const).map((year) => <option value={year} key={year}>{year}</option>)}</select></label>
      <label className="historic-controls__search"><span>Search players</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Player, manager, team…" /></label>
      <div className="historic-controls__positions"><span>Position</span><div className="position-pills">{POSITION_ORDER.map((key) => <button type="button" key={key} className={position === key ? 'active' : ''} onClick={() => setPosition(key)}>{key}</button>)}</div></div>
    </section>

    {historicView === 'players' ? <>
    <section className="historic-records" aria-label={`${season} draft records`}><div className="historic-section-heading"><div><span className="eyebrow">{season} season records</span><h2>Biggest purchases</h2></div><span>Prices rounded to the nearest tenth</span></div><div className="historic-records__grid">{[{ label: 'Highest purchase', row: mostExpensive }, ...mostExpensiveByPosition.slice(0, 4).map(({ position: key, row }) => ({ label: `Highest ${key} purchase`, row }))].map(({ label, row }) => <article key={label}><span>{label}</span><strong>{row ? moneyTenth(row.offer_amount) : '—'}</strong><small><HistoricPlayer row={row} teams={teams} detail={row?.manager} /></small></article>)}</div></section>

    </> : null}

    {historicView === 'averages' ? <>
    <section className="historic-averages" aria-label={`${averageLabel} historic draft values`}><div className="historic-averages__intro"><div><span className="eyebrow">Historic comparison · 2022–2025</span><h2>Draft slot values</h2><p>Compare expected value, room tendency, and the observed price range by slot.</p></div><span className="historic-averages__meta">Tier size {6} · sample 4 seasons</span></div><div className="table-wrap historic-averages__table-wrap"><table className="rankings-table historic-averages__table"><thead><tr><th>Slot</th><th className="num">Expected</th>{(['average_over_under', 'highest_paid', 'lowest_paid'] as const).map((key) => <th key={key} className={`num historic-sortable ${averageSortKey === key ? 'is-sorted' : ''}`} role="button" tabIndex={0} aria-sort={averageSortKey === key ? averageSortDirection === 'asc' ? 'ascending' : 'descending' : 'none'} onClick={() => sortAveragesBy(key)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); sortAveragesBy(key) } }}>{key === 'average_over_under' ? 'Over / under' : key === 'highest_paid' ? 'High' : 'Low'}{averageSortKey === key ? ` ${averageSortDirection === 'asc' ? '↑' : '↓'}` : ''}</th>)}</tr></thead><tbody>{sortedHistoricAverages.map((summary) => <tr key={`${summary.position}-${summary.rank}`}><td><strong>{summary.position === 'OVERALL' ? `Overall ${summary.rank}` : `${summary.position}${summary.rank}`}</strong></td><td className="num"><strong>{averageMoney(summary.average_expected)}</strong></td><td className={`num ${summary.average_over_under !== null && summary.average_over_under >= 0 ? 'is-over' : 'is-under'}`}><strong>{averageDelta(summary.average_over_under)}</strong></td><td className="num">{averageMoney(summary.highest_paid)}</td><td className="num">{averageMoney(summary.lowest_paid)}</td></tr>)}</tbody></table></div></section>
    <section className="historic-patterns" aria-label="Year over year auction patterns"><div className="historic-section-heading"><div><span className="eyebrow">Year over year · all positions</span><h2>How the room is moving</h2></div><span>Spend per player and the change from the prior draft.</span></div><div className="table-wrap historic-patterns__table-wrap"><table className="rankings-table historic-patterns__table historic-year-table"><thead><tr><th>Season</th><th className="num">Spend / player</th><th className="num">Change</th><th>Biggest purchase</th></tr></thead><tbody>{yearPatterns.map((pattern) => <tr key={pattern.year}><td><strong>{pattern.year}</strong></td><td className="num"><strong>{averageMoney(pattern.average)}</strong></td><td className={`num ${pattern.change !== null && pattern.change >= 0 ? 'is-over' : 'is-under'}`}><strong>{averageDelta(pattern.change)}</strong></td><td><HistoricPlayer row={pattern.biggest} teams={teams} detail={pattern.biggest ? `${pattern.biggest.manager} · ${moneyTenth(pattern.biggest.offer_amount)}` : undefined} /></td></tr>)}</tbody></table></div></section>
    <section className="historic-patterns" aria-label="All-time historic records"><div className="historic-section-heading"><div><span className="eyebrow">All-time records · 2022–2025</span><h2>Highest purchases ever</h2></div><span>Across every imported auction, not just the selected season.</span></div><div className="historic-records__grid">{allTimeRecords.map(({ key, row }) => <article key={key}><span>{key === 'ALL' ? 'Highest purchase' : `Highest ${key} purchase`}</span><strong>{row ? moneyTenth(row.offer_amount) : '—'}</strong><small><HistoricPlayer row={row} teams={teams} detail={row ? `${row.manager} · ${row.season}` : undefined} /></small></article>)}</div></section>
    <section className="historic-patterns" aria-label="Overall league patterns"><div className="historic-section-heading"><div><span className="eyebrow">Overall league patterns · 2022–2025</span><h2>Manager spending</h2></div><span>Year-by-year spend per player versus that season’s league baseline.</span></div><div className="table-wrap historic-patterns__table-wrap"><table className="rankings-table historic-patterns__table"><thead><tr><th>Manager</th>{HISTORICAL_SEASONS.map((year) => <th className="num" key={year}>{year} spend · var</th>)}<th>Biggest purchase</th></tr></thead><tbody>{managerPatterns.map((pattern) => <tr key={pattern.manager}><td><strong>{pattern.manager}</strong></td>{pattern.years.map((year) => <td className="num" key={year.year}>{year.average === null ? '—' : `${moneyTenth(year.average)} · ${deltaTenth(year.variance ?? 0)}`}</td>)}<td><HistoricPlayer row={pattern.biggest} teams={teams} detail={pattern.biggest ? `${pattern.biggest.manager} · ${moneyTenth(pattern.biggest.offer_amount)}` : undefined} /></td></tr>)}</tbody></table></div></section>

    <section className="historic-patterns" aria-label="Position market patterns"><div className="historic-section-heading"><div><span className="eyebrow">Position market · 2022–2025</span><h2>Position market</h2></div><span>Compare the typical result, ceiling, room variance, and share of spend.</span></div><div className="table-wrap historic-patterns__table-wrap"><table className="rankings-table historic-patterns__table historic-position-table"><thead><tr><th>Position</th><th className="num">Median result</th><th className="num">Highest purchase</th><th>Player · manager</th><th className="num">Vs league</th><th className="num">Share of spend</th></tr></thead><tbody>{positionPatterns.map((pattern) => <tr key={pattern.position}><td><span className={`pos-chip pos-${pattern.position.toLowerCase()}`}>{pattern.position}</span></td><td className="num"><strong>{moneyTenth(pattern.median)}</strong></td><td className="num">{pattern.highest ? moneyTenth(pattern.highest.offer_amount) : '—'}</td><td><HistoricPlayer row={pattern.highest} teams={teams} detail={pattern.highest?.manager} /></td><td className={`num ${pattern.variance >= 0 ? 'is-over' : 'is-under'}`}>{deltaTenth(pattern.variance)}</td><td className="num">{(pattern.share * 100).toFixed(1)}%</td></tr>)}</tbody></table></div></section>

    <section className="historic-patterns" aria-label="Manager position highs"><div className="historic-section-heading"><div><span className="eyebrow">Manager patterns · all years</span><h2>Highest paid player by position</h2></div><span>Ties are shown when managers paid the same top price.</span></div><div className="table-wrap historic-patterns__table-wrap"><table className="rankings-table historic-patterns__table historic-position-table"><thead><tr><th>Manager</th>{POSITIONS.map((position) => <th key={position}>{position}</th>)}</tr></thead><tbody>{managerPatterns.map((pattern) => <tr key={pattern.manager}><td><strong>{pattern.manager}</strong></td>{POSITIONS.map((position) => <td key={position}>{pattern.highs[position].length ? pattern.highs[position].map((row) => <HistoricPlayer key={`${row.player}-${row.offer_amount}`} row={row} teams={teams} detail={moneyTenth(row.offer_amount)} />) : '—'}</td>)}</tr>)}</tbody></table></div></section>

    </> : null}

    {historicView === 'players' ? <section className="draft-rankings-meta" aria-live="polite"><strong>{filteredRows.length}</strong> shown <span>Tier size 6 · sample 4 seasons · lines mark every {DRAFT_SIZE} players.</span></section> : null}

    {historicView === 'players' ? <div className="table-wrap draft-rankings-table-wrap"><table className="rankings-table draft-rankings-table"><thead><tr><th><button className="sort-button" onClick={() => sortBy('rank')}>Rank{sortKey === 'rank' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('player')}>Player{sortKey === 'player' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('position')}>Pos{sortKey === 'position' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('manager')}>Manager{sortKey === 'manager' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('offer_amount')}>Paid{sortKey === 'offer_amount' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('espn_suggested_value')}>ESPN value / expected{sortKey === 'espn_suggested_value' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th><button className="sort-button" onClick={() => sortBy('value_diff')}>Over / under{sortKey === 'value_diff' ? ` ${sortDirection === 'asc' ? '↑' : '↓'}` : ''}</button></th><th>Slot</th></tr></thead><tbody>
      {filteredRows.map((row, index) => <>{index > 0 && index % DRAFT_SIZE === 0 ? <tr className="draft-rankings-divider" key={`divider-${index}`}><td colSpan={8}><span>Top {index}</span></td></tr> : null}<tr key={`${row.player}|${row.nfl_team}`}><td className="num">{row.overall_rank}</td><td><div className="draft-player-cell"><TeamBadge team={normalizeTeamAbbreviation(row.nfl_team)} asset={getTeamAsset(teams, normalizeTeamAbbreviation(row.nfl_team))} /><span><strong>{row.player}</strong></span></div></td><td><span className={`pos-chip pos-${row.position.toLowerCase().replace('/', '-')}`}>{row.position}</span></td><td>{row.manager}</td><td className="num"><strong>{moneyTenth(row.offer_amount)}</strong></td><td className="num">{moneyTenth(row.espn_suggested_value)}</td><td className={`num draft-value-diff ${row.value_diff > 1 ? 'is-over' : row.value_diff < -1 ? 'is-under' : ''}`}><strong>{deltaTenth(row.value_diff)}</strong></td><td className="num"><strong>{row.position_rank ? `${row.position}${row.position_rank}` : '—'}</strong></td></tr></>)}
      {!filteredRows.length ? <tr><td colSpan={8}><div className="empty-state">No players match the current filters.</div></td></tr> : null}
    </tbody></table></div> : null}<footer className="draft-reference"><span>Reference: ESPN PPR auction values for {season}</span><a href={ESPN_REFERENCE_URLS[season]} target="_blank" rel="noreferrer">View original ESPN rankings PDF ↗</a></footer>
  </main>
}
