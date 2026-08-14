import { useState } from 'react'

type HeroStyle = 'banner' | 'column' | 'split' | 'quiet'
type ActionStyle = 'ghost' | 'pair' | 'pills' | 'dots'

const heroOptions: Array<{ id: HeroStyle; name: string; description: string }> = [
  { id: 'banner', name: 'Column banner', description: 'A shallow image strip like a column header, not a giant hero.' },
  { id: 'column', name: 'Context rail', description: 'Keeps the image in a narrow rail while the board owns the space.' },
  { id: 'split', name: 'Split context', description: 'Pairs a compact image crop with the draft board summary.' },
  { id: 'quiet', name: 'No hero image', description: 'Removes the image and lets the RankingsDiff identity lead.' }
]

const actionOptions: Array<{ id: ActionStyle; name: string; description: string }> = [
  { id: 'ghost', name: 'Ghost controls', description: 'Small, low-contrast symbols that appear only on hover.' },
  { id: 'pair', name: 'Outlined pair', description: 'Two compact outlined buttons with clear separation.' },
  { id: 'pills', name: 'Soft pills', description: 'Friendly plus and close pills with a little more affordance.' },
  { id: 'dots', name: 'Corner dots', description: 'Tiny corner controls that keep the player name unobstructed.' }
]

export function HeroRecentMockups() {
  const [hero, setHero] = useState<HeroStyle>('banner')
  const [actions, setActions] = useState<ActionStyle>('ghost')
  const activeHero = heroOptions.find((option) => option.id === hero) ?? heroOptions[0]
  const activeActions = actionOptions.find((option) => option.id === actions) ?? actionOptions[0]
  return <main className="hero-recent-mock-page">
    <div className="hero-recent-mock-page__topbar"><a href="./">← Back to dashboard</a><span>RankingsDiff · hero and recent actions study</span><b>HTML mockups</b></div>
    <header className="hero-recent-mock-page__intro"><span>Focus: hero image + hover actions</span><h1>Keep the image useful, then get out of the way.</h1><p>Explore compact image treatments that feel closer to a column header, plus four hover-only treatments for the recent-pick plus and close actions.</p></header>
    <section className="hero-recent-mock__section" aria-label="Hero options"><div className="hero-recent-mock__section-head"><div><span className="hero-recent-mock__eyebrow">01 · Hero image</span><h2>Four ways to keep the board in charge</h2></div><strong>{activeHero.name}</strong></div><div className="hero-recent-mock__options">{heroOptions.map((option) => <button key={option.id} className={hero === option.id ? 'is-selected' : ''} onClick={() => setHero(option.id)}><b>{option.name}</b><small>{option.description}</small></button>)}</div><div className={`hero-recent-mock__browser hero-recent-mock__browser--${hero}`} aria-label={`${activeHero.name} preview`}><div className="hero-recent-mock__image" aria-hidden="true"><span>RD</span></div><div className="hero-recent-mock__copy"><small>FANTASY FOOTBALL · 2026</small><strong>RankingsDiff</strong><span>ESPN · Full PPR · Snake · 2/10</span></div><button className="hero-recent-mock__settings" type="button">Settings</button></div></section>
    <section className="hero-recent-mock__section" aria-label="Recent action options"><div className="hero-recent-mock__section-head"><div><span className="hero-recent-mock__eyebrow">02 · Recent pick actions</span><h2>Hover the card to reveal plus and close</h2></div><strong>{activeActions.name}</strong></div><div className="hero-recent-mock__options">{actionOptions.map((option) => <button key={option.id} className={actions === option.id ? 'is-selected' : ''} onClick={() => setActions(option.id)}><b>{option.name}</b><small>{option.description}</small></button>)}</div><div className={`hero-recent-mock__recent hero-recent-mock__recent--${actions}`}><article tabIndex={0}><div className="hero-recent-mock__avatar">TB</div><div><strong>Ja'Marr Chase</strong><small>CIN · WR · Pick 4 · drafted</small></div><div className="hero-recent-mock__actions" aria-label="Hover actions"><button type="button" aria-label="Add Ja'Marr Chase to my roster">+</button><button type="button" aria-label="Hide Ja'Marr Chase recent pick">×</button></div></article><article tabIndex={0}><div className="hero-recent-mock__avatar">DET</div><div><strong>Jahmyr Gibbs</strong><small>DET · RB · Pick 1 · drafted</small></div><div className="hero-recent-mock__actions" aria-label="Hover actions"><button type="button" aria-label="Add Jahmyr Gibbs to my roster">+</button><button type="button" aria-label="Hide Jahmyr Gibbs recent pick">×</button></div></article></div><p className="hero-recent-mock__hint">Move your pointer over a recent-pick card to reveal the controls.</p></section>
    <footer className="hero-recent-mock__footer"><strong>Selected: {activeHero.name} + {activeActions.name}</strong><span>Both treatments are HTML/CSS only and ready to compare before adding a Display setting.</span></footer>
  </main>
}
