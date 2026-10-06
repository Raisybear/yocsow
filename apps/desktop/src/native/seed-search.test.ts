import { describe, expect, it } from 'vitest'
import { requireMinecraftJavaReleaseId } from '../domain/minecraft-version'
import type { SearchRequirement } from '../domain/search-requirements'
import { createSeedSearchRequest } from './seed-search'

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
