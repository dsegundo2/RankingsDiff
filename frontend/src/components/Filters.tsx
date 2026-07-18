import type { Ref } from 'react'
import type { PositionFilter } from '../types'

const positions: PositionFilter[] = ['ALL', 'QB', 'RB', 'WR', 'TE']

type Props = {
  search: string
  position: PositionFilter
  searchInputRef?: Ref<HTMLInputElement>
  onSearch: (value: string) => void
  onPosition: (value: PositionFilter) => void
  showPositions?: boolean
}

export function Filters({ search, position, searchInputRef, onSearch, onPosition, showPositions = true }: Props) {
  return (
    <section className="filters filters--quick" aria-label="Rankings filters">
      <label className="search-field">
        <span>Search players</span>
        <input data-player-search ref={searchInputRef} value={search} onChange={(event) => onSearch(event.target.value)} placeholder="Ja'Marr, CIN, RB…" />
      </label>
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
      </div> : <div className="filter-hint">Showing every position side by side</div>}
    </section>
  )
}
