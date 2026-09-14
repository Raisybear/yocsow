import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getAppInfo } from '../native/app-info'
import { getEngineStatus } from '../native/engine-status'
import { SettingsWorkspace } from './SettingsWorkspace'

vi.mock('../native/app-info', () => ({
  getAppInfo: vi.fn(),
}))

vi.mock('../native/engine-status', () => ({
  getEngineStatus: vi.fn(),
}))

const getAppInfoMock = vi.mocked(getAppInfo)
const getEngineStatusMock = vi.mocked(getEngineStatus)

function SettingsHarness() {
  const [resultLimit, setResultLimit] = useState('20')

  return (
    <>
      <SettingsWorkspace
        resultLimit={resultLimit}
        onResultLimitChange={setResultLimit}
        projectName="Mountain search"
        projectPath="/projects/mountain.yocsow"
        projectDirty={true}
      />

      <output data-testid="result-limit-state">
        {resultLimit}
      </output>
    </>
  )
}

describe('SettingsWorkspace', () => {
  beforeEach(() => {
    getAppInfoMock.mockReset()
    getEngineStatusMock.mockReset()

    getAppInfoMock.mockReturnValue(new Promise(() => {}))
    getEngineStatusMock.mockReturnValue(new Promise(() => {}))
  })

  it('opens with the general settings tab selected', () => {
    render(<SettingsHarness />)

    expect(
      screen.getByRole('tab', { name: /General/i }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('heading', { name: 'General' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Fixed desktop workspace')).toBeInTheDocument()
  })

  it('updates the shared seed search result limit', async () => {
    const user = userEvent.setup()

    render(<SettingsHarness />)

    await user.click(screen.getByRole('tab', { name: /Search/i }))

    const resultLimit = screen.getByLabelText('Default result limit')
    await user.clear(resultLimit)
    await user.type(resultLimit, '35')

    expect(resultLimit).toHaveValue(35)
    expect(screen.getByTestId('result-limit-state')).toHaveTextContent(
      '35',
    )
  })

  it('shows live runtime diagnostics in the engine tab', async () => {
    const user = userEvent.setup()

    getAppInfoMock.mockResolvedValue({
      name: 'YOCSOW',
      version: '0.1.0',
      platform: 'linux',
      architecture: 'x86_64',
    })
    getEngineStatusMock.mockResolvedValue({
      status: 'ready',
      initialized: true,
      engineVersion: '0.1.0',
      protocolVersion: 1,
    })

    render(<SettingsHarness />)

    await user.click(screen.getByRole('tab', { name: /Engine/i }))

    expect(
      await screen.findByText(/Native bridge operational/),
    ).toBeInTheDocument()
    expect(
      await screen.findByText(/Java engine operational/),
    ).toBeInTheDocument()
  })

  it('summarizes local project storage without hiding changes', async () => {
    const user = userEvent.setup()

    render(<SettingsHarness />)

    await user.click(screen.getByRole('tab', { name: /Storage/i }))

    expect(screen.getByText('Mountain search')).toBeInTheDocument()
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument()
    expect(
      screen.getByText('/projects/mountain.yocsow'),
    ).toBeInTheDocument()
  })
})
