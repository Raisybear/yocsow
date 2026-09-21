import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getAppInfo } from './native/app-info'
import { getEngineStatus } from './native/engine-status'
import {
  createRandomSearchStart,
  searchSeedBatches,
  stopSeedSearch,
} from './native/seed-search'

vi.mock('./native/app-info', () => ({
  getAppInfo: vi.fn(),
}))

vi.mock('./native/engine-status', () => ({
  getEngineStatus: vi.fn(),
}))

vi.mock('./native/seed-search', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./native/seed-search')>()

  return {
    ...original,
    createRandomSearchStart: vi.fn(),
    searchSeedBatches: vi.fn(),
    stopSeedSearch: vi.fn(),
  }
})

const getAppInfoMock = vi.mocked(getAppInfo)
const getEngineStatusMock = vi.mocked(getEngineStatus)
const createRandomSearchStartMock = vi.mocked(
  createRandomSearchStart,
)
const searchSeedBatchesMock = vi.mocked(searchSeedBatches)
const stopSeedSearchMock = vi.mocked(stopSeedSearch)

describe('App', () => {
  beforeEach(() => {
    getAppInfoMock.mockReset()
    getEngineStatusMock.mockReset()
    createRandomSearchStartMock.mockReset()
    searchSeedBatchesMock.mockReset()
    stopSeedSearchMock.mockReset()

    getAppInfoMock.mockReturnValue(new Promise(() => {}))
    getEngineStatusMock.mockReturnValue(new Promise(() => {}))
    createRandomSearchStartMock.mockReturnValue(BigInt(0))
    searchSeedBatchesMock.mockReturnValue(new Promise(() => {}))
    stopSeedSearchMock.mockResolvedValue(true)
  })

  it('renders the fixed workspace shell with the seed finder active', () => {
    render(<App />)

    expect(screen.getByText('YOCSOW')).toBeInTheDocument()
    expect(
      screen.getByRole('navigation', { name: 'Workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Seed finder' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Seed filters' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Seed Finder/i }),
    ).toHaveAttribute('aria-current', 'page')

    const navigationButtons = within(
      screen.getByRole('navigation', { name: 'Workspace' }),
    ).getAllByRole('button')

    expect(navigationButtons).toHaveLength(4)
    expect(navigationButtons[0]).toHaveAccessibleName(/Project/i)
    expect(navigationButtons[1]).toHaveAccessibleName(/Seed Finder/i)
    expect(navigationButtons[2]).toHaveAccessibleName(/World Editor/i)
    expect(navigationButtons[3]).toHaveAccessibleName(/Settings/i)
  })

  it('supports keyboard resizing for workspace panels', async () => {
    const user = userEvent.setup()

    render(<App />)

    const separator = screen.getByRole('separator', {
      name: 'Resize navigation',
    })

    expect(separator).toHaveAttribute('aria-valuenow', '13')
    separator.focus()
    await user.keyboard('{ArrowRight}')
    expect(separator).toHaveAttribute('aria-valuenow', '15')
    await user.keyboard('{ArrowLeft}')
    expect(separator).toHaveAttribute('aria-valuenow', '13')
  })

  it('switches between workspace views without duplicating panels', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /Project/i }),
    )

    expect(
      screen.getByRole('heading', { name: 'Project management' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Project workspace' }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'Seed filters' }),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Project/i }),
    ).toHaveAttribute('aria-current', 'page')
  })

  it('provides the editor placeholder and settings workspace', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /World Editor/i }),
    )
    expect(
      screen.getByRole('heading', {
        name: 'World editing tools will live here',
      }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Settings/i }),
    )
    expect(
      screen.getByRole('heading', {
        name: 'General',
      }),
    ).toBeInTheDocument()
  })

  it('keeps search preferences when navigating between views', async () => {
    const user = userEvent.setup()

    render(<App />)

    await user.click(
      screen.getByRole('button', { name: /Settings/i }),
    )
    await user.click(screen.getByRole('tab', { name: /Search/i }))

    const defaultResultLimit = screen.getByLabelText(
      'Default result limit',
    )
    await user.clear(defaultResultLimit)
    await user.type(defaultResultLimit, '35')

    await user.click(
      screen.getByRole('button', { name: /Seed Finder/i }),
    )

    expect(screen.getByLabelText('Result limit')).toHaveValue('35')
  })

  it('keeps seed search results when navigating between views', async () => {
    const user = userEvent.setup()

    searchSeedBatchesMock.mockResolvedValue({
      searchedSeedCount: '1000',
      elapsedMilliseconds: 125,
      reason: 'stopped',
      candidates: [],
    })

    render(<App />)

    await user.click(
      screen.getByRole('button', { name: 'Add Village filter' }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Search seeds' }),
    )

    const completedSearch = await screen.findByText(
      /Search stopped\. Checked 1,000 seeds/,
    )
    expect(completedSearch).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: /Project/i }),
    )
    await user.click(
      screen.getByRole('button', { name: /Seed Finder/i }),
    )

    expect(
      screen.getByText(/Search stopped\. Checked 1,000 seeds/),
    ).toBeInTheDocument()
    expect(searchSeedBatchesMock).toHaveBeenCalledTimes(1)
  })

  it('keeps the project seed map when navigating between views', async () => {
    const user = userEvent.setup()

    render(<App />)

    const toggle = screen.getByRole('switch', {
      name: 'Toggle Seed 2D Map',
    })
    await user.click(toggle)

    const renderedSeed = screen.getByText(/^Seed -?\d+$/).textContent

    await user.click(
      screen.getByRole('button', { name: /Project/i }),
    )
    await user.click(
      screen.getByRole('button', { name: /Seed Finder/i }),
    )

    expect(
      screen.getByRole('switch', { name: 'Toggle Seed 2D Map' }),
    ).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(renderedSeed ?? '')).toBeInTheDocument()
  })
})
