import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { SearchRequirement } from '../domain/search-requirements'
import { SeedMapWorkspace } from './SeedMapWorkspace'

function SeedMapHarness() {
  const [seed, setSeed] = useState('42')
  const requirements: SearchRequirement[] = [
    {
      id: 'village-1',
      kind: 'structure',
      structureType: 'village',
      center: { x: 64, z: -128 },
      radiusBlocks: 1000,
    },
  ]

  return (
    <SeedMapWorkspace
      seed={seed}
      requirements={requirements}
      onRandomize={() => {
        setSeed('99')
      }}
      onFilterDrop={() => {}}
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
    expect(
      screen.getByRole('img', {
        name: 'Village filter at X 64, Z -128',
      }),
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
