import { describe, expect, it } from 'vitest'
import {
  biomeSizeRadiusBlocks,
  createBiomeRequirement,
  createRuinedPortalRequirement,
  createVillageRequirement,
  DEFAULT_STRUCTURE_RADIUS_BLOCKS,
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
      radiusBlocks: DEFAULT_STRUCTURE_RADIUS_BLOCKS,
    })
  })

  it('creates a ruined portal requirement with structure defaults', () => {
    expect(createRuinedPortalRequirement('portal-1')).toEqual({
      kind: 'structure',
      id: 'portal-1',
      structureType: 'ruinedPortal',
      center: { x: 0, z: 0 },
      radiusBlocks: DEFAULT_STRUCTURE_RADIUS_BLOCKS,
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

  it('creates a taiga requirement with a useful default size', () => {
    expect(createBiomeRequirement('taiga-1', 'taiga')).toEqual({
      kind: 'biome',
      id: 'taiga-1',
      biomeType: 'taiga',
      center: { x: 0, z: 0 },
      size: 'big',
    })
  })

  it('maps semantic biome sizes to minimum radii', () => {
    expect(biomeSizeRadiusBlocks('tiny')).toBe(16)
    expect(biomeSizeRadiusBlocks('small')).toBe(32)
    expect(biomeSizeRadiusBlocks('big')).toBe(64)
    expect(biomeSizeRadiusBlocks('gigantic')).toBe(128)
    expect(biomeSizeRadiusBlocks('enormous')).toBe(256)
  })
})
