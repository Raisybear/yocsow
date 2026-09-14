import { useState } from 'react'
import { SystemStatus } from './SystemStatus'
import './SettingsWorkspace.css'

type SettingsTab = 'general' | 'search' | 'engine' | 'storage'

interface SettingsWorkspaceProps {
  resultLimit: string
  onResultLimitChange: (resultLimit: string) => void
  projectName: string
  projectPath: string | null
  projectDirty: boolean
}

interface SettingsTabDefinition {
  id: SettingsTab
  label: string
  description: string
}

const settingsTabs: SettingsTabDefinition[] = [
  {
    id: 'general',
    label: 'General',
    description: 'Interface and platform',
  },
  {
    id: 'search',
    label: 'Search',
    description: 'Seed search defaults',
  },
  {
    id: 'engine',
    label: 'Engine',
    description: 'Runtime connections',
  },
  {
    id: 'storage',
    label: 'Storage',
    description: 'Local project files',
  },
]

function projectState(
  projectPath: string | null,
  projectDirty: boolean,
): string {
  if (projectDirty) {
    return 'Unsaved changes'
  }

  return projectPath === null ? 'New project' : 'Saved locally'
}

export function SettingsWorkspace({
  resultLimit,
  onResultLimitChange,
  projectName,
  projectPath,
  projectDirty,
}: SettingsWorkspaceProps) {
  const [activeTab, setActiveTab] =
    useState<SettingsTab>('general')

  return (
    <section className="settings-workspace" aria-label="Application settings">
      <aside className="settings-navigation">
        <header>
          <p className="section-label">Configuration</p>
          <h2>Preferences</h2>
        </header>

        <div
          className="settings-tabs"
          role="tablist"
          aria-label="Settings categories"
          aria-orientation="vertical"
        >
          {settingsTabs.map((tab) => (
            <button
              id={`settings-${tab.id}-tab`}
              className={
                tab.id === activeTab
                  ? 'settings-tab settings-tab--active'
                  : 'settings-tab'
              }
              type="button"
              role="tab"
              aria-selected={tab.id === activeTab}
              aria-controls="settings-panel"
              onClick={() => {
                setActiveTab(tab.id)
              }}
              key={tab.id}
            >
              <strong>{tab.label}</strong>
              <span>{tab.description}</span>
            </button>
          ))}
        </div>
      </aside>

      <div
        id="settings-panel"
        className="settings-panel"
        role="tabpanel"
        aria-labelledby={`settings-${activeTab}-tab`}
        tabIndex={0}
      >
        {activeTab === 'general' && (
          <>
            <header className="settings-panel-heading">
              <p className="section-label">Workspace behavior</p>
              <h2>General</h2>
              <span>
                The desktop shell is optimized for a focused local
                workflow.
              </span>
            </header>

            <div className="settings-card-grid">
              <article className="settings-card">
                <h3>Interface</h3>
                <dl>
                  <div>
                    <dt>Layout</dt>
                    <dd>Fixed desktop workspace</dd>
                  </div>
                  <div>
                    <dt>Scrolling</dt>
                    <dd>Independent content regions</dd>
                  </div>
                  <div>
                    <dt>Theme</dt>
                    <dd>YOCSOW dark</dd>
                  </div>
                </dl>
              </article>

              <article className="settings-card">
                <h3>Platform support</h3>
                <dl>
                  <div>
                    <dt>Windows</dt>
                    <dd>Supported</dd>
                  </div>
                  <div>
                    <dt>Linux</dt>
                    <dd>Supported</dd>
                  </div>
                  <div>
                    <dt>Runtime</dt>
                    <dd>Tauri desktop</dd>
                  </div>
                </dl>
              </article>
            </div>
          </>
        )}

        {activeTab === 'search' && (
          <>
            <header className="settings-panel-heading">
              <p className="section-label">Seed finder defaults</p>
              <h2>Search</h2>
              <span>
                Search preferences remain active while the application
                is open.
              </span>
            </header>

            <div className="settings-card-grid">
              <article className="settings-card settings-card--form">
                <h3>Result collection</h3>

                <label
                  className="settings-field"
                  htmlFor="default-result-limit"
                >
                  <span>Default result limit</span>
                  <input
                    id="default-result-limit"
                    aria-label="Default result limit"
                    aria-describedby="default-result-limit-help"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="100"
                    value={resultLimit}
                    onChange={(event) => {
                      onResultLimitChange(event.currentTarget.value)
                    }}
                  />
                  <small id="default-result-limit-help">
                    Accepts a whole number between 1 and 100.
                  </small>
                </label>
              </article>

              <article className="settings-card">
                <h3>Search engine</h3>
                <dl>
                  <div>
                    <dt>Minecraft version</dt>
                    <dd>1.21</dd>
                  </div>
                  <div>
                    <dt>Seed range</dt>
                    <dd>Signed 64-bit</dd>
                  </div>
                  <div>
                    <dt>Mode</dt>
                    <dd>Continuous native scan</dd>
                  </div>
                </dl>
              </article>
            </div>
          </>
        )}

        {activeTab === 'engine' && (
          <>
            <header className="settings-panel-heading">
              <p className="section-label">Runtime diagnostics</p>
              <h2>Engine</h2>
              <span>
                Live connection state for the desktop and Java
                runtimes.
              </span>
            </header>

            <article className="settings-card settings-engine-status">
              <h3>Connections</h3>
              <SystemStatus />
            </article>

            <p className="settings-note">
              Native commands and seed searches are available only in
              the packaged Tauri application.
            </p>
          </>
        )}

        {activeTab === 'storage' && (
          <>
            <header className="settings-panel-heading">
              <p className="section-label">Project persistence</p>
              <h2>Storage</h2>
              <span>
                YOCSOW projects remain local and are saved explicitly.
              </span>
            </header>

            <div className="settings-card-grid">
              <article className="settings-card">
                <h3>Active project</h3>
                <dl>
                  <div>
                    <dt>Name</dt>
                    <dd>{projectName}</dd>
                  </div>
                  <div>
                    <dt>State</dt>
                    <dd>{projectState(projectPath, projectDirty)}</dd>
                  </div>
                  <div>
                    <dt>File</dt>
                    <dd>{projectPath ?? 'Not saved yet'}</dd>
                  </div>
                </dl>
              </article>

              <article className="settings-card">
                <h3>File handling</h3>
                <dl>
                  <div>
                    <dt>Format</dt>
                    <dd>.yocsow</dd>
                  </div>
                  <div>
                    <dt>Location</dt>
                    <dd>User selected</dd>
                  </div>
                  <div>
                    <dt>Automatic upload</dt>
                    <dd>Disabled</dd>
                  </div>
                </dl>
              </article>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
