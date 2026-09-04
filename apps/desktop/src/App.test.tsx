import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getAppInfo } from './native/app-info'
import { getEngineStatus } from './native/engine-status'
import { seedRangeContains } from './native/seed-range'

vi.mock('./native/app-info', () => ({
  getAppInfo: vi.fn(),
}))

vi.mock('./native/engine-status', () => ({
  getEngineStatus: vi.fn(),
}))

vi.mock('./native/seed-range', () => ({
  seedRangeContains: vi.fn(),
}))

const getAppInfoMock = vi.mocked(getAppInfo)
const getEngineStatusMock = vi.mocked(getEngineStatus)
const seedRangeContainsMock = vi.mocked(seedRangeContains)

describe('App', () => {
  beforeEach(() => {
    getAppInfoMock.mockReset()
    getEngineStatusMock.mockReset()
    seedRangeContainsMock.mockReset()

    getAppInfoMock.mockReturnValue(new Promise(() => {}))
    getEngineStatusMock.mockReturnValue(new Promise(() => {}))
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
      screen.getByRole('button', { name: 'Check seed' }),
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
      screen.getByRole('button', { name: 'Check seed' }),
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

  it('explains that seed queries require Tauri in browser previews', async () => {
    const user = userEvent.setup()

    seedRangeContainsMock.mockResolvedValue(null)

    render(<App />)

    await user.click(
      screen.getByRole('button', { name: 'Check seed' }),
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
      new Error(
        'minimum must not be greater than maximum',
      ),
    )

    render(<App />)

    await user.click(
      screen.getByRole('button', { name: 'Check seed' }),
    )

    expect(
      await screen.findByText(
        'Seed query failed: minimum must not be greater than maximum',
      ),
    ).toBeInTheDocument()
  })
})