import { useState, type CSSProperties } from 'react'

type ViewId = 'pair' | 'movement' | 'stacked' | 'ladder'

const views: Array<{ id: ViewId; name: string; description: string }> = [
  { id: 'pair', name: 'Compact pair', description: 'Keeps both ranks prominent while making the relationship read as one unit.' },
  { id: 'movement', name: 'Movement signal', description: 'Makes the change the headline and keeps the two rank values as supporting context.' },
  { id: 'stacked', name: 'Stacked compare', description: 'Separates Source and Adjusted for the clearest mobile-friendly scan.' },
  { id: 'ladder', name: 'Rank ladder', description: 'Uses a tiny visual track to show direction without relying on color alone.' },
]

const rows = [
  ['1', '1', '0'], ['2', '3', '-1'], ['3', '2', '+1'], ['4', '4', '0'], ['5', '7', '-2'], ['6', '8', '-2'], ['7', '5', '+2'], ['8', '10', '-2'], ['9', '13', '-4'], ['10', '6', '+4'], ['11', '19', '-8'],
]

function RankCell({ view, source, adjusted, delta }: { view: ViewId; source: string; adjusted: string; delta: string }) {
  const isUp = delta.startsWith('+')
  const isNeutral = delta === '0'
  if (view === 'movement') return <div className={`column-mock__movement ${isUp ? 'is-up' : isNeutral ? 'is-neutral' : 'is-down'}`}><strong>{isNeutral ? '—' : isUp ? '↑' : '↓'} {isNeutral ? 'Even' : `${Math.abs(Number(delta))} ${Math.abs(Number(delta)) === 1 ? 'spot' : 'spots'}`}</strong><small>{source} → {adjusted}</small></div>
  if (view === 'stacked') return <div className="column-mock__stacked"><span><small>Source</small><b>{source}</b></span><span><small>Adjusted</small><b>{adjusted}</b></span></div>
  if (view === 'ladder') return <div className="column-mock__ladder"><span className="column-mock__ladder-track" style={{ '--rank-start': `${Number(source) * 4.6}%`, '--rank-end': `${Number(adjusted) * 4.6}%` } as CSSProperties}><i /></span><small>{source} → {adjusted}</small></div>
  return <div className="column-mock__pair"><strong>{source}</strong><span aria-hidden="true">→</span><strong>{adjusted}</strong></div>
}

export function ColumnMockups() {
  const [selected, setSelected] = useState<ViewId>('movement')
  const active = views.find((view) => view.id === selected) ?? views[0]
  return <main className="column-mock-page">
    <div className="column-mock-page__topbar"><a href="./">← Back to dashboard</a><span>Draft Distillery · column study</span><b>HTML mockups</b></div>
    <header className="column-mock-page__intro"><span className="column-mock-eyebrow">Focus: Rank →</span><h1>Make the first column easier to read at a glance.</h1><p>Four alternate treatments for the source-rank → adjusted-rank column. The examples use the same rows from your screenshot so the tradeoffs are easy to compare.</p></header>
    <section className="column-mock-options" aria-label="Rank column options">{views.map((view) => <button key={view.id} className={selected === view.id ? 'is-selected' : ''} onClick={() => setSelected(view.id)}><span>0{views.indexOf(view) + 1}</span><strong>{view.name}</strong><small>{view.description}</small></button>)}</section>
    <section className="column-mock-browser" aria-label={`${active.name} table preview`}>
      <div className="column-mock-browser__bar"><i /><i /><i /><span>{active.name} · rankingsdiff</span></div>
      <div className="column-mock-table">
        <div className="column-mock-table__heading"><span>Rank →</span><span>Delta</span><span>Draft</span></div>
        {rows.map(([source, adjusted, delta]) => <div className="column-mock-table__row" key={`${source}-${adjusted}`}><div className="column-mock__rank-slot"><RankCell view={selected} source={source} adjusted={adjusted} delta={delta} /></div><strong className={`column-mock__delta ${delta.startsWith('+') ? 'is-up' : delta.startsWith('-') ? 'is-down' : 'is-neutral'}`}>{delta}</strong><button type="button">Draft</button></div>)}
      </div>
    </section>
    <footer className="column-mock-page__footer"><strong>Selected: {active.name}</strong><span>{active.description}</span></footer>
  </main>
}
