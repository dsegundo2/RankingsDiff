import { useState } from 'react'

type ThemeId = 'quiet' | 'scoreboard' | 'command' | 'editorial' | 'field' | 'studio-mint'

const themes: Array<{ id: ThemeId; name: string; eyebrow: string; font: string; description: string }> = [
  { id: 'quiet', name: 'Quiet Utility', eyebrow: 'Option 01', font: 'System sans', description: 'A compact wordmark, calm navigation, and no wasted height.' },
  { id: 'scoreboard', name: 'Split Scoreboard', eyebrow: 'Option 02', font: 'System sans · tabular', description: 'The season context and live draft signal share one clean row.' },
  { id: 'command', name: 'Command Strip', eyebrow: 'Option 03', font: 'Condensed sans', description: 'A denser control-room header built for quick scanning.' },
  { id: 'editorial', name: 'Editorial Index', eyebrow: 'Option 04', font: 'Humanist sans', description: 'A little more personality with a restrained magazine-like rhythm.' },
  { id: 'field', name: 'Field Notes', eyebrow: 'Option 05', font: 'Mono accents', description: 'A soft green live-state marker with a practical draft-room feel.' },
  { id: 'studio-mint', name: 'Studio Mint', eyebrow: 'Option 06', font: 'Warm sans · mint accents', description: 'A warm studio surface, mint controls, and quiet data contrast.' },
]

const players = [
  ['01', 'Ja’Marr Chase', 'WR', 'CIN', '1.2', '+0.8'],
  ['02', 'Bijan Robinson', 'RB', 'ATL', '2.8', '-0.4'],
  ['03', 'CeeDee Lamb', 'WR', 'DAL', '3.1', '+1.6'],
  ['04', 'Breece Hall', 'RB', 'NYJ', '5.4', '-0.2'],
]

function Logo() { return <span className="mock-logo" aria-hidden="true"><b>R</b><b>D</b></span> }

function MockTable() {
  return <div className="mock-table" role="table" aria-label="Rankings preview">
    <div className="mock-table__head" role="row"><span>Player</span><span>Pos</span><span>Source</span><span>Delta</span><span aria-label="Draft action" /></div>
    {players.map(([rank, player, position, team, source, delta]) => <div className="mock-table__row" role="row" key={player}>
      <span className="mock-player"><i>{rank}</i><strong>{player}</strong><small>{team} · 2025 rankings</small></span>
      <em className={`mock-pos mock-pos--${position.toLowerCase()}`}>{position}</em>
      <b className="mock-number">{source}</b>
      <b className={`mock-delta ${delta.startsWith('+') ? 'is-up' : 'is-down'}`}>{delta}</b>
      <button className="mock-row-action" type="button">Draft</button>
    </div>)}
  </div>
}

function MockSettings({ onClose }: { onClose: () => void }) {
  return <div className="mock-settings-backdrop" role="presentation">
    <section className="mock-settings" role="dialog" aria-modal="true" aria-labelledby="mock-settings-title">
      <header className="mock-settings__header"><div><span className="mock-eyebrow">Workspace</span><h2 id="mock-settings-title">Settings</h2><p>Everything stays in the same surface language as the board.</p></div><button className="mock-close" type="button" onClick={onClose} aria-label="Close settings">×</button></header>
      <div className="mock-settings__body"><nav className="mock-settings__nav" aria-label="Settings sections"><strong>Customize</strong><button className="is-active" type="button">▦ <span>Current sheet</span></button><button type="button">◫ <span>Display</span></button><button type="button">↓ <span>Snapshots</span></button></nav><div className="mock-settings__content"><span className="mock-eyebrow">Current sheet</span><h3>2025 · FantasyPros</h3><p>Choose the source and scoring profile for this board.</p><div className="mock-form-grid"><label>Year<select defaultValue="2025"><option>2025</option></select></label><label>Source<select defaultValue="FantasyPros"><option>FantasyPros</option></select></label><label>Scoring<select defaultValue="Full PPR"><option>Full PPR</option></select></label></div><div className="mock-settings__footer"><button className="mock-secondary" type="button" onClick={onClose}>Cancel</button><button className="mock-primary" type="button" onClick={onClose}>Save changes</button></div></div></div>
    </section>
  </div>
}

