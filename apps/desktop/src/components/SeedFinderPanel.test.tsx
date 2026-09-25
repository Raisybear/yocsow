import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireMinecraftJavaReleaseId } from '../domain/minecraft-version'
import {
  createRandomSearchStart,
  searchSeedBatches,
  stopSeedSearch,
  type SeedSearchResult,
} from '../native/seed-search'
import { SeedFinderPanel } from './SeedFinderPanel'

vi.mock('../native/seed-search', async (importOriginal) => {
  const original =
    await importOriginal<
      typeof import('../native/seed-search')
    >()

  return {
    ...original,
    createRandomSearchStart: vi.fn(),
    searchSeedBatches: vi.fn(),
    stopSeedSearch: vi.fn(),
  }
})

const createRandomSearchStartMock = vi.mocked(
  createRandomSearchStart,
)
const searchSeedBatchesMock = vi.mocked(searchSeedBatches)
const stopSeedSearchMock = vi.mocked(stopSeedSearch)
const defaultMinecraftVersion = requireMinecraftJavaReleaseId('1.21')

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

const matchingResult: SeedSearchResult = {
  searchedSeedCount: '20000',
  elapsedMilliseconds: 1_250,
  reason: 'limit',
  candidates: [
    {
      seed: '10004',
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
}

describe('SeedFinderPanel', () => {
  beforeEach(() => {
    createRandomSearchStartMock.mockReset()
    searchSeedBatchesMock.mockReset()
    stopSeedSearchMock.mockReset()

    createRandomSearchStartMock.mockReturnValue(BigInt(0))
    searchSeedBatchesMock.mockReturnValue(new Promise(() => {}))
    stopSeedSearchMock.mockResolvedValue(true)
  })

  it('delegates the continuous search to one Rust backend request', async () => {
    const user = userEvent.setup()

    searchSeedBatchesMock.mockResolvedValue(matchingResult)

    render(
      <SeedFinderPanel
        minecraftVersion={requireMinecraftJavaReleaseId('1.20.6')}
        requirements={requirements}
      />,
    )

    const resultLimit = screen.getByLabelText('Result limit')
    await user.clear(resultLimit)
    await user.type(resultLimit, '1')
    await user.click(
      screen.getByRole('button', {
        name: 'Search seeds',
      }),
    )

    expect(
      await screen.findByText(
        /Result limit reached\. Checked 20,000 seeds and found 1\/1 complete matches/,
      ),
    ).toBeInTheDocument()

    expect(searchSeedBatchesMock).toHaveBeenCalledTimes(1)
    expect(searchSeedBatchesMock).toHaveBeenCalledWith(
      {
        firstSeed: '0',
        minecraftVersion: '1.20.6',
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
        resultLimit: 1,
      },
      expect.any(Function),
    )

    expect(screen.getByText('Seed 10004')).toBeInTheDocument()
    expect(screen.getByText('X -464, Z 16')).toBeInTheDocument()
    expect(
      screen.getByText('Distance: 464.3 blocks'),
    ).toBeInTheDocument()
  })

  it('shows progress snapshots emitted after native batches', async () => {
    const user = userEvent.setup()

    searchSeedBatchesMock.mockImplementation(
      (_request, onProgress) => {
        onProgress({
          searchedSeedCount: '10000',
          elapsedMilliseconds: 750,
          candidates: [
            {
              ...matchingResult.candidates[0],
              matchesAllRequirements: false,
              matchedRequirementCount: 1,
              totalRequirementCount: 2,
              matchRatio: 0.5,
            },
          ],
        })

        return new Promise(() => {})
      },
    )

    render(
      <SeedFinderPanel
        minecraftVersion={defaultMinecraftVersion}
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
        /Searching continuously… Checked 10,000 seeds, found 0\/20 complete matches/,
      ),
    ).toBeInTheDocument()
    expect(screen.getByText('Seed 10004')).toBeInTheDocument()
  })

  it('stops after the active engine batch completes', async () => {
    const user = userEvent.setup()
    let finishBatch: ((result: SeedSearchResult) => void) | undefined

    searchSeedBatchesMock.mockReturnValue(
      new Promise((resolve) => {
        finishBatch = resolve
      }),
    )

    render(
      <SeedFinderPanel
        minecraftVersion={defaultMinecraftVersion}
        requirements={requirements}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Search seeds',
      }),
    )

    await waitFor(() => {
      expect(searchSeedBatchesMock).toHaveBeenCalledTimes(1)
    })

    await user.click(
      screen.getByRole('button', {
        name: 'Stop search',
      }),
    )

    expect(
      screen.getByText('Stopping after the current batch…', {
        exact: false,
      }),
    ).toBeInTheDocument()

    finishBatch?.({
      searchedSeedCount: '10000',
      candidates: [],
      elapsedMilliseconds: 500,
      reason: 'stopped',
    })

    expect(
      await screen.findByText(
        /Search stopped\. Checked 10,000 seeds and found 0\/20 complete matches/,
      ),
    ).toBeInTheDocument()
    expect(searchSeedBatchesMock).toHaveBeenCalledTimes(1)
    expect(stopSeedSearchMock).toHaveBeenCalledTimes(1)
  })

  it('continues until enough seeds match every requirement', async () => {
    const user = userEvent.setup()
    const threeRequirements = [
      requirements[0],
      {
        ...requirements[0],
        id: 'second-village',
        center: { x: 9_000, z: 0 },
      },
      {
        ...requirements[0],
        id: 'third-village',
        center: { x: 28_123, z: 122_333 },
      },
    ]

    searchSeedBatchesMock.mockResolvedValue({
      ...matchingResult,
      candidates: [
        {
          ...matchingResult.candidates[0],
          totalRequirementCount: 3,
          matchedRequirementCount: 3,
          matchesAllRequirements: true,
          matchRatio: 1,
        },
      ],
    })

    render(
      <SeedFinderPanel
        minecraftVersion={defaultMinecraftVersion}
        requirements={threeRequirements}
      />,
    )

    const resultLimit = screen.getByLabelText('Result limit')
    await user.clear(resultLimit)
    await user.type(resultLimit, '1')
    await user.click(
      screen.getByRole('button', {
        name: 'Search seeds',
      }),
    )

    expect(
      await screen.findByText(
        /Result limit reached\. Checked 20,000 seeds and found 1\/1 complete matches/,
      ),
    ).toBeInTheDocument()
    expect(searchSeedBatchesMock).toHaveBeenCalledTimes(1)
    expect(screen.getByText('Seed 10004')).toBeInTheDocument()
    expect(screen.getByText('3/3 matched')).toBeInTheDocument()
  })

  it('displays candidates in the order returned by Rust', async () => {
    const user = userEvent.setup()
    const threeRequirements = [
      requirements[0],
      { ...requirements[0], id: 'second-village' },
      { ...requirements[0], id: 'third-village' },
    ]

    searchSeedBatchesMock.mockResolvedValueOnce({
      searchedSeedCount: '10000',
      elapsedMilliseconds: 500,
      reason: 'stopped',
      candidates: [
        {
          ...matchingResult.candidates[0],
          seed: '2',
          totalRequirementCount: 3,
          matchedRequirementCount: 2,
          matchesAllRequirements: false,
          matchRatio: 2 / 3,
        },
        {
          ...matchingResult.candidates[0],
          seed: '1',
          totalRequirementCount: 3,
          matchedRequirementCount: 1,
          matchesAllRequirements: false,
          matchRatio: 1 / 3,
        },
      ],
    })

    render(
      <SeedFinderPanel
        minecraftVersion={defaultMinecraftVersion}
        requirements={threeRequirements}
      />,
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Search seeds',
      }),
    )

    await screen.findByText('Seed 2')

    expect(
      screen
        .getAllByRole('heading', { level: 4 })
        .map((heading) => heading.textContent),
    ).toEqual(['Seed 2', 'Seed 1'])
  })

  it('requires at least one search requirement', () => {
    render(
      <SeedFinderPanel
        minecraftVersion={defaultMinecraftVersion}
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

    searchSeedBatchesMock.mockResolvedValue(null)

    render(
      <SeedFinderPanel
        minecraftVersion={defaultMinecraftVersion}
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

    searchSeedBatchesMock.mockRejectedValue(
      new Error('Native locator unavailable'),
    )

    render(
      <SeedFinderPanel
        minecraftVersion={defaultMinecraftVersion}
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
