import { useEffect, useState } from 'react'
import type { AdjustedProfile, DataManifest, SourceCheckPayload, SourceLink, SourceManifest } from '../types'
import { DownloadPanel } from './DownloadPanel'
import { DraftStateControls } from './DraftStateControls'
import { SourceChecksPanel } from './SourceChecksPanel'
import { rosterTargetLabel, ROSTER_TARGET_SLOTS, type RosterTargetGoals } from '../data/rosterTargets'
import { sourceLabel } from '../data/rankings'

type SettingsPane = 'sheet' | 'snapshots' | 'checks' | 'display' | 'roster'
type DraftMode = 'snake' | 'auction'
export type MatchHealth = { total: number; full: number; half: number }

const panes: Array<{ id: SettingsPane; label: string; description: string; icon: string }> = [
  { id: 'sheet', label: 'Current sheet', description: 'Year, source, and source pages', icon: '▦' },
  { id: 'snapshots', label: 'Snapshots', description: 'Downloads and draft backups', icon: '↓' },
  { id: 'checks', label: 'Ranking checks', description: 'Source health and refreshes', icon: '✓' },
  { id: 'display', label: 'Display', description: 'Choose what stays visible', icon: '◫' },
  { id: 'roster', label: 'Roster targets', description: 'Expected spend by slot', icon: '$' },
]

type Props = {
  open: boolean
  manifest: DataManifest
  selectedSeason: number
  selectedSource: string
  currentSource?: SourceManifest
  adjustedProfiles: AdjustedProfile[]
  selectedAdjustedProfile: string
  onAdjustedProfile: (profile: string) => void
  sourceChecks?: SourceCheckPayload
  generatedAt?: string
  matchHealth: MatchHealth
  visibleCount: number
  targetCount: number
  showTargetQueue: boolean
  showDrafted: boolean
  showDraftLog: boolean
  showRosterPanel: boolean
  stickyWorkbench: boolean
  showYahooProjections: boolean
  showRegressionDiff: boolean
  viewMode: 'board' | 'positions'
  targets: Set<string>
  drafted: Set<string>
  picks: Record<string, number>
  draftSlot: number
  draftSize: number
  mine: Set<string>
  prices: Record<string, number>
  slots: Record<string, string>
  targetGoals: RosterTargetGoals
  onRestoreDraft: (state: { targets: string[]; drafted: string[]; picks: Record<string, number>; draftSlot: number; draftSize: number; mine: string[]; prices: Record<string, number>; slots: Record<string, string>; targetGoals: Record<string, number> }) => void
  onClearDraft: () => void
  onShowTargetQueue: (value: boolean) => void
  onShowDrafted: (value: boolean) => void
  onShowDraftLog: (value: boolean) => void
  onShowRosterPanel: (value: boolean) => void
  onShowStickyWorkbench: (value: boolean) => void
  onShowYahooProjections: (value: boolean) => void
  onShowRegressionDiff: (value: boolean) => void
  onViewMode: (value: 'board' | 'positions') => void
  onSeason: (value: number) => void
  onSource: (value: string) => void
  draftMode: DraftMode
  onDraftMode: (value: DraftMode) => void
  onTargetGoals: (value: RosterTargetGoals) => void
  onDraftSlot: (value: number) => void
  onDraftSize: (value: number) => void
  onClose: () => void
}

