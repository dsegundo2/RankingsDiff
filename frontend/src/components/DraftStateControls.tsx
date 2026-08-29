import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { createDraftFile, createDraftShareUrl, parseDraftFile } from '../data/draftState'

type Props = {
  season: number
  source: string
  draftMode: 'snake' | 'auction'
  targets: Set<string>
  drafted: Set<string>
  picks: Record<string, number>
  draftSlot: number
  draftSize: number
  includeKeeperRound: boolean
  mine: Set<string>
  prices: Record<string, number>
  slots: Record<string, string>
  targetGoals: Record<string, number>
  onRestore: (state: { targets: string[]; drafted: string[]; picks: Record<string, number>; draftSlot: number; draftSize: number; includeKeeperRound: boolean; mine: string[]; prices: Record<string, number>; slots: Record<string, string>; targetGoals: Record<string, number> }) => void
  onClear: () => void
}
export type DraftSaveRecord = { filename: string; savedAt: string; pickCount: number; draftMode: 'snake' | 'auction' }

function safeName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

export function downloadDraftFile(season: number, source: string, draftMode: 'snake' | 'auction', state: Parameters<typeof createDraftFile>[2], automatic = false): DraftSaveRecord {
  const savedAt = new Date().toISOString()
  const timestamp = savedAt.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
  const pickCount = state.drafted.length
  const payload = createDraftFile(season, source, state)
  const url = URL.createObjectURL(new Blob([`${JSON.stringify(payload, null, 2)}\n`], { type: 'application/json' }))
  const anchor = document.createElement('a')
  anchor.href = url
  const filename = automatic
    ? `rankingsdiff-${season}-${safeName(source)}-${draftMode}-autosave-${timestamp}-${pickCount}-picks.json`
    : `rankingsdiff-${season}-${safeName(source)}-draft.json`
  anchor.download = filename
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 0)
  return { filename, savedAt, pickCount, draftMode }
}

export function DraftStateControls({ season, source, draftMode, targets, drafted, picks, draftSlot, draftSize, includeKeeperRound, mine, prices, slots, targetGoals, onRestore, onClear }: Props) {
  const [clearOpen, setClearOpen] = useState(false)
  const [message, setMessage] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function downloadDraft(automatic = false): void {
    downloadDraftFile(season, source, draftMode, { targets: [...targets], drafted: [...drafted], picks, draftSlot, draftSize, includeKeeperRound, mine: [...mine], prices, slots, targetGoals }, automatic)
    setMessage(automatic ? `Autosaved ${drafted.size} picks to Downloads.` : 'Draft file saved to Downloads.')
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
      onRestore({ targets: parsed.players.targets, drafted: parsed.players.drafted, picks: parsed.players.picks, draftSlot: parsed.players.draftSlot, draftSize: parsed.players.draftSize, includeKeeperRound: parsed.players.includeKeeperRound, mine: parsed.roster.mine, prices: parsed.roster.prices, slots: parsed.roster.slots, targetGoals: parsed.targetGoals })
      const sheetNote = parsed.season === season && parsed.source === source ? '' : ` from ${parsed.season} · ${parsed.source}`
      setMessage(`Draft restored${sheetNote}.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to restore that draft file.')
    }
  }

  async function shareDraft(): Promise<void> {
    const url = createDraftShareUrl(season, source, { targets: [...targets], drafted: [...drafted], picks, draftSlot, draftSize, includeKeeperRound })
    try {
      if (navigator.share) {
        await navigator.share({ title: `Draft Distillery ${season} draft`, text: 'Open this Draft Distillery draft board', url })
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
        <button type="button" className="secondary-action" onClick={() => downloadDraft()}>Save draft</button>
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
