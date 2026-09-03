import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getAppInfo } from './native/app-info'
import { getEngineStatus } from './native/engine-status'

vi.mock('./native/app-info', () => ({
  getAppInfo: vi.fn(),
}))

vi.mock('./native/engine-status', () => ({
  getEngineStatus: vi.fn(),
}))

const getAppInfoMock = vi.mocked(getAppInfo)
const getEngineStatusMock = vi.mocked(getEngineStatus)

describe('App', () => {
  beforeEach(() => {
    getAppInfoMock.mockReset()
    getEngineStatusMock.mockReset()

    getAppInfoMock.mockReturnValue(new Promise(() => {}))
    getEngineStatusMock.mockReturnValue(new Promise(() => {}))
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
})
