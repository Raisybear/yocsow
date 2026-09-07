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
})