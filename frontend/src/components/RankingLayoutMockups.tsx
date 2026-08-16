import { useState } from 'react'

type MockupId = 'left' | 'parenthetical' | 'split'

const mockups: Array<{ id: MockupId; number: string; name: string; description: string }> = [
  { id: 'left', number: '01', name: 'Rank first', description: 'Moves rank into the first scan position, then lets the player name lead the row.' },
  { id: 'parenthetical', number: '02', name: 'Base (adjusted)', description: 'Keeps the base rank prominent and puts the adjusted rank in parentheses for compact comparison.' },
  { id: 'split', number: '03', name: 'Rank rail', description: 'Uses a small two-line rank rail so the change is visible without widening the player column.' },
]

const players = [
  { rank: '1', adjusted: '1', name: 'Ja’Marr Chase', team: 'CIN', pos: 'WR', delta: '0' },
  { rank: '2', adjusted: '3', name: 'Bijan Robinson', team: 'ATL', pos: 'RB', delta: '-1' },
  { rank: '3', adjusted: '2', name: 'CeeDee Lamb', team: 'DAL', pos: 'WR', delta: '+1' },
  { rank: '4', adjusted: '6', name: 'Breece Hall', team: 'NYJ', pos: 'RB', delta: '-2' },
]

function Brand() {
  return <div className="ranking-layout-mock__brand"><img src="/assets/rankingsdiff-mark.png" alt="RankingsDiff" /><span><strong>RankingsDiff</strong><small>Fantasy football command center</small></span></div>
}

function Rank({ variant, rank, adjusted }: { variant: MockupId; rank: string; adjusted: string }) {
  if (variant === 'parenthetical') return <span className="ranking-layout-mock__parenthetical"><strong>{rank}</strong> <small>({adjusted})</small></span>
  if (variant === 'split') return <span className="ranking-layout-mock__split-rank"><strong>{rank}</strong><small>Adj. {adjusted}</small></span>
  return <span className="ranking-layout-mock__single-rank">{rank}</span>
}

function PlayerRows({ variant }: { variant: MockupId }) {
  return <div className={`ranking-layout-mock__table ranking-layout-mock__table--${variant}`}>
    <div className="ranking-layout-mock__head"><span>Rank</span><span>Player</span><span>Pos</span><span>Δ</span><span>Favorite</span><span>Drafted</span></div>
    {players.map((player, index) => <div className="ranking-layout-mock__row" key={player.name}>
      <Rank variant={variant} rank={player.rank} adjusted={player.adjusted} />
      <div className="ranking-layout-mock__player"><span className="ranking-layout-mock__avatar">{player.team}</span><span><strong>{player.name}</strong><small>{player.team} · 2025 rankings</small></span></div>
      <span className={`ranking-layout-mock__pos ranking-layout-mock__pos--${player.pos.toLowerCase()}`}>{player.pos}</span>
      <strong className={`ranking-layout-mock__delta ${player.delta.startsWith('+') ? 'is-up' : player.delta.startsWith('-') ? 'is-down' : 'is-even'}`}>{player.delta}</strong>
      <button className="ranking-layout-mock__favorite" type="button" aria-label={`Favorite ${player.name}`}>{index === 1 ? '★' : '☆'}</button>
      <button className="ranking-layout-mock__draft" type="button">{index === 2 ? 'Undo' : 'Draft'}</button>
    </div>)}
  </div>
}

export function RankingLayoutMockups() {
  const [selected, setSelected] = useState<MockupId>('parenthetical')
  const active = mockups.find((mockup) => mockup.id === selected) ?? mockups[1]
  return <main className="ranking-layout-mock">
    <div className="ranking-layout-mock__topbar"><a href="./">← Back to dashboard</a><span>RankingsDiff · ranking layout study</span><b>Blue theme exploration</b></div>
    <header className="ranking-layout-mock__intro"><div><span className="ranking-layout-mock__eyebrow">Three directions</span><h1>Put the rank where your eye lands first.</h1><p>Each mockup moves Favorite beside Draft and replaces the RD mark with the supplied football ranking artwork. The blue palette keeps the data surface focused and professional.</p></div><div className="ranking-layout-mock__selected"><span>Selected preview</span><strong>{active.number} · {active.name}</strong><small>{active.description}</small></div></header>
    <nav className="ranking-layout-mock__options" aria-label="Ranking layout options">{mockups.map((mockup) => <button type="button" key={mockup.id} className={selected === mockup.id ? 'is-selected' : ''} onClick={() => setSelected(mockup.id)}><span>{mockup.number}</span><strong>{mockup.name}</strong><small>{mockup.description}</small></button>)}</nav>
    <section className="ranking-layout-mock__showcase" aria-label="Ranking layout mockups">
      {mockups.map((mockup) => <article key={mockup.id} className={`ranking-layout-mock__browser ${selected === mockup.id ? 'is-selected' : ''}`}>
        <div className="ranking-layout-mock__browser-bar"><i /><i /><i /><span>{mockup.number} · {mockup.name}</span></div>
        <div className="ranking-layout-mock__board"><header><Brand /><div><span>2025 · Full PPR</span><strong>Draft board</strong></div><button type="button" aria-label="Open settings">⚙</button></header><div className="ranking-layout-mock__summary"><div><span className="ranking-layout-mock__eyebrow">Rankings board</span><h2>{mockup.name}</h2></div><strong>248 <small>players</small></strong><strong>12 <small>favorites</small></strong></div><PlayerRows variant={mockup.id} /></div>
        <footer><strong>{mockup.number} · {mockup.name}</strong><span>{mockup.description}</span></footer>
      </article>)}
    </section>
    <p className="ranking-layout-mock__legend"><span>★</span> Favorite is intentionally adjacent to Draft in all three directions. Parenthetical rank uses <strong>base rank (adjusted rank)</strong>.</p>
  </main>
}
