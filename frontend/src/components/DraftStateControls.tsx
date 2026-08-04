import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { createDraftFile, createDraftShareUrl, parseDraftFile } from '../data/draftState'

type Props = {
  season: number
  source: string
  targets: Set<string>
  drafted: Set<string>
  onRestore: (targets: string[], drafted: string[]) => void
  onClear: () => void
}

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function DraftStateControls({ season, source, targets, drafted, onRestore, onClear }: Props) {
  const [clearOpen, setClearOpen] = useState(false)
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function downloadDraft(): void {
    const payload = createDraftFile(season, source, { targets: [...targets], drafted: [...drafted] })
    const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }))
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `rankingsdiff-${season}-${safeName(source)}-draft.json`
    anchor.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 0)
    setMessage('Draft file saved to Downloads.')
  }

  function clearDraft(saveFirst: boolean): void {
    if (saveFirst) downloadDraft()
    onClear()
    setClearOpen(false)
    setMessage(saveFirst ? 'Draft saved and cleared.' : 'Draft cleared without saving.')
  }

  async function restoreDraft(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = parseDraftFile(await file.text())
      onRestore(parsed.players.targets, parsed.players.drafted)
      const sheetNote = parsed.season === season && parsed.source === source ? '' : ` from ${parsed.season} · ${parsed.source}`
      setMessage(`Draft restored${sheetNote}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to restore that draft file.')
    }
  }

  async function shareDraft(): Promise<void> {
    const url = createDraftShareUrl(season, source, { targets: [...targets], drafted: [...drafted] })
    try {
      if (navigator.share) {
        await navigator.share({ title: `RankingsDiff ${season} draft`, text: 'Open this RankingsDiff draft board', url })
        setMessage('Share sheet opened.')
      } else {
        await navigator.clipboard.writeText(url)
        setMessage('Draft link copied. Open it on your other Safari device.')
      }
    } catch {
      // A cancelled share sheet is not an error worth surfacing.
    }
  }

  return (
    <div className="draft-state-controls">
      <div className="draft-state-controls__buttons">
        <button type="button" className="secondary-action" onClick={downloadDraft}>Save draft</button>
        <button type="button" className="secondary-action" onClick={shareDraft}>Share link</button>
        <button type="button" className="secondary-action" onClick={() => inputRef.current?.click()}>Restore draft</button>
        <button type="button" className="clear-draft-action" onClick={() => setClearOpen(true)}>Clear draft</button>
        <input ref={inputRef} className="sr-only" type="file" accept="application/json,.json" onChange={restoreDraft} aria-label="Upload draft JSON" />
      </div>
      {message ? <span className="draft-state-message" role="status">{message}</span> : null}
      {clearOpen ? (
        <div className="confirm-layer" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setClearOpen(false) }}>
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="clear-draft-heading">
            <span className="eyebrow">Draft reset</span>
            <h2 id="clear-draft-heading">Clear this draft?</h2>
            <p>This removes all drafted and targeted players for {season} · {source}. Save a player-keyed JSON backup first if you may want to restore it later.</p>
            <div className="confirm-dialog__actions">
              <button type="button" className="primary-action" onClick={() => clearDraft(true)}>Save JSON & clear</button>
              <button type="button" className="danger-action" onClick={() => clearDraft(false)}>Clear without saving</button>
              <button type="button" className="secondary-action" onClick={() => setClearOpen(false)}>Cancel</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
