import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { searchSeeds } from '../native/seed-search'
import type { SeedRangeQuery } from '../native/seed-range'
import { SeedFinderPanel } from './SeedFinderPanel'

vi.mock('../native/seed-search', async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import('../native/seed-search')
    >()

  return {
    ...original,
    searchSeeds: vi.fn(),
  }
})

const searchSeedsMock = vi.mocked(searchSeeds)

const seedRange: SeedRangeQuery = {
  minimum: '0',
  maximum: '4',
  seed: '0',
}

const requirements = [
  {
    kind: 'structure' as const,
    id: 'spawn-village',
    structureType: 'village' as const,
    center: {
      x: 0,
      z: 0,
    },
    radiusBlocks: 1_000,
  },
]

describe('SeedFinderPanel', () => {
  beforeEach(() => {
    searchSeedsMock.mockReset()
    searchSeedsMock.mockReturnValue(new Promise(() => {}))
  })

  it('searches the inclusive range and displays matches', async () => {
    const user = userEvent.setup()

    searchSeedsMock.mockResolvedValue({
      searchedSeedCount: 5,
      candidates: [
        {
          seed: '4',
          totalRequirementCount: 1,
          matchedRequirementCount: 1,
          matchesAllRequirements: true,
          matchRatio: 1,
          averageNormalizedDistance: 0.46427578011350107,
          matches: [
            {
              requirementId: 'spawn-village',
              structureType: 'village',
              targetCenter: {
                x: '0',
                z: '0',
              },
              radiusBlocks: '1000',
              actualPosition: {
                x: '-464',
                z: '16',
              },
              distanceBlocks: 464.27578011350107,
              normalizedDistance: 0.46427578011350107,
            },
          ],
        },
      ],
    })

    render(
      <SeedFinderPanel
        seedRange={seedRange}
        requirements={requirements}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Search seeds',
      }),
    )

    expect(searchSeedsMock).toHaveBeenCalledWith({
      firstSeed: '0',
      seedCount: 5,
      minecraftVersion: '1.21',
      requirements: [
        {
          id: 'spawn-village',
          structureType: 'village',
          center: {
            x: '0',
            z: '0',
          },
          radiusBlocks: '1000',
        },
      ],
      resultLimit: 20,
    })

    expect(
      await screen.findByText(
        'Searched 5 seeds and found 1 candidates.',
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Seed 4')).toBeInTheDocument()
    expect(
      screen.getByText('X -464, Z 16'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Distance: 464.3 blocks'),
    ).toBeInTheDocument()
  })

  it('rejects ranges larger than the engine batch limit', async () => {
    const user = userEvent.setup()

    render(
      <SeedFinderPanel
        seedRange={{
          minimum: '0',
          maximum: '10000',
          seed: '0',
        }}
        requirements={requirements}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Search seeds',
      }),
    )

    expect(searchSeedsMock).not.toHaveBeenCalled()
    expect(
      await screen.findByText(
        'Seed search failed: Seed range must not contain more than 10000 seeds.',
      ),
    ).toBeInTheDocument()
  })

  it('requires at least one search requirement', () => {
    render(
      <SeedFinderPanel
        seedRange={seedRange}
        requirements={[]}
      />,
    )

    expect(
      screen.getByRole('button', {
        name: 'Search seeds',
      }),
    ).toBeDisabled()
    expect(
      screen.getByText(
        'Add at least one search requirement to start.',
      ),
    ).toBeInTheDocument()
  })

  it('explains that searches require Tauri', async () => {
    const user = userEvent.setup()

    searchSeedsMock.mockResolvedValue(null)

    render(
      <SeedFinderPanel
        seedRange={seedRange}
        requirements={requirements}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Search seeds',
      }),
    )

    expect(
      await screen.findByText(
        'Seed searches require the native Tauri application.',
      ),
    ).toBeInTheDocument()
  })

  it('shows errors returned by the native search', async () => {
    const user = userEvent.setup()

    searchSeedsMock.mockRejectedValue(
      new Error('Native locator unavailable'),
    )

    render(
      <SeedFinderPanel
        seedRange={seedRange}
        requirements={requirements}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Search seeds',
      }),
    )

    expect(
      await screen.findByText(
        'Seed search failed: Native locator unavailable',
      ),
    ).toBeInTheDocument()
  })
})