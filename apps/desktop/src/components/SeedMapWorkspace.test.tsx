import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { SeedMapWorkspace } from './SeedMapWorkspace'

function SeedMapHarness() {
  const [seed, setSeed] = useState('42')

  return (
    <SeedMapWorkspace
      seed={seed}
      onRandomize={() => {
        setSeed('99')
      }}
    />
  )
}

describe('SeedMapWorkspace', () => {
  it('renders a seed map and replaces its seed on request', async () => {
    const user = userEvent.setup()

    render(<SeedMapHarness />)

    expect(
      screen.getByRole('img', {
        name: 'Terrain preview for seed 42',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('list', { name: 'Map legend' }),
    ).toBeInTheDocument()

    await user.click(
      screen.getByRole('button', { name: 'New seed' }),
    )

    expect(
      screen.getByRole('img', {
        name: 'Terrain preview for seed 99',
      }),
    ).toBeInTheDocument()
  })
})
