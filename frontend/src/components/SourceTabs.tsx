import type { SourceManifest } from '../types'

type Props = { sources: SourceManifest[]; selected: string; onSelect: (source: string) => void }

export function SourceTabs({ sources, selected, onSelect }: Props) {
  return (
    <div className="source-tabs" role="tablist" aria-label="Ranking source">
      {sources.map((source) => (
        <button key={source.id} className={source.id === selected ? 'active' : ''} onClick={() => onSelect(source.id)} role="tab" aria-selected={source.id === selected}>
          <span>{source.label}</span>
          <small>{source.rowCount} rows</small>
        </button>
      ))}
    </div>
  )
}
