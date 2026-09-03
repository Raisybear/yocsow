import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { getAppInfo } from './native/app-info'

vi.mock('./native/app-info', () => ({
  getAppInfo: vi.fn(),
}))

const getAppInfoMock = vi.mocked(getAppInfo)

describe('App', () => {
  beforeEach(() => {
    getAppInfoMock.mockReset()
    getAppInfoMock.mockReturnValue(new Promise(() => {}))
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

  it('shows the native connection state initially', () => {
    render(<App />)

    expect(
      screen.getByText('Connecting to native bridge'),
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

    await screen.findByText('Native bridge operational')

    expect(screen.getByRole('status')).toHaveTextContent(
      'linux · x86_64 · v0.1.0',
    )
  })

  it('supports running the frontend as a browser preview', async () => {
    getAppInfoMock.mockResolvedValue(null)

    render(<App />)

    await screen.findByText('Browser preview active')

    expect(screen.getByRole('status')).toHaveTextContent(
      'native commands require Tauri',
    )
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
})
