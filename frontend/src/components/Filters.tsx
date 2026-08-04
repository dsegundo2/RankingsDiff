import type { Ref } from 'react'
import type { PositionFilter } from '../types'

const positions: PositionFilter[] = ['ALL', 'QB', 'RB', 'WR', 'TE']
const positionOptions: Exclude<PositionFilter, 'ALL'>[] = ['RB', 'WR', 'QB', 'TE']

type Props = {
  compact?: boolean
  search: string
  position: PositionFilter
  searchInputRef?: Ref<HTMLInputElement>
  onSearch: (value: string) => void
  onPosition: (value: PositionFilter) => void
  onSelectOnlyPosition?: (value: Exclude<PositionFilter, 'ALL'>) => void
  showSearch?: boolean
  multiSelect?: boolean
  showPositions?: boolean
  selectedPositions?: Set<Exclude<PositionFilter, 'ALL'>>
  onTogglePosition?: (value: Exclude<PositionFilter, 'ALL'>) => void
  draftedCounts?: Record<PositionFilter, number>
}

export function Filters({ search, position, searchInputRef, onSearch, onPosition, onSelectOnlyPosition, showSearch = true, multiSelect = false, showPositions = true, selectedPositions, onTogglePosition, draftedCounts, compact = false }: Props) {
  return (
    <section className={`filters filters--quick${compact ? ' filters--compact' : ''}`} aria-label="Rankings filters">
      {showSearch ? <label className="search-field">
        <span>Search players</span>
        <input data-player-search ref={searchInputRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Ja'Marr, CIN, RB…" />
      </label> : null}
      {showPositions ? <div className="position-filter-wrap">
        <div className="position-pills" aria-label="Position filters">
          {positions.map((pos) => {
            const active = multiSelect
              ? pos === 'ALL' ? selectedPositions?.size === 4 : selectedPositions?.has(pos as Exclude<PositionFilter, 'ALL'>)
              : pos === position
            const count = draftedCounts?.[pos] ?? 0
            const countId = `drafted-count-${pos.toLowerCase()}`
            return <button key={pos} aria-label={pos} aria-describedby={countId} className={active ? 'active' : ''} aria-pressed={active} onClick={() => {
              if (pos === 'ALL' || !multiSelect) onPosition(pos)
              else onTogglePosition?.(pos as Exclude<PositionFilter, 'ALL'>)
            }} onDoubleClick={() => pos !== 'ALL' ? onSelectOnlyPosition?.(pos as Exclude<PositionFilter, 'ALL'>) : undefined}>
              <span>{pos}</span><small id={countId} className="position-pill__count">{count}</small>
            </button>
          })}
        </div>
        <span className="shortcut-help" tabIndex={0} aria-label="Keyboard shortcuts: Command K searches. A shows all. Q filters quarterback. R filters running back. W filters wide receiver. T filters tight end. Escape leaves search.">?
          <span role="tooltip">⌘K search · A all · Q QB · R RB · W WR · T TE · Esc leaves search</span>
        </span>
      </div> : <div className="position-filter-wrap position-filter-wrap--multi">
        <span className="filter-label">Positions</span>
        <div className="position-pills" aria-label="Positions shown side by side">
          {positionOptions.map((pos) => {
            const active = selectedPositions?.has(pos) ?? false
            const count = draftedCounts?.[pos] ?? 0
            const countId = `drafted-count-overview-${pos.toLowerCase()}`
            return <button key={pos} type="button" className={active ? 'active' : ''} aria-label={pos} aria-describedby={countId} aria-pressed={active} onClick={() => onTogglePosition?.(pos)} onDoubleClick={() => onSelectOnlyPosition?.(pos)}><span>{pos}</span><small id={countId} className="position-pill__count">{count}</small></button>
          })}
        </div>
      </div>}
    </section>
  )
}
