import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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
})
