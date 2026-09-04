import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getAppInfo } from './native/app-info'
import { getEngineStatus } from './native/engine-status'
import {
  openLocalProject,
  saveLocalProject,
  selectProjectSavePath,
} from './native/projects'
import { seedRangeContains } from './native/seed-range'

vi.mock('./native/app-info', () => ({
  getAppInfo: vi.fn(),
}))

vi.mock('./native/engine-status', () => ({
  getEngineStatus: vi.fn(),
}))

vi.mock('./native/projects', () => ({
  PROJECT_FORMAT_VERSION: 1,
  openLocalProject: vi.fn(),
  saveLocalProject: vi.fn(),
  selectProjectSavePath: vi.fn(),
}))

vi.mock('./native/seed-range', () => ({
  seedRangeContains: vi.fn(),
}))

const getAppInfoMock = vi.mocked(getAppInfo)
const getEngineStatusMock = vi.mocked(getEngineStatus)
const openLocalProjectMock = vi.mocked(openLocalProject)
const saveLocalProjectMock = vi.mocked(saveLocalProject)
const selectProjectSavePathMock = vi.mocked(
  selectProjectSavePath,
)
const seedRangeContainsMock = vi.mocked(seedRangeContains)

describe('App', () => {
  beforeEach(() => {
    getAppInfoMock.mockReset()
    getEngineStatusMock.mockReset()
    openLocalProjectMock.mockReset()
    saveLocalProjectMock.mockReset()
    selectProjectSavePathMock.mockReset()
    seedRangeContainsMock.mockReset()

    getAppInfoMock.mockReturnValue(new Promise(() => {}))
    getEngineStatusMock.mockReturnValue(new Promise(() => {}))
    openLocalProjectMock.mockResolvedValue({
      status: 'cancelled',
    })
    saveLocalProjectMock.mockResolvedValue()
    selectProjectSavePathMock.mockResolvedValue({
      status: 'cancelled',
    })
    seedRangeContainsMock.mockReturnValue(new Promise(() => {}))
  })

  it('renders the application identity', () => {
    render(<App />)

    expect(
      screen.getByRole('heading', {
        name: 'Your world. Your rules.',
      }),
    ).toBeInTheDocument()

    expect(screen.getByText('YOCSOW')).toBeInTheDocument()
  })

  it('shows the configured technology foundation', () => {
    render(<App />)

    expect(screen.getByText('React 19')).toBeInTheDocument()
    expect(screen.getByText('Vite 8')).toBeInTheDocument()
    expect(screen.getByText('Java 21')).toBeInTheDocument()
  })

  it('starts with a new local project', () => {
    render(<App />)

    expect(screen.getByLabelText('Project name')).toHaveValue(
      'Untitled project',
    )
    expect(screen.getByText('Not saved yet')).toBeInTheDocument()
    expect(screen.getByText('New project')).toBeInTheDocument()
  })

  it('marks edited projects as unsaved', async () => {
    const user = userEvent.setup()

    render(<App />)

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

    render(<App />)

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

    render(<App />)

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

    render(<App />)

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

    render(<App />)

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

    render(<App />)

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

    render(<App />)

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

    render(<App />)

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

    render(<App />)

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

  it('shows both connection states initially', () => {
    render(<App />)

    expect(
      screen.getByText('Connecting to native bridge'),
    ).toBeInTheDocument()

    expect(
      screen.getByText('Connecting to Java engine'),
    ).toBeInTheDocument()
  })

  it('shows information returned by the native bridge', async () => {
    getAppInfoMock.mockResolvedValue({
      name: 'YOCSOW',
      version: '0.1.0',
      platform: 'linux',
      architecture: 'x86_64',
    })

    render(<App />)

    const status = await screen.findByText('Native bridge operational')

    expect(status).toHaveTextContent('linux · x86_64 · v0.1.0')
  })

  it('shows information returned by the Java engine', async () => {
    getEngineStatusMock.mockResolvedValue({
      status: 'ok',
      initialized: true,
      protocolVersion: 1,
      engineVersion: '0.1.0-SNAPSHOT',
    })

    render(<App />)

    const status = await screen.findByText('Java engine operational')

    expect(status).toHaveTextContent(
      'v0.1.0-SNAPSHOT · protocol 1',
    )
  })

  it('supports running the frontend as a browser preview', async () => {
    getAppInfoMock.mockResolvedValue(null)
    getEngineStatusMock.mockResolvedValue(null)

    render(<App />)

    await screen.findByText('Browser preview active')

    expect(
      screen.getByText('Java engine requires Tauri'),
    ).toBeInTheDocument()
  })

  it('shows when the native bridge cannot be reached', async () => {
    getAppInfoMock.mockRejectedValue(
      new Error('Native bridge unavailable'),
    )

    render(<App />)

    expect(
      await screen.findByText('Native bridge unavailable'),
    ).toBeInTheDocument()
  })

  it('shows when the Java engine cannot be reached', async () => {
    getEngineStatusMock.mockRejectedValue(
      new Error('Java engine unavailable'),
    )

    render(<App />)

    expect(
      await screen.findByText('Java engine unavailable'),
    ).toBeInTheDocument()
  })

  it('submits the full signed 64-bit seed range unchanged', async () => {
    const user = userEvent.setup()

    seedRangeContainsMock.mockResolvedValue({
      contains: true,
    })

    render(<App />)

    const minimum = screen.getByLabelText('Minimum')
    const maximum = screen.getByLabelText('Maximum')
    const seed = screen.getByLabelText('Seed')

    await user.clear(minimum)
    await user.type(minimum, '-9223372036854775808')

    await user.clear(maximum)
    await user.type(maximum, '9223372036854775807')

    await user.clear(seed)
    await user.type(seed, '9223372036854775807')

    await user.click(
      screen.getByRole('button', {
        name: 'Check seed',
      }),
    )

    expect(seedRangeContainsMock).toHaveBeenCalledWith({
      minimum: '-9223372036854775808',
      maximum: '9223372036854775807',
      seed: '9223372036854775807',
    })

    expect(
      await screen.findByText('Seed is inside the selected range.'),
    ).toBeInTheDocument()
  })

  it('shows when a seed is outside the selected range', async () => {
    const user = userEvent.setup()

    seedRangeContainsMock.mockResolvedValue({
      contains: false,
    })

    render(<App />)

    await user.click(
      screen.getByRole('button', {
        name: 'Check seed',
      }),
    )

    expect(seedRangeContainsMock).toHaveBeenCalledWith({
      minimum: '-10',
      maximum: '10',
      seed: '0',
    })

    expect(
      await screen.findByText(
        'Seed is outside the selected range.',
      ),
    ).toBeInTheDocument()
  })

  it('explains that seed queries require Tauri', async () => {
    const user = userEvent.setup()

    seedRangeContainsMock.mockResolvedValue(null)

    render(<App />)

    await user.click(
      screen.getByRole('button', {
        name: 'Check seed',
      }),
    )

    expect(
      await screen.findByText(
        'Seed queries require the native Tauri application.',
      ),
    ).toBeInTheDocument()
  })

  it('shows errors returned by the native seed query', async () => {
    const user = userEvent.setup()

    seedRangeContainsMock.mockRejectedValue(
      new Error('minimum must not be greater than maximum'),
    )

    render(<App />)

    await user.click(
      screen.getByRole('button', {
        name: 'Check seed',
      }),
    )

    expect(
      await screen.findByText(
        'Seed query failed: minimum must not be greater than maximum',
      ),
    ).toBeInTheDocument()
  })
})