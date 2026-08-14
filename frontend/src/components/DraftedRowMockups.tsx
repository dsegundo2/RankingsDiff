import { useState } from 'react'

type Option = { id: string; name: string; description: string; className: string }

const options: Option[] = [
  { id: 'soft', name: 'Soft wash', description: 'Keeps the diff tint, but lowers the drafted row contrast.', className: 'drafted-mock-table--soft' },
  { id: 'muted', name: 'Muted text', description: 'Preserves the row structure while quieting the player details.', className: 'drafted-mock-table--muted' },
  { id: 'opaque', name: 'Opaque slate', description: 'Uses a clear neutral surface so drafted players recede completely.', className: 'drafted-mock-table--opaque' },
  { id: 'compact', name: 'Compact fade', description: 'Dims the row and makes the Undo action the only strong signal.', className: 'drafted-mock-table--compact' }
]

const players = [
  ['Jeremiah Love', 'ARI', 'RB', '13 → 25', '-14', 'drafted'],
  ['Drake London', 'ATL', 'WR', '14 → 20', '-8', 'drafted'],
  ['Ashton Jeanty', 'LV', 'RB', '15 → 16', '-2', 'drafted'],
  ['Rashee Rice', 'KC', 'WR', '16 → 35', '-18', 'available'],
  ['Trey McBride', 'ARI', 'TE', '17 → 41', '-19', 'available'],
  ['Omarion Hampton', 'LAC', 'RB', '18 → 24', '-5', 'available']
]

export function DraftedRowMockups() {
  const [selected, setSelected] = useState('soft')
  const active = options.find((option) => option.id === selected) ?? options[0]
  return <main className="drafted-mock-page">
    <div className="drafted-mock-page__topbar"><a href="./">← Back to dashboard</a><span>RankingsDiff · drafted row study</span><b>HTML mockups</b></div>
    <header className="drafted-mock-page__intro"><span className="drafted-mock-eyebrow">Focus: drafted player treatment</span><h1>Make drafted players quieter, not invisible.</h1><p>Compare four ways to gray out drafted rows while keeping rank movement and the Undo action easy to scan. This is a visual study before adding the treatment as a Display setting.</p></header>
    <section className="drafted-mock-options" aria-label="Drafted row options">{options.map((option, index) => <button key={option.id} className={selected === option.id ? 'is-selected' : ''} onClick={() => setSelected(option.id)}><span>0{index + 1}</span><strong>{option.name}</strong><small>{option.description}</small></button>)}</section>
    <section className="drafted-mock-browser" aria-label={`${active.name} drafted row preview`}>
      <div className="drafted-mock-browser__bar"><i /><i /><i /><span>{active.name} · rankingsdiff</span></div>
      <div className={`drafted-mock-table ${active.className}`}>
        <div className="drafted-mock-table__head"><span>Mine</span><span>Player</span><span>Pos</span><span>Rank →</span><span>Delta</span><span>Draft</span></div>
        {players.map(([player, team, position, rank, delta, state]) => <div className={`drafted-mock-table__row ${state === 'drafted' ? 'is-drafted' : ''}`} key={player}>
          <span className="drafted-mock__mine">{state === 'drafted' ? '+' : '★'}</span>
          <div className="drafted-mock__player"><span className="drafted-mock__badge">{team.slice(0, 2)}</span><span><strong>{player}</strong><small>{team}</small></span></div>
          <span className="drafted-mock__pos">{position}</span><strong className="drafted-mock__rank">{rank}</strong><strong className={`drafted-mock__delta ${delta.startsWith('-') ? 'is-down' : 'is-up'}`}>{delta}</strong><button type="button">{state === 'drafted' ? 'Undo' : 'Draft'}</button>
        </div>)}
      </div>
    </section>
    <footer className="drafted-mock-page__footer"><strong>Selected: {active.name}</strong><span>{active.description}</span></footer>
  </main>
}
