import { useState } from 'react'

type DividerStyle = 'quiet' | 'pill' | 'callout'

const styles: Array<{ id: DividerStyle; name: string; description: string }> = [
  { id: 'quiet', name: 'Quiet divider', description: 'A single line with the pick label tucked into the rule.' },
  { id: 'pill', name: 'Pick pill', description: 'A compact labeled marker that is easy to spot while scanning.' },
  { id: 'callout', name: 'Turn callout', description: 'Adds the countdown beside the divider when your turn is close.' },
]

const rows = [
  ['Jahmyr Gibbs', 'DET', 'RB', '1 → 1', '0'],
  ["Ja'Marr Chase", 'CIN', 'WR', '2 → 3', '-1'],
  ['Bijan Robinson', 'ATL', 'RB', '3 → 2', '+1'],
  ['Puka Nacua', 'LAR', 'WR', '4 → 4', '0'],
  ['Amon-Ra St. Brown', 'DET', 'WR', '5 → 7', '-2'],
  ['Jaxon Smith-Njigba', 'SEA', 'WR', '6 → 8', '-2'],
  ['Christian McCaffrey', 'SF', 'RB', '7 → 5', '+2'],
]

function Divider({ style }: { style: DividerStyle }) {
  if (style === 'pill') return <div className="divider-mock__rule divider-mock__rule--pill"><span>Pick 5</span></div>
  if (style === 'callout') return <div className="divider-mock__rule divider-mock__rule--callout"><span>Pick 5</span><strong>3 picks until your turn</strong></div>
  return <div className="divider-mock__rule"><span>Pick 5</span></div>
}

export function DraftDividerMockups() {
  const [selected, setSelected] = useState<DividerStyle>('quiet')
  const active = styles.find((style) => style.id === selected) ?? styles[0]
  return <main className="divider-mock-page">
    <div className="divider-mock-page__topbar"><a href="./">← Back to dashboard</a><span>RankingsDiff · table detail study</span><b>HTML mockups</b></div>
    <header className="divider-mock-page__intro"><span className="divider-mock-eyebrow">Focus: draft spot line</span><h1>Add draft context without adding another column.</h1><p>This is the main RankingsDiff table with a simple horizontal marker inserted between players. It separates draft picks and keeps “3 picks until your turn” close to the data.</p></header>
    <section className="divider-mock-options" aria-label="Divider options">{styles.map((style, index) => <button key={style.id} className={selected === style.id ? 'is-selected' : ''} onClick={() => setSelected(style.id)}><span>0{index + 1}</span><strong>{style.name}</strong><small>{style.description}</small></button>)}</section>
    <section className="divider-mock-browser" aria-label={`${active.name} table preview`}>
      <div className="divider-mock-browser__bar"><i /><i /><i /><span>{active.name} · rankingsdiff</span></div>
      <div className="divider-mock-table"><div className="divider-mock-table__head"><span>Mine</span><span>Player</span><span>Pos</span><span>Rank →</span><span>Delta</span><span>Draft</span></div>{rows.map(([player, team, pos, rank, delta], index) => <div key={player} className="divider-mock-table__row"><span className="divider-mock__star">★</span><div className="divider-mock__player"><strong>{player}</strong><small>{team}</small></div><b className={`divider-mock__pos divider-mock__pos--${pos.toLowerCase()}`}>{pos}</b><strong className="divider-mock__rank">{rank}</strong><strong className={`divider-mock__delta ${delta.startsWith('+') ? 'is-up' : delta.startsWith('-') ? 'is-down' : ''}`}>{delta}</strong><button type="button">Draft</button>{index === 3 ? <Divider style={selected} /> : null}</div>)}</div>
    </section>
    <footer className="divider-mock-page__footer"><strong>Selected: {active.name}</strong><span>{active.description}</span></footer>
  </main>
}