export function ThemeMockups() {
  const [selected, setSelected] = useState<ThemeId>('quiet')
  const [settingsOpen, setSettingsOpen] = useState(true)
  const activeTheme = themes.find((theme) => theme.id === selected) ?? themes[0]
  return <main className={`theme-lab theme-lab--${selected}`}>
    <div className="theme-lab__topbar"><a className="theme-lab__back" href="./">← Back to dashboard</a><span className="mock-eyebrow">RankingsDiff · Theme lab</span><span className="theme-lab__status">Responsive mockups</span></div>
    <header className="theme-lab__intro"><div><span className="mock-eyebrow">A visual direction study</span><h1>Choose a calmer, more connected header.</h1><p>Six responsive HTML header mockups using the existing RankingsDiff language. Each option stays compact so the rankings remain the main event.</p></div><div className="theme-lab__choice"><span>Selected direction</span><strong>{activeTheme.name}</strong><button className="mock-primary" type="button" onClick={() => setSettingsOpen((open) => !open)}>{settingsOpen ? 'Hide settings' : 'Preview settings'}</button></div></header>
    <section className="theme-options" aria-label="Header options">{themes.map((theme) => <button type="button" key={theme.id} className={`theme-option theme-option--${theme.id}${theme.id === selected ? ' is-selected' : ''}`} onClick={() => setSelected(theme.id)}><span className="theme-option__swatches"><i /><i /><i /></span><span className="mock-eyebrow">{theme.eyebrow}</span><strong>{theme.name}</strong><small className="theme-option__font">{theme.font}</small><small>{theme.description}</small><span className="theme-option__check" aria-hidden="true">{theme.id === selected ? '✓' : '○'}</span></button>)}</section>
    <section className="mock-browser" aria-label={`${activeTheme.name} dashboard preview`}>
      <div className="mock-browser__chrome"><span /><span /><span /><small>{activeTheme.name} · rankingsdiff</small><b>↗</b></div>
      <div className="mock-dashboard"><header className={`mock-dashboard__header mock-dashboard__header--${selected}`}><div className="mock-brand"><Logo /><div><strong>RankingsDiff</strong><small>Fantasy football command center</small></div></div><div className="mock-header-context"><span>2025 · Full PPR</span><b>Draft board</b></div><div className="mock-header-status"><span>248 players</span><strong>12 targets</strong></div><nav><button type="button" className="mock-nav-active">Draft board</button><button type="button">Position view</button><button type="button" onClick={() => setSettingsOpen(true)}>⚙ Settings</button></nav></header><div className="mock-dashboard__summary"><div><span className="mock-eyebrow">2025 season · Full PPR</span><h2>Draft board</h2><p>Compare source rank against your adjusted view.</p></div><div className="mock-summary-stat"><span>Showing</span><strong>248</strong><small>players</small></div><div className="mock-summary-stat"><span>Shortlist</span><strong>12</strong><small>targets</small></div></div><div className="mock-dashboard__controls"><label><span>Search players</span><input placeholder="Search by player or team" /></label><div className="mock-pills"><span>All <b>248</b></span><span className="is-active">RB <b>62</b></span><span>WR <b>78</b></span><span>QB <b>32</b></span><span>TE <b>25</b></span></div><button className="mock-secondary mock-filter" type="button">Sort: Source rank ↕</button></div><div className="mock-dashboard__grid"><MockTable /><aside className="mock-shortlist"><div><span className="mock-eyebrow">Target queue</span><h3>Shortlist <b>12</b></h3></div><p>Next up for your draft room</p><div className="mock-shortlist__item"><b>WR</b><span><strong>Malik Nabers</strong><small>NYG · #11 → #8</small></span><i>+3</i></div><div className="mock-shortlist__item"><b>RB</b><span><strong>De’Von Achane</strong><small>MIA · #18 → #14</small></span><i>+4</i></div><button className="mock-secondary" type="button">View all targets</button></aside></div></div>
    </section>
    <footer className="theme-lab__footer"><span>Built for 1440px → 320px without horizontal overflow.</span><a href="mailto:design@rankingsdiff.local?subject=RankingsDiff%20theme%20choice">Send feedback →</a></footer>
    {settingsOpen ? <MockSettings onClose={() => setSettingsOpen(false)} /> : null}
  </main>
}
