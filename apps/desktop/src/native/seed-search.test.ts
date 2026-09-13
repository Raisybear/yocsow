import { describe, expect, it } from 'vitest'
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

describe('continuous seed search request', () => {
  it('serializes the search start and requirements for Rust', () => {
    const request = createSeedSearchRequest(
      BigInt(-25_000),
      requirements,
      20,
    )

    expect(request.firstSeed).toBe('-25000')
    expect(request.minecraftVersion).toBe('1.21')
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
        requirements,
        20,
      ),
    ).toThrow(
      'First seed must be a signed 64-bit integer.',
    )
  })
})