function SourceLinks({ links, adjustedProfiles, selectedAdjustedProfile }: { links?: SourceLink[]; adjustedProfiles: AdjustedProfile[]; selectedAdjustedProfile: string }) {
  if (!links?.length) return null
  const selectedProfile = adjustedProfiles.find((profile) => profile.id === selectedAdjustedProfile) ?? adjustedProfiles[0]
  const sourceLink = links.find((link) => !adjustedProfiles.some((profile) => profile.sourceUrl === link.url)) ?? links[0]
  const profileLink = selectedProfile?.sourceUrl ? links.find((link) => link.url === selectedProfile.sourceUrl) ?? { label: selectedProfile.label, url: selectedProfile.sourceUrl } : undefined
  const visibleLinks = [sourceLink, profileLink].filter((link, index, all): link is SourceLink => Boolean(link) && all.findIndex((candidate) => candidate?.url === link?.url) === index)
  return (
    <div className="source-links" aria-label="Ranking source pages">
      <span>Source pages</span>
      <div>
        {visibleLinks.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
            <span>{link.label}</span><span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}

function adjustedProfileLabel(profile: AdjustedProfile): string {
  return profile.label.replace(/Hayden\s+Winks/gi, 'Winks')
}

function sourceFreshness(source?: SourceManifest): string | null {
  if (!source?.sourceUpdated && !source?.observedAt) return null
  const updated = source.sourceUpdated ? `Source updated ${source.sourceUpdated}` : null
  const observed = source.observedAt ? `observed ${source.observedAt.slice(0, 10)}` : null
  return [updated, observed].filter(Boolean).join(' · ')
}

export function SettingsPopover({ open, manifest, selectedSeason, selectedSource, currentSource, adjustedProfiles, selectedAdjustedProfile, onAdjustedProfile, sourceChecks, generatedAt, matchHealth, visibleCount, targetCount, showTargetQueue, showDrafted, showDraftLog, showRosterPanel, stickyWorkbench, showYahooProjections, showRegressionDiff, viewMode, targets, drafted, picks, draftSlot, draftSize, mine, prices, slots, targetGoals, onRestoreDraft, onClearDraft, onShowTargetQueue, onShowDrafted, onShowDraftLog, onShowRosterPanel, onShowStickyWorkbench, onShowYahooProjections, onShowRegressionDiff, onViewMode, onSeason, onSource, draftMode, onDraftMode, onTargetGoals, onDraftSlot, onDraftSize, onClose }: Props) {
  const [activePane, setActivePane] = useState<SettingsPane>('display')
  const [draftSlotInput, setDraftSlotInput] = useState(String(draftSlot))
  const [draftSizeInput, setDraftSizeInput] = useState(String(draftSize))
  useEffect(() => {
    if (open) setActivePane('display')
  }, [open])
  useEffect(() => setDraftSlotInput(String(draftSlot)), [draftSlot])
  useEffect(() => setDraftSizeInput(String(draftSize)), [draftSize])
  if (!open) return null
  const currentSeason = manifest.seasons.find((season) => season.season === selectedSeason) ?? manifest.seasons[0]

  const activePaneMeta = panes.find((pane) => pane.id === activePane) ?? panes[0]

  return (
    <div className="settings-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="settings-popover" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
        <div className="settings-header">
          <div>
            <span className="eyebrow">Settings</span>
            <h2 id="settings-heading">Settings</h2>
            <p>Choose a settings area from the menu to keep related controls together.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">×</button>
        </div>

        <div className="settings-split-view">
          <nav className="settings-sidebar" aria-label="Settings sections">
            <span className="settings-sidebar__label">Customize</span>
            {panes.map((pane) => <button key={pane.id} type="button" className={`settings-nav-item${activePane === pane.id ? ' active' : ''}`} onClick={() => setActivePane(pane.id)} aria-current={activePane === pane.id ? 'page' : undefined}>
              <span className="settings-nav-item__icon" aria-hidden="true">{pane.icon}</span>
              <span><strong>{pane.label}</strong><small>{pane.description}</small></span>
            </button>)}
          </nav>

          <div className="settings-content">
            <div className="settings-content__heading"><span className="eyebrow">Settings pane</span><h3>{activePaneMeta.label}</h3><p>{activePaneMeta.description}</p></div>
            {activePane === 'sheet' ? <section className="settings-section settings-section--sheet">
              <div className="settings-section__copy settings-section__copy--sheet">
                <span className="eyebrow">Current sheet</span>
                <h3>{sourceLabel(selectedSource)}</h3>
                <p>{currentSource?.rowCount.toLocaleString() ?? '—'} total rows · adjusted rankings are selected separately.</p>
                {sourceFreshness(currentSource) ? <small className="source-freshness">{sourceFreshness(currentSource)}</small> : null}
                <label className="select-field select-field--season">
                  <span>Season</span>
                  <select aria-label="Year" value={selectedSeason} onChange={(event) => onSeason(Number(event.target.value))}>
                    {manifest.seasons.map((season) => <option key={season.season} value={season.season}>{season.season}</option>)}
                  </select>
                </label>
              </div>
              <div className="settings-grid">
                <label className="select-field select-field--pretty">
                  <span>Adjusted rankings</span>
                  <select aria-label="Adjusted rankings" value={selectedAdjustedProfile} onChange={(event) => onAdjustedProfile(event.target.value)}>
                    {adjustedProfiles.map((profile) => <option key={profile.id} value={profile.id}>{adjustedProfileLabel(profile)}</option>)}
                  </select>
                  {adjustedProfiles.find((profile) => profile.id === selectedAdjustedProfile)?.sourceUpdated ? <small>Source updated {adjustedProfiles.find((profile) => profile.id === selectedAdjustedProfile)?.sourceUpdated} · observed {adjustedProfiles.find((profile) => profile.id === selectedAdjustedProfile)?.observedAt?.slice(0, 10)}</small> : null}
                </label>
                <label className="select-field select-field--pretty">
                  <span>Base sheet</span>
                  <select aria-label="Sheet" value={selectedSource} onChange={(event) => onSource(event.target.value)}>
                    {currentSeason?.sources.map((source) => <option key={source.id} value={source.id}>{sourceLabel(source.id)}</option>)}
                  </select>
                </label>
              </div>
              <div className="settings-source-switcher" role="group" aria-label="Quick base source switcher">
                <span>Base sheet</span>
                <div>{currentSeason?.sources.map((item) => <button key={item.id} type="button" className={item.id === selectedSource ? 'is-active' : ''} onClick={() => onSource(item.id)} aria-pressed={item.id === selectedSource}>{sourceLabel(item.id)}</button>)}</div>
              </div>
              {selectedSource === 'espn' ? <div className="settings-draft-mode" role="group" aria-label="Draft format">
                <span>Draft format</span>
                <div>{(['snake', 'auction'] as DraftMode[]).map((mode) => <button key={mode} type="button" className={mode === draftMode ? 'is-active' : ''} onClick={() => onDraftMode(mode)} aria-pressed={mode === draftMode}>{mode === 'snake' ? 'Snake' : 'Auction'}</button>)}</div>
              </div> : null}
              <SourceLinks links={currentSource?.sourceLinks} adjustedProfiles={adjustedProfiles} selectedAdjustedProfile={selectedAdjustedProfile} />
              <div className="match-health" aria-label="Match health">
                <div className="match-health__header"><span className="eyebrow">Match health</span><strong className={matchHealth.full === matchHealth.total && matchHealth.half === matchHealth.total ? 'is-healthy' : 'is-review'}>{matchHealth.full === matchHealth.total && matchHealth.half === matchHealth.total ? 'Healthy' : 'Review'}</strong></div>
                <p><strong>{matchHealth.full}/{matchHealth.total}</strong> full PPR matched · <strong>{matchHealth.half}/{matchHealth.total}</strong> half PPR matched.</p>
                {matchHealth.full < matchHealth.total || matchHealth.half < matchHealth.total ? <small>Unranked players stay visible; they do not have a corresponding Winks rank in that profile.</small> : null}
              </div>
            </section> : null}

            {activePane === 'snapshots' ? <section className="settings-section settings-section--tools">
              <div className="settings-section__copy"><span className="eyebrow">Snapshots</span><h3>Downloads and draft backup</h3><p>Export the current table or save, restore, and clear your draft state.</p></div>
              <div className="settings-tools-grid"><DownloadPanel source={currentSource} generatedAt={generatedAt} count={visibleCount} compact /><DraftStateControls season={selectedSeason} source={selectedSource} targets={targets} drafted={drafted} picks={picks} draftSlot={draftSlot} draftSize={draftSize} mine={mine} prices={prices} slots={slots} targetGoals={targetGoals} onRestore={onRestoreDraft} onClear={onClearDraft} /></div>
            </section> : null}

            {activePane === 'checks' ? <SourceChecksPanel checks={sourceChecks} /> : null}

            {activePane === 'roster' ? <section className="settings-section settings-section--tools">
              <div className="settings-section__copy"><span className="eyebrow">Roster targets</span><h3>Expected spend by slot</h3><p>Set your opening auction targets. The roster panel adjusts open-slot targets as you enter prices.</p></div>
              <div className="roster-target-settings" aria-label="Roster target values">
                {ROSTER_TARGET_SLOTS.map((slot) => <label className="roster-target-setting" key={slot}><span>{rosterTargetLabel(slot)}</span><span className="roster-target-setting__input"><span>$</span><input aria-label={`Expected price for ${rosterTargetLabel(slot)}`} type="number" min="0" step="1" inputMode="numeric" value={targetGoals[slot] ?? 0} onChange={(event) => onTargetGoals({ ...targetGoals, [slot]: Math.max(0, Number(event.target.value) || 0) })} /></span></label>)}
              </div>
            </section> : null}

            {activePane === 'display' ? <section className="settings-section settings-section--tools">
              <div className="settings-section__copy"><span className="eyebrow">Display</span><h3>Keep the dashboard focused</h3><p>Choose which supporting panels remain visible while you work the draft board.</p></div>
              <div className="settings-preference-list">
                <label className="settings-preference-card"><span><strong>Position view</strong><small>Group the board into QB, RB, WR, and TE lanes.</small></span><span className="drafted-toggle"><input type="checkbox" aria-label="By position" checked={viewMode === 'positions'} onChange={(event) => onViewMode(event.target.checked ? 'positions' : 'board')} /></span></label>
                <label className="settings-preference-card"><span><strong>Drafted players</strong><small>Keep drafted players in the rankings list while you work.</small></span><span className="drafted-toggle"><input type="checkbox" aria-label="Show drafted" checked={showDrafted} onChange={(event) => onShowDrafted(event.target.checked)} /><kbd>D</kbd></span></label>
                <label className="settings-preference-card"><span><strong>My draft spot</strong><small>Show your current and future snake picks across 17 rounds.</small></span><span className="draft-slot-input"><input aria-label="My draft spot" type="number" min="1" max={draftSize} step="1" value={draftSlotInput} onChange={(event) => { setDraftSlotInput(event.target.value); const value = Number(event.target.value); if (Number.isInteger(value) && value >= 1 && value <= draftSize) onDraftSlot(value) }} onBlur={() => setDraftSlotInput(String(draftSlot))} /><small>/ {draftSize}</small></span></label>
                <label className="settings-preference-card"><span><strong>Draft size</strong><small>Set the number of teams in the snake draft.</small></span><span className="draft-slot-input"><input aria-label="Draft size" type="number" min="2" max="20" step="1" value={draftSizeInput} onChange={(event) => { setDraftSizeInput(event.target.value); const value = Number(event.target.value); if (Number.isInteger(value) && value >= 2 && value <= 20) onDraftSize(value) }} onBlur={() => setDraftSizeInput(String(draftSize))} /><small>teams</small></span></label>
                <label className="settings-preference-card"><span><strong>My roster panel</strong><small>Show the shortlist above every roster slot, including empty slots.</small></span><span className="drafted-toggle"><input type="checkbox" aria-label="Show my roster" checked={showRosterPanel} onChange={(event) => onShowRosterPanel(event.target.checked)} /></span></label>
                <label className="settings-preference-card"><span><strong>Target queue</strong><small>{targetCount.toLocaleString()} shortlisted player{targetCount === 1 ? '' : 's'}</small></span><span className="drafted-toggle"><input type="checkbox" aria-label="Show target queue" checked={showTargetQueue} onChange={(event) => onShowTargetQueue(event.target.checked)} /></span></label>
                <label className="settings-preference-card"><span><strong>Recent draft log</strong><small>Show the latest picks above player search.</small></span><span className="drafted-toggle"><input type="checkbox" aria-label="Show draft log" checked={showDraftLog} onChange={(event) => onShowDraftLog(event.target.checked)} /></span></label>
                <label className="settings-preference-card"><span><strong>Yahoo projections</strong><small>Show Week 1 and season projected points using the selected PPR setting. Off by default.</small></span><span className="drafted-toggle"><input type="checkbox" aria-label="Show Yahoo projections" checked={showYahooProjections} onChange={(event) => onShowYahooProjections(event.target.checked)} /></span></label>
                <label className="settings-preference-card"><span><strong>Trend</strong><small>Show each player’s distance above or below the fitted trend line. Off by default.</small></span><span className="drafted-toggle"><input type="checkbox" aria-label="Show trend" checked={showRegressionDiff} onChange={(event) => onShowRegressionDiff(event.target.checked)} /></span></label>
                <label className="settings-preference-card"><span><strong>Sticky workbench</strong><small>Keep the draft log, search, and board controls visible while you scroll.</small></span><span className="drafted-toggle"><input type="checkbox" aria-label="Keep controls up top" checked={stickyWorkbench} onChange={(event) => onShowStickyWorkbench(event.target.checked)} /></span></label>
              </div>
            </section> : null}
          </div>
        </div>
      </section>
    </div>
  )
}
