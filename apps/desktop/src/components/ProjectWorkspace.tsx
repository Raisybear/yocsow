import type { ProjectWorkspaceController } from '../hooks/useProjectWorkspace'
import './ProjectWorkspace.css'

interface ProjectWorkspaceProps {
  workspace: ProjectWorkspaceController
}

function projectFilename(path: string): string {
  const segments = path.split(/[\\/]/)

  return segments[segments.length - 1] || path
}

export function ProjectWorkspace({
  workspace,
}: ProjectWorkspaceProps) {
  const {
    project,
    projectPath,
    projectDirty,
    projectFileState,
    projectBusy,
  } = workspace

  return (
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
            onClick={workspace.newProject}
          >
            New
          </button>

          <button
            className="project-button"
            type="button"
            disabled={projectBusy}
            onClick={() => void workspace.openProject()}
          >
            Open
          </button>

          <button
            className="project-button project-button--primary"
            type="button"
            disabled={projectBusy}
            onClick={() => void workspace.saveProject()}
          >
            Save
          </button>

          <button
            className="project-button"
            type="button"
            disabled={projectBusy}
            onClick={() => void workspace.saveProjectAs()}
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
            workspace.updateProjectName(event.currentTarget.value)
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
          <p>Project files require the native Tauri application.</p>
        )}

        {projectFileState.status === 'error' && (
          <p>
            Project operation failed: {projectFileState.message}
          </p>
        )}
      </div>
    </section>
  )
}