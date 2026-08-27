import { useState, type CSSProperties } from 'react'

type CutoffView = 'chip' | 'timeline' | 'window' | 'status'

const options: Array<{ id: CutoffView; name: string; description: string }> = [
  { id: 'chip', name: 'Next-pick chip', description: 'The most compact option: one prominent pick number and a small countdown.' },
  { id: 'timeline', name: 'Pick timeline', description: 'Shows where you are between the current pick and your next selection.' },
  { id: 'window', name: 'Draft window', description: 'Pairs the draft spot with the cutoff range so the decision window is explicit.' },
  { id: 'status', name: 'On-the-clock status', description: 'A stronger live-state treatment for an active draft room.' },
]

const players = [
  ['Ja’Marr Chase', '1.06', '1.08', '2'],
  ['Bijan Robinson', '1.07', '1.08', '1'],
  ['CeeDee Lamb', '1.08', '1.10', '2'],
  ['Breece Hall', '1.09', '1.10', '1'],
  ['Malik Nabers', '1.10', '1.12', '2'],
]

function CutoffCell({ view, current, next, away }: { view: CutoffView; current: string; next: string; away: string }) {
  if (view === 'timeline') return <div className="cutoff-mock__timeline"><strong>Pick {next}</strong><span style={{ '--cutoff-progress': `${Math.max(15, 100 - Number(away) * 22)}%` } as CSSProperties}><i /></span><small>{away} {Number(away) === 1 ? 'pick' : 'picks'} away</small></div>
  if (view === 'window') return <div className="cutoff-mock__window"><strong>{current}–{next}</strong><small>draft window</small></div>
  if (view === 'status') return <div className="cutoff-mock__status"><b>ON DECK</b><strong>{next}</strong><small>cutoff · {away} away</small></div>
  return <div className="cutoff-mock__chip"><strong>{next}</strong><span>Next pick</span><small>{away} away</small></div>
}

export function DraftCutoffMockups() {
  const [selected, setSelected] = useState<CutoffView>('chip')
  const active = options.find((option) => option.id === selected) ?? options[0]
  return <main className="cutoff-mock-page">
    <div className="cutoff-mock-page__topbar"><a href="./">← Back to dashboard</a><span>Draft Distillery · draft controls study</span><b>HTML mockups</b></div>
    <header className="cutoff-mock-page__intro"><span className="cutoff-mock-eyebrow">Focus: draft spot → next pick cutoff</span><h1>Keep the next selection visible without adding a heavy column.</h1><p>Four treatments for showing the current draft spot, next pick, and the cutoff between them. The examples keep the information glanceable while the player name remains the main event.</p></header>
    <section className="cutoff-mock-options" aria-label="Draft cutoff options">{options.map((option, index) => <button key={option.id} className={selected === option.id ? 'is-selected' : ''} onClick={() => setSelected(option.id)}><span>0{index + 1}</span><strong>{option.name}</strong><small>{option.description}</small></button>)}</section>
    <section className="cutoff-mock-browser" aria-label={`${active.name} table preview`}>
      <div className="cutoff-mock-browser__bar"><i /><i /><i /><span>{active.name} · rankingsdiff</span></div>
      <div className="cutoff-mock-toolbar"><div><small>Draft room</small><strong>Snake · Round 1</strong></div><div className="cutoff-mock-toolbar__spot"><small>Your spot</small><strong>1.06</strong></div><div className="cutoff-mock-toolbar__next"><small>Next pick cutoff</small><strong>1.08</strong><span>2 picks away</span></div></div>
      <div className="cutoff-mock-table"><div className="cutoff-mock-table__heading"><span>Player</span><span>Draft spot / next pick</span><span>Draft</span></div>{players.map(([player, current, next, away]) => <div className="cutoff-mock-table__row" key={player}><div><strong>{player}</strong><small>WR · available</small></div><CutoffCell view={selected} current={current} next={next} away={away} /><button type="button">Draft</button></div>)}</div>
    </section>
    <footer className="cutoff-mock-page__footer"><strong>Selected: {active.name}</strong><span>{active.description}</span></footer>
  </main>
}
