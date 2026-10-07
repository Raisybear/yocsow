import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { requireMinecraftJavaReleaseId } from '../domain/minecraft-version'
import type { SearchRequirement } from '../domain/search-requirements'
import {
  createSeedSearchRequest,
  searchSeedBatches,
  type SeedSearchResult,
} from './seed-search'

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
  isTauri: vi.fn(),
}))

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(),
}))

const invokeMock = vi.mocked(invoke)
const isTauriMock = vi.mocked(isTauri)
const listenMock = vi.mocked(listen)

const requirements: SearchRequirement[] = [
  {
    kind: 'structure',
    id: 'village-1',
    structureType: 'village',
    center: { x: 0, z: 0 },
    radiusBlocks: 1_000,
  },
]
const defaultMinecraftVersion = requireMinecraftJavaReleaseId('1.21')

const stoppedResult: SeedSearchResult = {
  searchedSeedCount: '10000',
  candidates: [],
  elapsedMilliseconds: 250,
  reason: 'stopped',
}

beforeEach(() => {
  invokeMock.mockReset()
  isTauriMock.mockReset()
  listenMock.mockReset()

  isTauriMock.mockReturnValue(true)
  listenMock.mockResolvedValue(vi.fn())
})

describe('continuous seed search request', () => {
  it('serializes the search start and requirements for Rust', () => {
    const request = createSeedSearchRequest(
      BigInt(-25_000),
      requireMinecraftJavaReleaseId('1.20.6'),
      requirements,
      20,
    )

    expect(request.firstSeed).toBe('-25000')
    expect(request.minecraftVersion).toBe('1.20.6')
    expect(request.resultLimit).toBe(20)
    expect(request.requirements).toEqual([
      {
        id: 'village-1',
        structureType: 'village',
        center: { x: '0', z: '0' },
        radiusBlocks: '1000',
      },
    ])
  })

  it('rejects search starts outside the signed 64-bit space', () => {
    expect(() =>
      createSeedSearchRequest(
        BigInt('9223372036854775808'),
        defaultMinecraftVersion,
        requirements,
        20,
      ),
    ).toThrow(
      'First seed must be a signed 64-bit integer.',
    )
  })

  it('serializes biome types and semantic sizes for the engine', () => {
    const request = createSeedSearchRequest(
      BigInt(42),
      defaultMinecraftVersion,
      [
        {
          kind: 'biome',
          id: 'taiga-1',
          biomeType: 'taiga',
          center: { x: 120, z: -340 },
          size: 'gigantic',
        },
      ],
      5,
    )

    expect(request.requirements).toEqual([
      {
        id: 'taiga-1',
        structureType: 'taiga',
        center: { x: '120', z: '-340' },
        radiusBlocks: '128',
      },
    ])
  })

  it('serializes ruined portal requirements for the engine', () => {
    const request = createSeedSearchRequest(
      BigInt(42),
      defaultMinecraftVersion,
      [
        {
          kind: 'structure',
          id: 'portal-1',
          structureType: 'ruinedPortal',
          center: { x: -800, z: 1200 },
          radiusBlocks: 640,
        },
      ],
      5,
    )

    expect(request.requirements).toEqual([
      {
        id: 'portal-1',
        structureType: 'ruinedPortal',
        center: { x: '-800', z: '1200' },
        radiusBlocks: '640',
      },
    ])
  })

  it('serializes woodland mansion requirements for the engine', () => {
    const request = createSeedSearchRequest(
      BigInt(42),
      defaultMinecraftVersion,
      [
        {
          kind: 'structure',
          id: 'mansion-1',
          structureType: 'woodlandMansion',
          center: { x: 4096, z: -2048 },
          radiusBlocks: 8000,
        },
      ],
      5,
    )

    expect(request.requirements).toEqual([
      {
        id: 'mansion-1',
        structureType: 'woodlandMansion',
        center: { x: '4096', z: '-2048' },
        radiusBlocks: '8000',
      },
    ])
  })

  it('serializes desert temple requirements for the engine', () => {
    const request = createSeedSearchRequest(
      BigInt(42),
      defaultMinecraftVersion,
      [
        {
          kind: 'structure',
          id: 'temple-1',
          structureType: 'desertTemple',
          center: { x: 1600, z: -3200 },
          radiusBlocks: 5000,
        },
      ],
      5,
    )

    expect(request.requirements).toEqual([
      {
        id: 'temple-1',
        structureType: 'desertTemple',
        center: { x: '1600', z: '-3200' },
        radiusBlocks: '5000',
      },
    ])
  })
})

describe('continuous seed search execution', () => {
  it('serializes native searches so versions cannot overlap', async () => {
    let finishFirstSearch: ((result: SeedSearchResult) => void) | undefined
    const firstResult = new Promise<SeedSearchResult>((resolve) => {
      finishFirstSearch = resolve
    })
    const firstRequest = createSeedSearchRequest(
      BigInt(0),
      requireMinecraftJavaReleaseId('1.21'),
      requirements,
      20,
    )
    const secondRequest = createSeedSearchRequest(
      BigInt(10_000),
      requireMinecraftJavaReleaseId('1.20.6'),
      requirements,
      20,
    )

    invokeMock
      .mockReturnValueOnce(firstResult)
      .mockResolvedValueOnce(stoppedResult)

    const firstSearch = searchSeedBatches(firstRequest, vi.fn())

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1)
    })

    const secondSearch = searchSeedBatches(secondRequest, vi.fn())

    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(invokeMock).toHaveBeenCalledTimes(1)

    finishFirstSearch?.(stoppedResult)

    await expect(firstSearch).resolves.toEqual(stoppedResult)
    await expect(secondSearch).resolves.toEqual(stoppedResult)

    expect(invokeMock).toHaveBeenCalledTimes(2)
    expect(invokeMock.mock.calls[0]?.[1]).toMatchObject({
      minecraftVersion: '1.21',
    })
    expect(invokeMock.mock.calls[1]?.[1]).toMatchObject({
      minecraftVersion: '1.20.6',
    })
  })

  it('does not start a queued search that became obsolete', async () => {
    let finishFirstSearch: ((result: SeedSearchResult) => void) | undefined
    const firstResult = new Promise<SeedSearchResult>((resolve) => {
      finishFirstSearch = resolve
    })
    const request = createSeedSearchRequest(
      BigInt(0),
      defaultMinecraftVersion,
      requirements,
      20,
    )

    invokeMock.mockReturnValueOnce(firstResult)

    const firstSearch = searchSeedBatches(request, vi.fn())

    await vi.waitFor(() => {
      expect(invokeMock).toHaveBeenCalledTimes(1)
    })

    const abortController = new AbortController()
    const obsoleteSearch = searchSeedBatches(request, vi.fn(), {
      signal: abortController.signal,
    })
    const obsoleteSearchResult = expect(obsoleteSearch).rejects.toMatchObject({
      name: 'AbortError',
    })

    abortController.abort()
    finishFirstSearch?.(stoppedResult)

    await expect(firstSearch).resolves.toEqual(stoppedResult)
    await obsoleteSearchResult
    expect(invokeMock).toHaveBeenCalledTimes(1)
  })
})
