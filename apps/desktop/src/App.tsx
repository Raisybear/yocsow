import { type FormEvent, useEffect, useState } from 'react'
import { getAppInfo, type AppInfo } from './native/app-info'
import {
  getEngineStatus,
  type EngineStatus,
} from './native/engine-status'
import {
  openLocalProject,
  PROJECT_FORMAT_VERSION,
  saveLocalProject,
  selectProjectSavePath,
  type ProjectDocument,
} from './native/projects'
import { seedRangeContains } from './native/seed-range'
import './App.css'

const components = [
  { name: 'Frontend', technology: 'React 19' },
  { name: 'Build', technology: 'Vite 8' },
  { name: 'Engine', technology: 'Java 21' },
] as const

function createProject(): ProjectDocument {
  return {
    formatVersion: PROJECT_FORMAT_VERSION,
    name: 'Untitled project',
    seedRange: {
      minimum: '-10',
      maximum: '10',
      seed: '0',
    },
  }
}

type NativeBridgeState =
  | { status: 'connecting' }
  | { status: 'connected'; appInfo: AppInfo }
  | { status: 'browser' }
  | { status: 'unavailable' }

type EngineBridgeState =
  | { status: 'connecting' }
  | { status: 'connected'; engineStatus: EngineStatus }
  | { status: 'browser' }
  | { status: 'unavailable' }

type SeedRangeQueryState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'result'; contains: boolean }
  | { status: 'browser' }
  | { status: 'error'; message: string }

type ProjectFileState =
  | { status: 'idle' }
  | { status: 'opening' }
  | { status: 'selecting' }
  | { status: 'saving' }
  | { status: 'opened' }
  | { status: 'saved' }
  | { status: 'cancelled' }
  | { status: 'browser' }
  | { status: 'error'; message: string }

