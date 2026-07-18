import type { SourceCheckPayload } from '../types'

const ACTIONS_URL = 'https://github.com/dsegundo2/RankingsDiff/actions/workflows/check-rankings.yml'

function formatDate(value?: string): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function shortChecksum(value?: string | null): string {
  return value ? value.slice(0, 10) : '—'
}

type Props = { checks?: SourceCheckPayload }

export function SourceChecksPanel({ checks }: Props) {
  const entries = checks?.checks ?? []
  const latestEntries = entries.slice().sort((left, right) => {
    if (left.season !== right.season) return right.season - left.season
    return left.sourceLabel.localeCompare(right.sourceLabel) || left.file.localeCompare(right.file)
  })

  return (
    <section className="source-checks" aria-labelledby="source-checks-heading">
      <div className="source-checks__header">
        <div>
          <span className="eyebrow">Source health</span>
          <h2 id="source-checks-heading">Ranking change checks</h2>
          <p>Checksums compare each current source/output file against its last recorded snapshot. Hosted refreshes run through GitHub Actions; the static page cannot mutate repo data directly.</p>
        </div>
        <a className="workflow-link" href={ACTIONS_URL} target="_blank" rel="noreferrer">Run refresh workflow</a>
      </div>
      <div className="source-checks__meta">Last generated: {formatDate(checks?.generatedAt)}</div>
      <div className="source-checks__list">
        {latestEntries.map((entry) => (
          <article key={entry.id} className={`source-check source-check--${entry.status}`}>
            <div>
              <strong>{entry.season} · {entry.sourceLabel}</strong>
              <span>{entry.kind} · {entry.file}</span>
            </div>
            <dl>
              <div><dt>Status</dt><dd>{entry.status}</dd></div>
              <div><dt>Checked</dt><dd>{formatDate(entry.lastCheckedAt)}</dd></div>
              <div><dt>Changed</dt><dd>{formatDate(entry.lastChangedAt)}</dd></div>
              <div><dt>Hash</dt><dd>{shortChecksum(entry.currentChecksum)}</dd></div>
            </dl>
          </article>
        ))}
        {latestEntries.length === 0 ? <div className="empty-state">No source check status has been generated yet.</div> : null}
      </div>
    </section>
  )
}
