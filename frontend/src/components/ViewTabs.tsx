type ViewRoute = 'board' | 'analytics' | 'draft'

type Props = { active: ViewRoute; onNavigate: (path: ViewRoute) => void; hideBoard?: boolean }

const tabs: Array<{ route: ViewRoute; label: string }> = [
  { route: 'board', label: 'Draft board' },
  { route: 'draft', label: 'Historic results' },
  { route: 'analytics', label: 'Charts' }
]

export function ViewTabs({ active, onNavigate, hideBoard = false }: Props) {
  return <nav className="view-tabs" aria-label="Primary views">
    {tabs.filter((tab) => !hideBoard || tab.route !== 'board').map((tab) => <button key={tab.route} type="button" className={active === tab.route ? 'active' : ''} aria-current={active === tab.route ? 'page' : undefined} onClick={() => onNavigate(tab.route)}>{tab.label}</button>)}
  </nav>
}
