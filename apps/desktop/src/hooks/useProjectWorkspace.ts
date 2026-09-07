import { useState } from 'react'
import {
  openLocalProject,
  PROJECT_FORMAT_VERSION,
  saveLocalProject,
  selectProjectSavePath,
  type ProjectDocument,
} from '../native/projects'

export type ProjectFileState =
  | { status: 'idle' }
  | { status: 'opening' }
  | { status: 'selecting' }
  | { status: 'saving' }
  | { status: 'opened' }
  | { status: 'saved' }
  | { status: 'cancelled' }
  | { status: 'browser' }
  | { status: 'error'; message: string }

export interface ProjectWorkspaceController {
  project: ProjectDocument
  projectPath: string | null
  projectDirty: boolean
  projectFileState: ProjectFileState
  projectBusy: boolean
  newProject: () => void
  openProject: () => Promise<void>
  saveProject: () => Promise<void>
  saveProjectAs: () => Promise<void>
  updateProjectName: (value: string) => void
  updateSeedRange: (
    field: keyof ProjectDocument['seedRange'],
    value: string,
  ) => void
}

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

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export function useProjectWorkspace(): ProjectWorkspaceController {
  const [project, setProject] = useState<ProjectDocument>(
    createProject,
  )

  const [projectPath, setProjectPath] = useState<string | null>(null)
  const [projectDirty, setProjectDirty] = useState(false)

  const [projectFileState, setProjectFileState] =
    useState<ProjectFileState>({
      status: 'idle',
    })

  const projectBusy =
    projectFileState.status === 'opening' ||
    projectFileState.status === 'selecting' ||
    projectFileState.status === 'saving'

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

  function newProject(): void {
    if (!confirmProjectReplacement()) {
      return
    }

    setProject(createProject())
    setProjectPath(null)
    setProjectDirty(false)
    setProjectFileState({ status: 'idle' })
  }

  async function openProject(): Promise<void> {
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

  async function saveProjectAs(): Promise<void> {
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

  async function saveProject(): Promise<void> {
    if (projectPath === null) {
      await saveProjectAs()
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
  }

  return {
    project,
    projectPath,
    projectDirty,
    projectFileState,
    projectBusy,
    newProject,
    openProject,
    saveProject,
    saveProjectAs,
    updateProjectName,
    updateSeedRange,
  }
}