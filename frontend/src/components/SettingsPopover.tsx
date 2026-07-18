import type { DataManifest, SourceCheckPayload, SourceLink, SourceManifest } from '../types'
import { SourceChecksPanel } from './SourceChecksPanel'

type Props = {
  open: boolean
  manifest: DataManifest
  selectedSeason: number
  selectedSource: string
  currentSource?: SourceManifest
  sourceChecks?: SourceCheckPayload
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
          <a key={link.url} href={link.url} target="_blank" rel="noreferrer">{link.label}</a>
        ))}
      </div>
    </div>
  )
}

export function SettingsPopover({ open, manifest, selectedSeason, selectedSource, currentSource, sourceChecks, onSeason, onSource, onClose }: Props) {
  if (!open) return null
  const currentSeason = manifest.seasons.find((season) => season.season === selectedSeason) ?? manifest.seasons[0]

  return (
    <div className="settings-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <section className="settings-popover" role="dialog" aria-modal="true" aria-labelledby="settings-heading">
        <div className="settings-header">
          <div>
            <span className="eyebrow">Settings</span>
            <h2 id="settings-heading">Sheet and refresh</h2>
            <p>Currently viewing <strong>{selectedSeason}</strong> · <strong>{currentSource?.label ?? selectedSource}</strong>.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close settings">×</button>
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

        <div className="current-card">
          <span>Current view</span>
          <strong>{selectedSeason} · {currentSource?.label ?? selectedSource}</strong>
          <small>{currentSource?.rowCount.toLocaleString() ?? '—'} total rows in this sheet</small>
          <SourceLinks links={currentSource?.sourceLinks} />
        </div>

        <SourceChecksPanel checks={sourceChecks} />
      </section>
    </div>
  )
}
