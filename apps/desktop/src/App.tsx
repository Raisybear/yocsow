import { useState } from 'react'
import {
  AppSidebar,
  type WorkspaceView,
} from './components/AppSidebar'
import { ProjectWorkspace } from './components/ProjectWorkspace'
import { SeedFinderWorkspace } from './components/SeedFinderWorkspace'
import { useProjectWorkspace } from './hooks/useProjectWorkspace'
import './App.css'

const viewDetails: Record<
  WorkspaceView,
  { eyebrow: string; title: string; description: string }
> = {
  'seed-finder': {
    eyebrow: 'Search workspace',
    title: 'Seed finder',
    description:
      'Define world requirements and review matching seeds.',
  },
  project: {
    eyebrow: 'Local workspace',
    title: 'Project management',
    description:
      'Create, open and save local YOCSOW project files.',
  },
  'world-editor': {
    eyebrow: 'World tools',
    title: 'World editor',
    description:
      'Inspect and edit generated worlds from one workspace.',
  },
  settings: {
    eyebrow: 'Application',
    title: 'Settings',
    description:
      'Configure search, engine and storage preferences.',
  },
}

function App() {
  const workspace = useProjectWorkspace()
  const [activeView, setActiveView] =
    useState<WorkspaceView>('seed-finder')
  const activeViewDetails = viewDetails[activeView]

  return (
    <main className="app-shell">
      <AppSidebar
        activeView={activeView}
        onViewChange={setActiveView}
      />

      <section className="app-workspace">
        <header className="app-workspace-header">
          <div className="app-workspace-heading">
            <p>{activeViewDetails.eyebrow}</p>
            <h1>{activeViewDetails.title}</h1>
            <span>{activeViewDetails.description}</span>
          </div>

          <div className="app-project-context">
            <span>Active project</span>
            <strong>{workspace.project.name}</strong>
            <small>
              {workspace.projectDirty
                ? 'Unsaved changes'
                : workspace.projectPath === null
                  ? 'Not saved yet'
                  : 'Saved locally'}
            </small>
          </div>
        </header>

        <div className={`app-view app-view--${activeView}`}>
          {activeView === 'seed-finder' && (
            <SeedFinderWorkspace
              requirements={workspace.project.searchRequirements}
              onRequirementsChange={
                workspace.updateSearchRequirements
              }
            />
          )}

          {activeView === 'project' && (
            <div className="app-view-stack">
              <ProjectWorkspace workspace={workspace} />
            </div>
          )}

          {activeView === 'world-editor' && (
            <section
              className="app-placeholder"
              aria-labelledby="world-editor-placeholder-title"
            >
              <p className="section-label">Workspace reserved</p>
              <h2 id="world-editor-placeholder-title">
                World editing tools will live here
              </h2>
              <p>
                The fixed application shell is ready for the future
                editor without changing the existing seed-search flow.
              </p>
            </section>
          )}

          {activeView === 'settings' && (
            <section
              className="app-placeholder"
              aria-labelledby="settings-placeholder-title"
            >
              <p className="section-label">
                Configuration workspace
              </p>
              <h2 id="settings-placeholder-title">
                Settings are being reorganized
              </h2>
              <p>
                General, search, engine and storage settings will be
                separated into focused tabs in the final UI commit.
              </p>
            </section>
          )}
        </div>
      </section>
    </main>
  )
}

export default App
