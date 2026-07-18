import type { DataManifest, SourceCheckPayload, SourceLink, SourceManifest } from '../types'
import { DownloadPanel } from './DownloadPanel'
import { DraftStateControls } from './DraftStateControls'
import { SourceChecksPanel } from './SourceChecksPanel'

type Props = {
  open: boolean
  manifest: DataManifest
  selectedSeason: number
  selectedSource: string
  currentSource?: SourceManifest
  sourceChecks?: SourceCheckPayload
  generatedAt?: string
  visibleCount: number
  targets: Set<string>
  drafted: Set<string>
  onRestoreDraft: (targets: string[], drafted: string[]) => void
  onClearDraft: () => void
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

export function SettingsPopover({ open, manifest, selectedSeason, selectedSource, currentSource, sourceChecks, generatedAt, visibleCount, targets, drafted, onRestoreDraft, onClearDraft, onSeason, onSource, onClose }: Props) {
  if (!open) return null
  const currentSeason = manifest.seasons.find((season) => season.season === selectedSeason) ?? manifest.seasons[0]

  return (
    <div className="settings-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="settings-popover" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
        <div className="settings-header">
          <div>
            <span className="eyebrow">Settings</span>
            <h2 id="settings-heading">Settings</h2>
            <p>Manage the current sheet, snapshot downloads, and draft backup tools in one place.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">×</button>
        </div>

        <div className="settings-section settings-section--sheet">
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
        </div>

        <div className="settings-section settings-section--tools">
          <div className="settings-section__copy">
            <span className="eyebrow">Snapshot</span>
            <h3>Downloads and draft backup</h3>
            <p>Export the current table or save, restore, and clear your draft state.</p>
          </div>
          <div className="settings-tools-grid">
            <DownloadPanel source={currentSource} generatedAt={generatedAt} count={visibleCount} compact />
            <DraftStateControls season={selectedSeason} source={selectedSource} targets={targets} drafted={drafted} onRestore={onRestoreDraft} onClear={onClearDraft} />
          </div>
        </div>

        <SourceChecksPanel checks={sourceChecks} />
      </section>
    </div>
  )
}
