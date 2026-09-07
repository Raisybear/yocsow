import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  openLocalProject,
  saveLocalProject,
  selectProjectSavePath,
} from '../native/projects'
import { useProjectWorkspace } from '../hooks/useProjectWorkspace'
import { ProjectWorkspace } from './ProjectWorkspace'
import { SeedRangePanel } from './SeedRangePanel'

vi.mock('../native/projects', () => ({
  PROJECT_FORMAT_VERSION: 1,
  openLocalProject: vi.fn(),
  saveLocalProject: vi.fn(),
  selectProjectSavePath: vi.fn(),
}))

const openLocalProjectMock = vi.mocked(openLocalProject)
const saveLocalProjectMock = vi.mocked(saveLocalProject)
const selectProjectSavePathMock = vi.mocked(
  selectProjectSavePath,
)

function WorkspaceHarness() {
  const workspace = useProjectWorkspace()

  return (
    <>
      <ProjectWorkspace workspace={workspace} />

      <SeedRangePanel
        seedRange={workspace.project.seedRange}
        onChange={workspace.updateSeedRange}
      />
    </>
  )
}

describe('ProjectWorkspace', () => {
  beforeEach(() => {
    openLocalProjectMock.mockReset()
    saveLocalProjectMock.mockReset()
    selectProjectSavePathMock.mockReset()

    openLocalProjectMock.mockResolvedValue({
      status: 'cancelled',
    })

    saveLocalProjectMock.mockResolvedValue()

    selectProjectSavePathMock.mockResolvedValue({
      status: 'cancelled',
    })
  })

  it('starts with a new local project', () => {
    render(<WorkspaceHarness />)

    expect(screen.getByLabelText('Project name')).toHaveValue(
      'Untitled project',
    )
    expect(screen.getByText('Not saved yet')).toBeInTheDocument()
    expect(screen.getByText('New project')).toBeInTheDocument()
  })

  it('marks edited projects as unsaved', async () => {
    const user = userEvent.setup()

    render(<WorkspaceHarness />)

    const projectName = screen.getByLabelText('Project name')

    await user.clear(projectName)
    await user.type(projectName, 'Survival world')

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
  })

  it('opens a local project', async () => {
    const user = userEvent.setup()

    openLocalProjectMock.mockResolvedValue({
      status: 'selected',
      value: {
        path: '/projects/Loaded world.yocsow',
        project: {
          formatVersion: 1,
          name: 'Loaded world',
          seedRange: {
            minimum: '-100',
            maximum: '100',
            seed: '42',
          },
        },
      },
    })

    render(<WorkspaceHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Open',
      }),
    )

    expect(
      await screen.findByDisplayValue('Loaded world'),
    ).toBeInTheDocument()

    expect(screen.getByLabelText('Minimum')).toHaveValue('-100')
    expect(screen.getByLabelText('Maximum')).toHaveValue('100')
    expect(screen.getByLabelText('Seed')).toHaveValue('42')
    expect(screen.getByText('Loaded world.yocsow')).toBeInTheDocument()
    expect(screen.getByText('Project opened.')).toBeInTheDocument()
    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })

  it('saves a new project through the save dialog', async () => {
    const user = userEvent.setup()

    selectProjectSavePathMock.mockResolvedValue({
      status: 'selected',
      value: '/projects/Survival world.yocsow',
    })

    render(<WorkspaceHarness />)

    const projectName = screen.getByLabelText('Project name')

    await user.clear(projectName)
    await user.type(projectName, 'Survival world')

    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    )

    expect(selectProjectSavePathMock).toHaveBeenCalledWith(
      'Survival world',
    )

    expect(saveLocalProjectMock).toHaveBeenCalledWith(
      '/projects/Survival world.yocsow',
      {
        formatVersion: 1,
        name: 'Survival world',
        seedRange: {
          minimum: '-10',
          maximum: '10',
          seed: '0',
        },
      },
    )

    expect(
      await screen.findByText('Project saved.'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Survival world.yocsow'),
    ).toBeInTheDocument()

    expect(screen.getByText('All changes saved')).toBeInTheDocument()
  })

  it('saves an opened project without another dialog', async () => {
    const user = userEvent.setup()

    openLocalProjectMock.mockResolvedValue({
      status: 'selected',
      value: {
        path: '/projects/Existing.yocsow',
        project: {
          formatVersion: 1,
          name: 'Existing',
          seedRange: {
            minimum: '0',
            maximum: '100',
            seed: '50',
          },
        },
      },
    })

    render(<WorkspaceHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Open',
      }),
    )

    const seed = await screen.findByLabelText('Seed')

    await user.clear(seed)
    await user.type(seed, '75')

    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    )

    expect(selectProjectSavePathMock).not.toHaveBeenCalled()

    expect(saveLocalProjectMock).toHaveBeenCalledWith(
      '/projects/Existing.yocsow',
      {
        formatVersion: 1,
        name: 'Existing',
        seedRange: {
          minimum: '0',
          maximum: '100',
          seed: '75',
        },
      },
    )

    expect(
      await screen.findByText('Project saved.'),
    ).toBeInTheDocument()
  })

  it('supports saving an opened project under a new path', async () => {
    const user = userEvent.setup()

    openLocalProjectMock.mockResolvedValue({
      status: 'selected',
      value: {
        path: '/projects/Original.yocsow',
        project: {
          formatVersion: 1,
          name: 'Original',
          seedRange: {
            minimum: '-10',
            maximum: '10',
            seed: '0',
          },
        },
      },
    })

    selectProjectSavePathMock.mockResolvedValue({
      status: 'selected',
      value: '/projects/Copy.yocsow',
    })

    render(<WorkspaceHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Open',
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Save as',
      }),
    )

    expect(saveLocalProjectMock).toHaveBeenCalledWith(
      '/projects/Copy.yocsow',
      {
        formatVersion: 1,
        name: 'Original',
        seedRange: {
          minimum: '-10',
          maximum: '10',
          seed: '0',
        },
      },
    )

    expect(
      await screen.findByText('Copy.yocsow'),
    ).toBeInTheDocument()
  })

  it('creates a fresh project after confirmation', async () => {
    const user = userEvent.setup()
    const confirmMock = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(true)

    render(<WorkspaceHarness />)

    const projectName = screen.getByLabelText('Project name')

    await user.clear(projectName)
    await user.type(projectName, 'Changed project')

    await user.click(
      screen.getByRole('button', {
        name: 'New',
      }),
    )

    expect(confirmMock).toHaveBeenCalled()
    expect(projectName).toHaveValue('Untitled project')
    expect(screen.getByLabelText('Minimum')).toHaveValue('-10')
    expect(screen.getByLabelText('Maximum')).toHaveValue('10')
    expect(screen.getByLabelText('Seed')).toHaveValue('0')
    expect(screen.getByText('New project')).toBeInTheDocument()

    confirmMock.mockRestore()
  })

  it('keeps unsaved projects when replacement is declined', async () => {
    const user = userEvent.setup()
    const confirmMock = vi
      .spyOn(window, 'confirm')
      .mockReturnValue(false)

    render(<WorkspaceHarness />)

    const projectName = screen.getByLabelText('Project name')

    await user.clear(projectName)
    await user.type(projectName, 'Keep this project')

    await user.click(
      screen.getByRole('button', {
        name: 'New',
      }),
    )

    expect(projectName).toHaveValue('Keep this project')
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    confirmMock.mockRestore()
  })

  it('explains that project files require Tauri', async () => {
    const user = userEvent.setup()

    selectProjectSavePathMock.mockResolvedValue({
      status: 'browser',
    })

    render(<WorkspaceHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    )

    expect(
      await screen.findByText(
        'Project files require the native Tauri application.',
      ),
    ).toBeInTheDocument()
  })

  it('shows project persistence errors', async () => {
    const user = userEvent.setup()

    selectProjectSavePathMock.mockResolvedValue({
      status: 'selected',
      value: '/projects/Failure.yocsow',
    })

    saveLocalProjectMock.mockRejectedValue(new Error('Disk is full'))

    render(<WorkspaceHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    )

    expect(
      await screen.findByText(
        'Project operation failed: Disk is full',
      ),
    ).toBeInTheDocument()
  })
})