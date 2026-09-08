import { describe, expect, it } from 'vitest'
import {
  createVillageRequirement,
  DEFAULT_VILLAGE_RADIUS_BLOCKS,
  type SearchRequirement,
} from './search-requirements'

describe('search requirements', () => {
  it('creates a village requirement with useful defaults', () => {
    const requirement = createVillageRequirement('village-1')

    expect(requirement).toEqual({
      kind: 'structure',
      id: 'village-1',
      structureType: 'village',
      center: {
        x: 0,
        z: 0,
      },
      radiusBlocks: DEFAULT_VILLAGE_RADIUS_BLOCKS,
    })
  })

  it('normalizes requirement identifiers', () => {
    const requirement = createVillageRequirement('  village-1  ')

    expect(requirement.id).toBe('village-1')
  })

  it('rejects blank requirement identifiers', () => {
    expect(() => createVillageRequirement('   ')).toThrow(
      'Requirement ID must not be blank.',
    )
  })

  it('can be represented by the extensible requirement union', () => {
    const requirement: SearchRequirement =
      createVillageRequirement('village-1')

    expect(requirement.kind).toBe('structure')
    expect(requirement.structureType).toBe('village')
  })
})