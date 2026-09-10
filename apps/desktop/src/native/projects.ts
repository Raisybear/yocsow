import { invoke, isTauri } from '@tauri-apps/api/core'
import { open, save } from '@tauri-apps/plugin-dialog'
import type { SearchRequirement } from '../domain/search-requirements'

export const PROJECT_FORMAT_VERSION = 3

export interface ProjectDocument {
  formatVersion: number
  name: string
  searchRequirements: SearchRequirement[]
}

export interface OpenedProject {
  path: string
  project: ProjectDocument
}

export type ProjectDialogResult<T> =
  | { status: 'selected'; value: T }
  | { status: 'cancelled' }
  | { status: 'browser' }

function projectFilters() {
  return [
    {
      name: 'YOCSOW project',
      extensions: ['yocsow'],
    },
  ]
}

function projectFilename(name: string): string {
  const sanitizedName = name
    .trim()
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')

  return `${sanitizedName || 'Untitled project'}.yocsow`
}

export async function openLocalProject(): Promise<
  ProjectDialogResult<OpenedProject>
> {
  if (!isTauri()) {
    return { status: 'browser' }
  }

  const path = await open({
    directory: false,
    multiple: false,
    filters: projectFilters(),
  })

  if (path === null) {
    return { status: 'cancelled' }
  }

  if (Array.isArray(path)) {
    throw new Error('Expected a single project file')
  }

  const project = await invoke<ProjectDocument>('load_project', {
    path,
  })

  return {
    status: 'selected',
    value: {
      path,
      project,
    },
  }
}

export async function selectProjectSavePath(
  projectName: string,
): Promise<ProjectDialogResult<string>> {
  if (!isTauri()) {
    return { status: 'browser' }
  }

  const path = await save({
    defaultPath: projectFilename(projectName),
    filters: projectFilters(),
  })

  if (path === null) {
    return { status: 'cancelled' }
  }

  return {
    status: 'selected',
    value: path,
  }
}

export async function saveLocalProject(
  path: string,
  project: ProjectDocument,
): Promise<void> {
  if (!isTauri()) {
    throw new Error(
      'Project files require the native Tauri application',
    )
  }

  await invoke('save_project', {
    path,
    project,
  })
}
