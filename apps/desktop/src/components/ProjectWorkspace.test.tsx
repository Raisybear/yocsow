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
import { SearchRequirementsPanel } from './SearchRequirementsPanel'

vi.mock('../native/projects', () => ({
  PROJECT_FORMAT_VERSION: 3,
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

      <SearchRequirementsPanel
        requirements={workspace.project.searchRequirements}
        onChange={workspace.updateSearchRequirements}
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
          formatVersion: 3,
          name: 'Loaded world',
          searchRequirements: [
            {
              kind: 'structure',
              id: 'loaded-village',
              structureType: 'village',
              center: {
                x: 120,
                z: -340,
              },
              radiusBlocks: 750,
            },
          ],
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

    expect(screen.getByLabelText('X coordinate')).toHaveValue('120')
    expect(screen.getByLabelText('Z coordinate')).toHaveValue('-340')
    expect(screen.getByLabelText('Radius in blocks')).toHaveValue(
      '750',
    )
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
        formatVersion: 3,
        name: 'Survival world',
        searchRequirements: [],
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

  it('tracks and saves village search requirements', async () => {
    const user = userEvent.setup()

    selectProjectSavePathMock.mockResolvedValue({
      status: 'selected',
      value: '/projects/Village search.yocsow',
    })

    render(<WorkspaceHarness />)

    const projectName = screen.getByLabelText('Project name')

    await user.clear(projectName)
    await user.type(projectName, 'Village search')

    await user.click(
      screen.getByRole('button', {
        name: 'Add requirement',
      }),
    )

    const xCoordinate = screen.getByLabelText('X coordinate')
    const zCoordinate = screen.getByLabelText('Z coordinate')
    const radius = screen.getByLabelText('Radius in blocks')

    await user.clear(xCoordinate)
    await user.type(xCoordinate, '120')

    await user.clear(zCoordinate)
    await user.type(zCoordinate, '-340')

    await user.clear(radius)
    await user.type(radius, '750')

    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    )

    expect(saveLocalProjectMock).toHaveBeenCalledWith(
      '/projects/Village search.yocsow',
      {
        formatVersion: 3,
        name: 'Village search',
        searchRequirements: [
          {
            kind: 'structure',
            id: expect.any(String),
            structureType: 'village',
            center: {
              x: 120,
              z: -340,
            },
            radiusBlocks: 750,
          },
        ],
      },
    )

    expect(
      await screen.findByText('Project saved.'),
    ).toBeInTheDocument()
  })

  it('saves an opened project without another dialog', async () => {
    const user = userEvent.setup()

    openLocalProjectMock.mockResolvedValue({
      status: 'selected',
      value: {
        path: '/projects/Existing.yocsow',
        project: {
          formatVersion: 3,
          name: 'Existing',
          searchRequirements: [],
        },
      },
    })

    render(<WorkspaceHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Open',
      }),
    )

    const projectName = await screen.findByLabelText('Project name')

    await user.clear(projectName)
    await user.type(projectName, 'Existing updated')

    await user.click(
      screen.getByRole('button', {
        name: 'Save',
      }),
    )

    expect(selectProjectSavePathMock).not.toHaveBeenCalled()

    expect(saveLocalProjectMock).toHaveBeenCalledWith(
      '/projects/Existing.yocsow',
      {
        formatVersion: 3,
        name: 'Existing updated',
        searchRequirements: [],
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
          formatVersion: 3,
          name: 'Original',
          searchRequirements: [],
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
        formatVersion: 3,
        name: 'Original',
        searchRequirements: [],
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
