import { useState } from 'react'

type DividerStyle = 'orange-solid' | 'orange-outline' | 'orange-line' | 'neutral'

const styles: Array<{ id: DividerStyle; name: string; description: string }> = [
  { id: 'orange-solid', name: 'Amber solid', description: 'A warm filled pill that makes the next pick easy to spot.' },
  { id: 'orange-outline', name: 'Amber outline', description: 'A lighter orange treatment that stays quiet against the table.' },
  { id: 'orange-line', name: 'Amber rule', description: 'Carries the orange through the line while keeping the pill compact.' },
  { id: 'neutral', name: 'Slate neutral', description: 'The non-orange alternative: restrained and low emphasis.' },
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
  return <div className={`divider-mock__rule divider-mock__rule--${style}`}><span>R2 · Pick 9</span></div>
}

export function DraftDividerMockups() {
  const [selected, setSelected] = useState<DividerStyle>('orange-solid')
  const active = styles.find((style) => style.id === selected) ?? styles[0]
  return <main className="divider-mock-page">
    <div className="divider-mock-page__topbar"><a href="./">← Back to dashboard</a><span>RankingsDiff · table detail study</span><b>HTML mockups</b></div>
    <header className="divider-mock-page__intro"><span className="divider-mock-eyebrow">Focus: next pick pill</span><h1>Give the next pick a warmer signal.</h1><p>Four HTML treatments for the next-pick marker. Three use a restrained orange; one stays neutral so the color choice is easy to compare in context.</p></header>
    <section className="divider-mock-options" aria-label="Divider options">{styles.map((style, index) => <button key={style.id} className={selected === style.id ? 'is-selected' : ''} onClick={() => setSelected(style.id)}><span>0{index + 1}</span><strong>{style.name}</strong><small>{style.description}</small></button>)}</section>
    <section className="divider-mock-browser" aria-label={`${active.name} table preview`}>
      <div className="divider-mock-browser__bar"><i /><i /><i /><span>{active.name} · rankingsdiff</span></div>
      <div className="divider-mock-table"><div className="divider-mock-table__head"><span>Mine</span><span>Player</span><span>Pos</span><span>Rank →</span><span>Delta</span><span>Draft</span></div>{rows.map(([player, team, pos, rank, delta], index) => <div key={player} className="divider-mock-table__row"><span className="divider-mock__star">★</span><div className="divider-mock__player"><strong>{player}</strong><small>{team}</small></div><b className={`divider-mock__pos divider-mock__pos--${pos.toLowerCase()}`}>{pos}</b><strong className="divider-mock__rank">{rank}</strong><strong className={`divider-mock__delta ${delta.startsWith('+') ? 'is-up' : delta.startsWith('-') ? 'is-down' : ''}`}>{delta}</strong><button type="button">Draft</button>{index === 3 ? <Divider style={selected} /> : null}</div>)}</div>
    </section>
    <footer className="divider-mock-page__footer"><strong>Selected: {active.name}</strong><span>{active.description}</span></footer>
  </main>
}
