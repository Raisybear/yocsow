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
    {
      id: 'taiga-1',
      kind: 'biome',
      biomeType: 'taiga',
      center: { x: -256, z: 128 },
      size: 'gigantic',
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

    const { container } = render(<SeedMapHarness />)

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
        name: 'Village filter at X 64, Z -128 with 1000 block search radius',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('img', {
        name: 'Taiga filter at X -256, Z 128 with 128 block search radius',
      }),
    ).toBeInTheDocument()
    expect(screen.getByText('Rings show search radius')).toBeInTheDocument()

    expect(
      container.querySelector(
        '.seed-map-search-area[data-requirement-id="village-1"]',
      ),
    ).toHaveAttribute('r', '15.625')
    expect(
      container.querySelector(
        '.seed-map-search-area[data-requirement-id="taiga-1"]',
      ),
    ).toHaveAttribute('r', '2')

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
