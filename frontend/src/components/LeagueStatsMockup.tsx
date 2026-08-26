const managerRows = [
  { name: 'Dane', years: ['28.4 · +1.1', '31.6 · +2.4', '29.8 · +0.8', '34.1 · +3.6'], avg: '$30.9', variance: '+$2.3', biggest: 'Christian McCaffrey · $65', positions: ['Lamar Jackson · $41', 'McCaffrey · $65', 'Chase · $41', 'Kelce · $24'] },
  { name: 'Mike', years: ['26.9 · -0.4', '28.7 · -0.5', '32.2 · +3.2', '29.5 · -1.0'], avg: '$29.3', variance: '+$0.7', biggest: 'Davante Adams · $60', positions: ['Hurts · $39', 'Henry · $39', 'Adams · $60', 'Kelce · $38'] },
  { name: 'Jordan', years: ['24.1 · -3.2', '27.8 · -1.4', '25.2 · -3.8', '30.4 · -0.1'], avg: '$26.9', variance: '-$1.7', biggest: 'Josh Allen · $45', positions: ['Allen · $45', 'Breece Hall · $34', 'Lamb · $35', 'Andrews · $22'] },
  { name: 'Sara', years: ['22.8 · -4.5', '24.9 · -4.3', '27.1 · -1.9', '25.6 · -4.9'], avg: '$25.1', variance: '-$3.5', biggest: 'Breece Hall · $42', positions: ['Burrow · $29', 'Hall · $42', 'Wilson · $38', 'LaPorta · $19'] },
]

const positionRows = [
  ['QB', 'qb', '$24.6', '$22.0', '$45', 'Josh Allen', '+$3.2', '17%'],
  ['RB', 'rb', '$27.4', '$25.0', '$65', 'Christian McCaffrey', '+$4.8', '23%'],
  ['WR', 'wr', '$25.8', '$24.0', '$60', 'Davante Adams', '+$2.1', '29%'],
  ['TE', 'te', '$16.3', '$15.0', '$38', 'Travis Kelce', '+$1.6', '9%'],
  ['K', 'k', '$3.1', '$3.0', '$7', 'Justin Tucker', '+$0.4', '4%'],
]

const records = [
  ['Highest purchase', 'Christian McCaffrey', 'RB', 'Dane', '2022', '$65'],
  ['Highest QB purchase', 'Josh Allen', 'QB', 'Jordan', '2023', '$45'],
  ['Highest WR purchase', 'Davante Adams', 'WR', 'Mike', '2022', '$60'],
  ['Highest TE purchase', 'Travis Kelce', 'TE', 'Mike', '2022', '$38'],
]

export function LeagueStatsMockup() {
  return <main className="league-stats-mockup">
    <header className="league-stats-mockup__header"><div><span className="eyebrow">League history · auction room</span><h1>Manager patterns</h1><p>Use your league’s past prices to set expectations before the next nomination.</p></div><div className="league-stats-mockup__context"><span>Comparable seasons</span><strong>2022–2025</strong><small>10 managers · same roster rules</small></div></header>

    <section className="league-stats-mockup__toolbar" aria-label="League stats filters"><strong>All-time view</strong><button type="button" className="active">2022–2025</button><button type="button">All positions</button><span>Prices rounded to the nearest tenth</span></section>

    <section className="league-stats-panel league-stats-panel--manager"><div className="league-stats-panel__heading"><div><span className="eyebrow">Manager spending</span><h2>Who pays a premium?</h2></div><p>Each season shows average price per player · variance versus that season’s league average.</p></div><div className="league-stats-table league-stats-table--manager" role="table" aria-label="Manager spending patterns"><div className="league-stats-table__row league-stats-table__row--head" role="row"><span>Manager</span><span>2022 avg · var</span><span>2023 avg · var</span><span>2024 avg · var</span><span>2025 avg · var</span><span>4-yr avg</span><span>4-yr var</span><span>Biggest purchase</span></div>{managerRows.map((row) => <div className="league-stats-table__row" role="row" key={row.name}><span><b>{row.name}</b><small>position highs below</small></span>{row.years.map((year) => <strong key={year}>{year}</strong>)}<strong>{row.avg}</strong><strong className={row.variance.startsWith('+') ? 'is-positive' : 'is-negative'}>{row.variance}</strong><span>{row.biggest}</span></div>)}</div></section>

    <section className="league-stats-panel league-stats-panel--position"><div className="league-stats-panel__heading"><div><span className="eyebrow">Position market</span><h2>Know the room’s price by position.</h2></div><p>Average paid is the useful baseline; variance shows where the room tends to stretch.</p></div><div className="league-stats-table league-stats-table--position" role="table" aria-label="Position market history"><div className="league-stats-table__row league-stats-table__row--head" role="row"><span>Position</span><span>Avg paid / player</span><span>Median</span><span>Top purchase</span><span>Player</span><span>Variance</span><span>Share of dollars</span></div>{positionRows.map(([position, tone, average, median, top, player, variance, share]) => <div className="league-stats-table__row" role="row" key={position}><span><b className={`league-stats-position league-stats-position--${tone}`}>{position}</b></span><strong>{average}</strong><strong>{median}</strong><strong>{top}</strong><span>{player}</span><strong className="is-positive">{variance}</strong><strong>{share}</strong></div>)}</div></section>

    <div className="league-stats-lower-grid"><section className="league-stats-panel"><div className="league-stats-panel__heading"><div><span className="eyebrow">Position highs by manager</span><h2>Who owns each ceiling?</h2></div><p>Highest paid player each manager bought at every position.</p></div><div className="league-stats-highs">{managerRows.map((row) => <div key={row.name}><strong>{row.name}</strong>{row.positions.map((value, index) => <span key={`${row.name}-${index}`}><small>{['QB', 'RB', 'WR', 'TE'][index]}</small><b>{value}</b></span>)}</div>)}</div></section><section className="league-stats-panel"><div className="league-stats-panel__heading"><div><span className="eyebrow">Historic records</span><h2>Biggest purchases</h2></div></div><div className="league-stats-records">{records.map((record) => <div className="league-stats-record" key={record[0]}><span><small>{record[0]} · {record[4]}</small><b>{record[1]}</b><small>{record[2]} · {record[3]}</small></span><strong>{record[5]}</strong></div>)}</div></section></div>

    <footer className="league-stats-mockup__footer"><span>Mock data for layout exploration.</span><span>Draft use: anchor bids to the position baseline, then adjust for manager premiums.</span></footer>
  </main>
}
