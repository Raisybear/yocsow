import { SystemStatus } from './SystemStatus'
import './AppSidebar.css'

export type WorkspaceView =
  | 'seed-finder'
  | 'project'
  | 'world-editor'
  | 'settings'

interface NavigationItem {
  id: WorkspaceView
  label: string
  shortLabel: string
  description: string
}

interface AppSidebarProps {
  activeView: WorkspaceView
  onViewChange: (view: WorkspaceView) => void
}

const navigationItems: NavigationItem[] = [
  {
    id: 'project',
    label: 'Project',
    shortLabel: 'PR',
    description: 'Local project files',
  },
  {
    id: 'seed-finder',
    label: 'Seed Finder',
    shortLabel: 'SF',
    description: 'Filters and results',
  },
  {
    id: 'world-editor',
    label: 'World Editor',
    shortLabel: 'WE',
    description: 'World inspection tools',
  },
  {
    id: 'settings',
    label: 'Settings',
    shortLabel: 'ST',
    description: 'Application preferences',
  },
]

export function AppSidebar({
  activeView,
  onViewChange,
}: AppSidebarProps) {
  return (
    <aside className="app-sidebar">
      <div className="app-brand">
        <span className="app-brand-mark" aria-hidden="true">
          YO
        </span>

        <div className="app-brand-copy">
          <strong>YOCSOW</strong>
          <span>Your world. Your rules.</span>
        </div>
      </div>

      <nav className="app-navigation" aria-label="Workspace">
        {navigationItems.map((item) => {
          const isActive = item.id === activeView

          return (
            <button
              className={
                isActive
                  ? 'app-navigation-item app-navigation-item--active'
                  : 'app-navigation-item'
              }
              type="button"
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                onViewChange(item.id)
              }}
              key={item.id}
            >
              <span
                className="app-navigation-mark"
                aria-hidden="true"
              >
                {item.shortLabel}
              </span>

              <span className="app-navigation-copy">
                <strong>{item.label}</strong>
                <small>{item.description}</small>
              </span>
            </button>
          )
        })}
      </nav>

      <footer className="app-sidebar-footer">
        <span className="app-sidebar-label">System status</span>
        <SystemStatus />
      </footer>
    </aside>
  )
}
