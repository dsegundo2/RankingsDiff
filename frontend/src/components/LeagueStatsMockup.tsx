import { useState } from 'react'

type StatsView = 'overview' | 'records' | 'positions' | 'managers'

const views: Array<{ id: StatsView; label: string; description: string }> = [
  { id: 'overview', label: 'League overview', description: 'A quick read on the league’s spending personality.' },
  { id: 'records', label: 'Historic records', description: 'The biggest purchases and most consistent managers.' },
  { id: 'positions', label: 'Position market', description: 'How the room has valued each position over time.' },
  { id: 'managers', label: 'Manager patterns', description: 'Average spend and roster habits by person.' },
]

const records = [
  ['Christian McCaffrey', 'RB', '$65', 'Dane', '2022', 'League high'],
  ['Davante Adams', 'WR', '$60', 'Mike', '2022', 'League high'],
  ['Josh Allen', 'QB', '$45', 'Jordan', '2023', 'QB high'],
  ['Travis Kelce', 'TE', '$38', 'Mike', '2022', 'TE high'],
]

const positions = [
  { position: 'QB', tone: 'qb', top: '$45', average: '$24', share: '17%', note: 'Premium scarcity' },
  { position: 'RB', tone: 'rb', top: '$65', average: '$27', share: '23%', note: 'Most volatile' },
  { position: 'WR', tone: 'wr', top: '$60', average: '$25', share: '29%', note: 'Deepest market' },
  { position: 'TE', tone: 'te', top: '$38', average: '$16', share: '9%', note: 'Top-heavy' },
]

const managers = [
  ['Dane', '$31.40', '$47', 'RB / WR', '72'],
  ['Mike', '$29.80', '$60', 'WR / TE', '68'],
  ['Jordan', '$27.60', '$45', 'QB / WR', '64'],
  ['Sara', '$24.90', '$35', 'RB / QB', '59'],
]

function money(value: string) { return value }

export function LeagueStatsMockup() {
  const [view, setView] = useState<StatsView>('overview')
  const active = views.find((item) => item.id === view) ?? views[0]

  return <main className="league-stats-mockup">
    <div className="league-stats-mockup__topbar"><a href="./">← Back to dashboard</a><span>RankingsDiff · league stats</span><b>HTML mockup</b></div>
    <header className="league-stats-mockup__hero">
      <div><span className="eyebrow">Historical auction intelligence · 2022–2025</span><h1>See how your league spends.</h1><p>Turn years of draft results into records, market signals, and manager patterns. Everything below is mocked data so we can shape the section before wiring it to the real league history.</p></div>
      <div className="league-stats-mockup__context"><span>Sample</span><strong>4 seasons</strong><small>10 managers · 680 purchases</small></div>
    </header>
    <nav className="league-stats-mockup__tabs" aria-label="League stats views">{views.map((item) => <button key={item.id} type="button" className={view === item.id ? 'active' : ''} onClick={() => setView(item.id)}>{item.label}</button>)}</nav>
    <section className="league-stats-mockup__intro"><div><span className="eyebrow">{active.label}</span><h2>{active.description}</h2></div><div className="league-stats-mockup__filters"><button type="button" className="active">2022–2025</button><button type="button">All managers</button><button type="button">Full league</button></div></section>

    {view === 'overview' ? <>
      <section className="league-stats-kpis" aria-label="League summary"><article><span className="eyebrow">Total auction spend</span><strong>$10,000</strong><small>Across 4 seasons · $2,500 / season</small></article><article><span className="eyebrow">Average winning bid</span><strong>$14.70</strong><small>+6.2% vs 2022 baseline</small></article><article><span className="eyebrow">Highest single bid</span><strong>$65</strong><small>Christian McCaffrey · Dane</small></article><article><span className="eyebrow">Most active manager</span><strong>Dane</strong><small>72 purchases · 10.6% of all buys</small></article></section>
      <div className="league-stats-grid"><section className="league-stats-panel league-stats-panel--trend"><div className="league-stats-panel__heading"><div><span className="eyebrow">Average winning bid</span><h3>Spending has climbed steadily</h3></div><strong>$14.70 <small>+8.4%</small></strong></div><div className="league-stats-chart" aria-label="Average winning bid trend"><div className="league-stats-chart__y"><span>$20</span><span>$15</span><span>$10</span><span>$5</span></div><div className="league-stats-chart__plot"><i style={{ height: '47%' }} /><i style={{ height: '56%' }} /><i style={{ height: '64%' }} /><i style={{ height: '74%' }} /><div className="league-stats-chart__labels"><span>2022</span><span>2023</span><span>2024</span><span>2025</span></div></div></div></section><section className="league-stats-panel"><div className="league-stats-panel__heading"><div><span className="eyebrow">Market concentration</span><h3>Where the dollars go</h3></div></div><div className="league-stats-bars">{positions.map((item) => <div key={item.position}><div><span className={`league-stats-position league-stats-position--${item.tone}`}>{item.position}</span><b>{item.share}</b></div><span className="league-stats-bar"><i style={{ width: item.share }} /></span><small>{item.average} average · {item.note}</small></div>)}</div></section></div>
    </> : null}
    {view === 'records' ? <section className="league-stats-panel league-stats-records"><div className="league-stats-panel__heading"><div><span className="eyebrow">All-time ledger</span><h3>Records worth remembering</h3></div><span className="league-stats-panel__meta">Sorted by paid</span></div><div className="league-stats-records__list">{records.map((record, index) => <div className="league-stats-record" key={record[0]}><strong>{String(index + 1).padStart(2, '0')}</strong><span><b>{record[0]}</b><small>{record[1]} · {record[3]} · {record[4]}</small></span><em>{money(record[2])}</em><small>{record[5]}</small></div>)}</div></section> : null}
    {view === 'positions' ? <section className="league-stats-panel league-stats-position-table"><div className="league-stats-panel__heading"><div><span className="eyebrow">Position economics</span><h3>How much does each position cost?</h3></div><span className="league-stats-panel__meta">Average across all seasons</span></div><div className="league-stats-table" role="table" aria-label="Position market summary"><div className="league-stats-table__row league-stats-table__row--head" role="row"><span>Position</span><span>Top purchase</span><span>Average</span><span>Share of spend</span><span>Signal</span></div>{positions.map((item) => <div className="league-stats-table__row" role="row" key={item.position}><span><b className={`league-stats-position league-stats-position--${item.tone}`}>{item.position}</b></span><strong>{item.top}</strong><strong>{item.average}</strong><strong>{item.share}</strong><span>{item.note}</span></div>)}</div></section> : null}
    {view === 'managers' ? <section className="league-stats-panel league-stats-manager-table"><div className="league-stats-panel__heading"><div><span className="eyebrow">Manager fingerprints</span><h3>Who pays up, and who waits?</h3></div><span className="league-stats-panel__meta">4-season sample</span></div><div className="league-stats-table" role="table" aria-label="Manager spending patterns"><div className="league-stats-table__row league-stats-table__row--head" role="row"><span>Manager</span><span>Avg purchase</span><span>Biggest bid</span><span>Favorite mix</span><span>Purchases</span></div>{managers.map((manager) => <div className="league-stats-table__row" role="row" key={manager[0]}><span><b>{manager[0]}</b></span><strong>{manager[1]}</strong><strong>{manager[2]}</strong><span>{manager[3]}</span><strong>{manager[4]}</strong></div>)}</div></section> : null}
    <footer className="league-stats-mockup__footer"><span><b>Mock data only.</b> Real stats can use the same cards, tables, and chart surfaces.</span><span>Next: decide which records deserve the headline.</span></footer>
  </main>
}
