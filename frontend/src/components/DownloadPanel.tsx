import type { SourceManifest } from '../types'
import { withBasePath } from '../data/paths'

type Props = { source?: SourceManifest; generatedAt?: string; count?: number }

export function DownloadPanel({ source, generatedAt, count }: Props) {
  if (!source) return null
  return (
    <aside className="download-panel" aria-label="Downloads">
      <div>
        <span className="eyebrow">Snapshot</span>
        <strong>{(count ?? source.rowCount).toLocaleString()} showing</strong>
        {generatedAt && <small>Generated {new Date(generatedAt).toLocaleString()}</small>}
      </div>
      <div className="download-actions">
        <a href={withBasePath(source.csv)} download>CSV</a>
        {source.xlsx && <a href={withBasePath(source.xlsx)} download>XLSX</a>}
      </div>
    </aside>
  )
}
