import { useState } from 'react'

type PaletteId = 'current' | 'classic' | 'contrast' | 'accessible'

const palettes: Array<{ id: PaletteId; name: string; description: string }> = [
  { id: 'current', name: 'Current soft set', description: 'A calm baseline close to the live board, but the lanes are easy to confuse.' },
  { id: 'classic', name: 'Classic field', description: 'Green backs, blue quarterbacks, orange receivers, purple tight ends, and gold kickers.' },
  { id: 'contrast', name: 'High-contrast pop', description: 'A stronger, energetic set that keeps each position distinct at a glance.' },
  { id: 'accessible', name: 'Color-safe signal', description: 'Blue, orange, teal, violet, and mustard with visible text labels.' },
]

const rows = [
  ['Bijan Robinson', 'RB', 'ATL', '2', '4'], ['Amon-Ra St. Brown', 'WR', 'DET', '8', '5'],
  ['Josh Allen', 'QB', 'BUF', '12', '10'], ['Trey McBride', 'TE', 'ARI', '28', '19'], ['Jake Elliott', 'K', 'PHI', '145', '132'],
]

export function PositionColorMockups() {
  const [selected, setSelected] = useState<PaletteId>('contrast')
  const active = palettes.find((palette) => palette.id === selected) ?? palettes[0]
  return <main className="position-color-lab" data-palette={active.id}>
    <div className="position-color-lab__topbar"><a href="./">← Back to dashboard</a><span>Draft Distillery · position color lab</span><b>HTML mockups</b></div>
    <header className="position-color-lab__intro"><span className="position-color-lab__eyebrow">Focus: position identity + compact labels</span><h1>Make the position colors easier to tell apart.</h1><p>These options use the same compact table language as the screenshot. The heading is shortened to <strong>Fav</strong>, while each position keeps its text label for accessibility.</p></header>
    <section className="position-color-lab__options" aria-label="Position color options">{palettes.map((palette, index) => <button key={palette.id} type="button" className={palette.id === selected ? 'is-selected' : ''} onClick={() => setSelected(palette.id)}><span className="position-color-lab__swatches">{['QB', 'RB', 'WR', 'TE', 'K'].map((position) => <i key={position} className={`position-color-lab__swatch--${position.toLowerCase()}`} title={position} />)}</span><small>Option {String(index + 1).padStart(2, '0')}</small><strong>{palette.name}</strong><span>{palette.description}</span></button>)}</section>
    <section className="position-color-lab__browser" aria-label={`${active.name} table preview`}>
      <div className="position-color-lab__browser-bar"><i /><i /><i /><span>{active.name} · rankingsdiff</span></div>
      <div className="position-color-table">
        <div className="position-color-table__head"><span>Player</span><span>Pos</span><span>Delta</span><span>Fav</span><span>Draft</span></div>
        {rows.map(([player, position, team, base, adjusted]) => <div className="position-color-table__row" key={player}><span className="position-color-table__player"><strong>{player}</strong><small>{team} · {base} → {adjusted}</small></span><span className={`position-color-table__position position-color-table__position--${position.toLowerCase()}`}>{position}</span><span className={`position-color-table__delta ${Number(adjusted) > Number(base) ? 'is-down' : 'is-up'}`}>{Number(adjusted) > Number(base) ? '−' : '+'}{Math.abs(Number(adjusted) - Number(base))}</span><button className="position-color-table__fav" type="button" aria-label={`Favorite ${player}`}>★</button><button className="position-color-table__draft" type="button">Draft</button></div>)}
      </div>
    </section>
    <footer className="position-color-lab__footer"><strong>Selected: {active.name}</strong><span>{active.description}</span><span className="position-color-lab__legend">{['QB', 'RB', 'WR', 'TE', 'K'].map((position) => <b key={position}><i className={`position-color-lab__swatch--${position.toLowerCase()}`} />{position}</b>)}</span></footer>
  </main>
}