function queryResultModifier(state: SeedRangeQueryState): string {
  if (state.status !== 'result') {
    return state.status
  }

  return state.contains ? 'inside' : 'outside'
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function projectFilename(path: string): string {
  const segments = path.split(/[\\/]/)

  return segments[segments.length - 1] || path
}

function App() {
  const [nativeBridge, setNativeBridge] = useState<NativeBridgeState>({
    status: 'connecting',
  })

  const [engineBridge, setEngineBridge] = useState<EngineBridgeState>({
    status: 'connecting',
  })

  const [project, setProject] = useState<ProjectDocument>(
    createProject,
  )

  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectDirty, setProjectDirty] = useState(false)

  const [projectFileState, setProjectFileState] =
    useState<ProjectFileState>({
      status: 'idle',
    })

  const [seedRangeState, setSeedRangeState] =
    useState<SeedRangeQueryState>({
      status: 'idle',
    })

  const projectBusy =
    projectFileState.status === 'opening' ||
    projectFileState.status === 'selecting' ||
    projectFileState.status === 'saving'

  useEffect(() => {
    let active = true

    void getAppInfo()
      .then((appInfo) => {
        if (!active) {
          return
        }

        setNativeBridge(
          appInfo === null
            ? { status: 'browser' }
            : { status: 'connected', appInfo },
        )
      })
      .catch(() => {
        if (active) {
          setNativeBridge({ status: 'unavailable' })
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    void getEngineStatus()
      .then((engineStatus) => {
        if (!active) {
          return
        }

        setEngineBridge(
          engineStatus === null
            ? { status: 'browser' }
            : { status: 'connected', engineStatus },
        )
      })
      .catch(() => {
        if (active) {
          setEngineBridge({ status: 'unavailable' })
        }
      })

    return () => {
      active = false
    }
  }, [])

  function confirmProjectReplacement(): boolean {
    if (!projectDirty) {
      return true
    }

    return window.confirm(
      'Discard the unsaved changes in the current project?',
    )
  }

  function markProjectChanged(): void {
    setProjectDirty(true)
    setProjectFileState({ status: 'idle' })
  }

  function handleNewProject(): void {
    if (!confirmProjectReplacement()) {
      return
    }

    setProject(createProject())
    setProjectPath(null)
    setProjectDirty(false)
    setProjectFileState({ status: 'idle' })
    setSeedRangeState({ status: 'idle' })
  }

  async function handleOpenProject(): Promise<void> {
    if (!confirmProjectReplacement()) {
      return
    }

    setProjectFileState({ status: 'opening' })

    try {
      const result = await openLocalProject()

      if (result.status === 'browser') {
        setProjectFileState({ status: 'browser' })
        return
      }

      if (result.status === 'cancelled') {
        setProjectFileState({ status: 'cancelled' })
        return
      }

      setProject(result.value.project)
      setProjectPath(result.value.path)
      setProjectDirty(false)
      setProjectFileState({ status: 'opened' })
      setSeedRangeState({ status: 'idle' })
    } catch (error) {
      setProjectFileState({
        status: 'error',
        message: errorMessage(error),
      })
    }
  }

  async function persistProject(path: string): Promise<void> {
    setProjectFileState({ status: 'saving' })

    try {
      await saveLocalProject(path, project)

      setProjectPath(path)
      setProjectDirty(false)
      setProjectFileState({ status: 'saved' })
    } catch (error) {
      setProjectFileState({
        status: 'error',
        message: errorMessage(error),
      })
    }
  }

  async function handleSaveProjectAs(): Promise<void> {
    setProjectFileState({ status: 'selecting' })

    try {
      const result = await selectProjectSavePath(project.name)

      if (result.status === 'browser') {
        setProjectFileState({ status: 'browser' })
        return
      }

      if (result.status === 'cancelled') {
        setProjectFileState({ status: 'cancelled' })
        return
      }

      await persistProject(result.value)
    } catch (error) {
      setProjectFileState({
        status: 'error',
        message: errorMessage(error),
      })
    }
  }

  async function handleSaveProject(): Promise<void> {
    if (projectPath === null) {
      await handleSaveProjectAs()
      return
    }

    await persistProject(projectPath)
  }

  function updateProjectName(value: string): void {
    setProject((currentProject) => ({
      ...currentProject,
      name: value,
    }))

    markProjectChanged()
  }

  function updateSeedRange(
    field: keyof ProjectDocument['seedRange'],
    value: string,
  ): void {
    setProject((currentProject) => ({
      ...currentProject,
      seedRange: {
        ...currentProject.seedRange,
        [field]: value,
      },
    }))

    markProjectChanged()
    setSeedRangeState({ status: 'idle' })
  }

  async function handleSeedRangeSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    setSeedRangeState({ status: 'checking' })

    try {
      const result = await seedRangeContains(project.seedRange)

      setSeedRangeState(
        result === null
          ? { status: 'browser' }
          : { status: 'result', contains: result.contains },
      )
    } catch (error) {
      setSeedRangeState({
        status: 'error',
        message: errorMessage(error),
      })
    }
  }

  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="app-title">
        <header className="app-header">
          <div>
            <p className="eyebrow">YOCSOW</p>
            <h1 id="app-title">Your world. Your rules.</h1>

            <p className="introduction">
              Create local Minecraft world projects backed by the Java
              engine.
            </p>
          </div>
        </header>

        <section
          className="project-panel"
          aria-labelledby="project-title"
        >
          <div className="project-heading">
            <div>
              <p className="section-label">Local project</p>
              <h2 id="project-title">Project workspace</h2>
            </div>

            <div className="project-actions">
              <button
                className="project-button"
                type="button"
                disabled={projectBusy}
                onClick={handleNewProject}
              >
                New
              </button>

              <button
                className="project-button"
                type="button"
                disabled={projectBusy}
                onClick={() => void handleOpenProject()}
              >
                Open
              </button>

              <button
                className="project-button project-button--primary"
                type="button"
                disabled={projectBusy}
                onClick={() => void handleSaveProject()}
              >
                Save
              </button>

              <button
                className="project-button"
                type="button"
                disabled={projectBusy}
                onClick={() => void handleSaveProjectAs()}
              >
                Save as
              </button>
            </div>
          </div>

          <label className="project-name-field">
            <span>Project name</span>
            <input
              name="projectName"
              type="text"
              autoComplete="off"
              maxLength={120}
              required
              value={project.name}
              onChange={(event) => {
                updateProjectName(event.currentTarget.value)
              }}
            />
          </label>

          <div className="project-file-summary">
            <div>
              <span className="project-file-label">File</span>
              <span
                className="project-file-name"
                title={projectPath ?? undefined}
              >
                {projectPath === null
                  ? 'Not saved yet'
                  : projectFilename(projectPath)}
              </span>
            </div>

            <span
              className={
                projectDirty
                  ? 'project-change-state project-change-state--dirty'
                  : 'project-change-state'
              }
            >
              {projectDirty
                ? 'Unsaved changes'
                : projectPath === null
                  ? 'New project'
                  : 'All changes saved'}
            </span>
          </div>

          <div
            className={`project-operation project-operation--${projectFileState.status}`}
            role="status"
            aria-live="polite"
          >
            {projectFileState.status === 'idle' && (
              <p>Project is ready.</p>
            )}

            {projectFileState.status === 'opening' && (
              <p>Opening project…</p>
            )}

            {projectFileState.status === 'selecting' && (
              <p>Selecting project file…</p>
            )}

            {projectFileState.status === 'saving' && (
              <p>Saving project…</p>
            )}

            {projectFileState.status === 'opened' && (
              <p>Project opened.</p>
            )}

            {projectFileState.status === 'saved' && (
              <p>Project saved.</p>
            )}

            {projectFileState.status === 'cancelled' && (
              <p>Project selection cancelled.</p>
            )}

            {projectFileState.status === 'browser' && (
              <p>
                Project files require the native Tauri application.
              </p>
            )}

            {projectFileState.status === 'error' && (
              <p>
                Project operation failed: {projectFileState.message}
              </p>
            )}
          </div>
        </section>

        <dl className="component-list">
          {components.map(({ name, technology }) => (
            <div className="component" key={name}>
              <dt>{name}</dt>
              <dd>{technology}</dd>
            </div>
          ))}
        </dl>

        <section
          className="seed-range-panel"
          aria-labelledby="seed-range-title"
        >
          <div className="seed-range-heading">
            <div>
              <p className="section-label">Engine query</p>
              <h2 id="seed-range-title">Check a seed range</h2>
            </div>

            <p className="seed-range-description">
              Test a signed 64-bit Minecraft seed against the range
              stored in this project.
            </p>
          </div>

          <form
            className="seed-range-form"
            onSubmit={handleSeedRangeSubmit}
          >
            <div className="seed-range-fields">
              <label className="seed-range-field">
                <span>Minimum</span>
                <input
                  name="minimum"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={project.seedRange.minimum}
                  onChange={(event) => {
                    updateSeedRange(
                      'minimum',
                      event.currentTarget.value,
                    )
                  }}
                />
              </label>

              <label className="seed-range-field">
                <span>Maximum</span>
                <input
                  name="maximum"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={project.seedRange.maximum}
                  onChange={(event) => {
                    updateSeedRange(
                      'maximum',
                      event.currentTarget.value,
                    )
                  }}
                />
              </label>

              <label className="seed-range-field">
                <span>Seed</span>
                <input
                  name="seed"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={project.seedRange.seed}
                  onChange={(event) => {
                    updateSeedRange(
                      'seed',
                      event.currentTarget.value,
                    )
                  }}
                />
              </label>
            </div>

            <button
              className="seed-range-submit"
              type="submit"
              disabled={seedRangeState.status === 'checking'}
            >
              {seedRangeState.status === 'checking'
                ? 'Checking…'
                : 'Check seed'}
            </button>
          </form>

          <div
            className={`query-result query-result--${queryResultModifier(
              seedRangeState,
            )}`}
            role="status"
            aria-live="polite"
          >
            {seedRangeState.status === 'idle' && (
              <p>Ready to query the Java engine.</p>
            )}

            {seedRangeState.status === 'checking' && (
              <p>Checking seed range…</p>
            )}

            {seedRangeState.status === 'result' &&
              seedRangeState.contains && (
                <p>Seed is inside the selected range.</p>
              )}

            {seedRangeState.status === 'result' &&
              !seedRangeState.contains && (
                <p>Seed is outside the selected range.</p>
              )}

            {seedRangeState.status === 'browser' && (
              <p>
                Seed queries require the native Tauri application.
              </p>
            )}

            {seedRangeState.status === 'error' && (
              <p>Seed query failed: {seedRangeState.message}</p>
            )}
          </div>
        </section>

        <div className="status-list">
          <p
            className={`status status--${nativeBridge.status}`}
            role="status"
          >
            <span className="status-indicator" aria-hidden="true" />

            {nativeBridge.status === 'connecting' && (
              <span>Connecting to native bridge</span>
            )}

            {nativeBridge.status === 'connected' && (
              <span>
                Native bridge operational
                <span className="status-details">
                  {' '}
                  — {nativeBridge.appInfo.platform} ·{' '}
                  {nativeBridge.appInfo.architecture} · v
                  {nativeBridge.appInfo.version}
                </span>
              </span>
            )}

            {nativeBridge.status === 'browser' && (
              <span>
                Browser preview active
                <span className="status-details">
                  {' '}
                  — native commands require Tauri
                </span>
              </span>
            )}

            {nativeBridge.status === 'unavailable' && (
              <span>Native bridge unavailable</span>
            )}
          </p>

          <p
            className={`status status--${engineBridge.status}`}
            role="status"
          >
            <span className="status-indicator" aria-hidden="true" />

            {engineBridge.status === 'connecting' && (
              <span>Connecting to Java engine</span>
            )}

            {engineBridge.status === 'connected' && (
              <span>
                Java engine operational
                <span className="status-details">
                  {' '}
                  — v{engineBridge.engineStatus.engineVersion} ·
                  protocol {engineBridge.engineStatus.protocolVersion}
                </span>
              </span>
            )}

            {engineBridge.status === 'browser' && (
              <span>Java engine requires Tauri</span>
            )}

            {engineBridge.status === 'unavailable' && (
              <span>Java engine unavailable</span>
            )}
          </p>
        </div>
      </section>
    </main>
  )
}

export default App