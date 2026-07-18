import type { Ref } from 'react'
import type { PositionFilter } from '../types'

const positions: PositionFilter[] = ['ALL', 'QB', 'RB', 'WR', 'TE']
const positionOptions: Exclude<PositionFilter, 'ALL'>[] = ['RB', 'WR', 'QB', 'TE']

type Props = {
  search: string
  position: PositionFilter
  searchInputRef?: Ref<HTMLInputElement>
  onSearch: (value: string) => void
  onPosition: (value: PositionFilter) => void
  onSelectOnlyPosition?: (value: Exclude<PositionFilter, 'ALL'>) => void
  showSearch?: boolean
  showPositions?: boolean
  selectedPositions?: Set<Exclude<PositionFilter, 'ALL'>>
  onTogglePosition?: (value: Exclude<PositionFilter, 'ALL'>) => void
}

export function Filters({ search, position, searchInputRef, onSearch, onPosition, onSelectOnlyPosition, showSearch = true, showPositions = true, selectedPositions, onTogglePosition }: Props) {
  return (
    <section className="filters filters--quick" aria-label="Rankings filters">
      {showSearch ? <label className="search-field">
        <span>Search players</span>
        <input data-player-search ref={searchInputRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Ja'Marr, CIN, RB…" />
      </label> : null}
      {showPositions ? <div className="position-filter-wrap">
        <div className="position-pills" aria-label="Position filters">
          {positions.map((pos) => (
            <button key={pos} className={pos === position ? 'active' : ''} onClick={() => onPosition(pos)}>
              {pos}
            </button>
          ))}
        </div>
        <span className="shortcut-help" tabIndex={0} aria-label="Keyboard shortcuts: Command K searches. A shows all. Q filters quarterback. R filters running back. W filters wide receiver. T filters tight end. Escape leaves search.">?
          <span role="tooltip">⌘K search · A all · Q QB · R RB · W WR · T TE · Esc leaves search</span>
        </span>
      </div> : <div className="position-filter-wrap position-filter-wrap--multi">
        <span className="filter-label">Positions</span>
        <div className="position-pills" aria-label="Positions shown side by side">
          {positionOptions.map((pos) => {
            const active = selectedPositions?.has(pos) ?? false
            return <button key={pos} type="button" className={active ? 'active' : ''} aria-pressed={active} onClick={() => onTogglePosition?.(pos)} onDoubleClick={() => onSelectOnlyPosition?.(pos)}>{pos}</button>
          })}
        </div>
      </div>}
    </section>
  )
}
