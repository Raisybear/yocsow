import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  seedRangeContains,
  type SeedRangeQuery,
} from '../native/seed-range'
import { SeedRangePanel } from './SeedRangePanel'

vi.mock('../native/seed-range', () => ({
  seedRangeContains: vi.fn(),
}))

const seedRangeContainsMock = vi.mocked(seedRangeContains)

const initialSeedRange: SeedRangeQuery = {
  minimum: '-10',
  maximum: '10',
  seed: '0',
}

function SeedRangeHarness() {
  const [seedRange, setSeedRange] =
    useState<SeedRangeQuery>(initialSeedRange)

  function updateSeedRange(
    field: keyof SeedRangeQuery,
    value: string,
  ): void {
    setSeedRange((currentSeedRange) => ({
      ...currentSeedRange,
      [field]: value,
    }))
  }

  return (
    <SeedRangePanel
      seedRange={seedRange}
      onChange={updateSeedRange}
    />
  )
}

describe('SeedRangePanel', () => {
  beforeEach(() => {
    seedRangeContainsMock.mockReset()
    seedRangeContainsMock.mockReturnValue(new Promise(() => {}))
  })

  it('submits the full signed 64-bit seed range unchanged', async () => {
    const user = userEvent.setup()

    seedRangeContainsMock.mockResolvedValue({
      contains: true,
    })

    render(<SeedRangeHarness />)

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

    render(<SeedRangeHarness />)

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

    render(<SeedRangeHarness />)

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

    render(<SeedRangeHarness />)

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