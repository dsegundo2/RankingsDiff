import { useState } from 'react'
import type { DataManifest, SourceCheckPayload, SourceLink, SourceManifest } from '../types'
import { DownloadPanel } from './DownloadPanel'
import { DraftStateControls } from './DraftStateControls'
import { SourceChecksPanel } from './SourceChecksPanel'

type SettingsPane = 'sheet' | 'snapshots' | 'checks' | 'display'

const panes: Array<{ id: SettingsPane; label: string; description: string; icon: string }> = [
  { id: 'sheet', label: 'Current sheet', description: 'Year, source, and source pages', icon: '▦' },
  { id: 'snapshots', label: 'Snapshots', description: 'Downloads and draft backups', icon: '↓' },
  { id: 'checks', label: 'Ranking checks', description: 'Source health and refreshes', icon: '✓' },
  { id: 'display', label: 'Display', description: 'Choose what stays visible', icon: '◫' }
]

type Props = {
  open: boolean
  manifest: DataManifest
  selectedSeason: number
  selectedSource: string
  currentSource?: SourceManifest
  sourceChecks?: SourceCheckPayload
  generatedAt?: string
  visibleCount: number
  targetCount: number
  showTargetQueue: boolean
  showDraftLog: boolean
  stickyWorkbench: boolean
  targets: Set<string>
  drafted: Set<string>
  onRestoreDraft: (targets: string[], drafted: string[]) => void
  onClearDraft: () => void
  onShowTargetQueue: (value: boolean) => void
  onShowDraftLog: (value: boolean) => void
  onShowStickyWorkbench: (value: boolean) => void
  onSeason: (value: number) => void
  onSource: (value: string) => void
  onClose: () => void
}

function SourceLinks({ links }: { links?: SourceLink[] }) {
  if (!links?.length) return null
  return (
    <div className="source-links" aria-label="Ranking source pages">
      <span>Source pages</span>
      <div>
        {links.map((link) => (
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer">
            <span>{link.label}</span><span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </div>
  )
}

export function SettingsPopover({ open, manifest, selectedSeason, selectedSource, currentSource, sourceChecks, generatedAt, visibleCount, targetCount, showTargetQueue, showDraftLog, stickyWorkbench, targets, drafted, onRestoreDraft, onClearDraft, onShowTargetQueue, onShowDraftLog, onShowStickyWorkbench, onSeason, onSource, onClose }: Props) {
  const [activePane, setActivePane] = useState<SettingsPane>('sheet')
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
              <div className="settings-section__copy">
                <span className="eyebrow">Current sheet</span>
                <h3>{selectedSeason} · {currentSource?.label ?? selectedSource}</h3>
                <p>{currentSource?.rowCount.toLocaleString() ?? '—'} total rows in this sheet.</p>
              </div>
              <div className="settings-grid">
                <label className="select-field select-field--pretty">
                  <span>Year</span>
                  <select value={selectedSeason} onChange={(event) => onSeason(Number(event.target.value))}>
                    {manifest.seasons.map((season) => <option key={season.season} value={season.season}>{season.season}</option>)}
                  </select>
                </label>
                <label className="select-field select-field--pretty">
                  <span>Sheet</span>
                  <select value={selectedSource} onChange={(event) => onSource(event.target.value)}>
                    {currentSeason?.sources.map((source) => <option key={source.id} value={source.id}>{source.label}</option>)}
                  </select>
                </label>
              </div>
              <SourceLinks links={currentSource?.sourceLinks} />
            </section> : null}

            {activePane === 'snapshots' ? <section className="settings-section settings-section--tools">
              <div className="settings-section__copy"><span className="eyebrow">Snapshots</span><h3>Downloads and draft backup</h3><p>Export the current table or save, restore, and clear your draft state.</p></div>
              <div className="settings-tools-grid"><DownloadPanel source={currentSource} generatedAt={generatedAt} count={visibleCount} compact /><DraftStateControls season={selectedSeason} source={selectedSource} targets={targets} drafted={drafted} onRestore={onRestoreDraft} onClear={onClearDraft} /></div>
            </section> : null}

            {activePane === 'checks' ? <SourceChecksPanel checks={sourceChecks} /> : null}

            {activePane === 'display' ? <section className="settings-section settings-section--tools">
              <div className="settings-section__copy"><span className="eyebrow">Display</span><h3>Keep the dashboard focused</h3><p>Choose which supporting panels remain visible while you work the draft board.</p></div>
              <div className="settings-preference-list">
                <label className="settings-preference-card"><span><strong>Target queue</strong><small>{targetCount.toLocaleString()} shortlisted player{targetCount === 1 ? '' : 's'}</small></span><span className="drafted-toggle"><input type="checkbox" checked={showTargetQueue} onChange={(event) => onShowTargetQueue(event.target.checked)} /> Show target queue</span></label>
                <label className="settings-preference-card"><span><strong>Recent draft log</strong><small>Show the latest picks above player search.</small></span><span className="drafted-toggle"><input type="checkbox" checked={showDraftLog} onChange={(event) => onShowDraftLog(event.target.checked)} /> Show draft log</span></label>
                <label className="settings-preference-card"><span><strong>Sticky workbench</strong><small>Keep the draft log, search, and board controls visible while you scroll.</small></span><span className="drafted-toggle"><input type="checkbox" checked={stickyWorkbench} onChange={(event) => onShowStickyWorkbench(event.target.checked)} /> Keep controls up top</span></label>
              </div>
            </section> : null}
          </div>
        </div>
      </section>
    </div>
  )
}
