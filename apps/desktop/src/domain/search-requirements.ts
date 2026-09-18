export const DEFAULT_STRUCTURE_RADIUS_BLOCKS = 1_000

export type StructureType = 'village' | 'ruinedPortal'
export type BiomeType = 'taiga'

export const BIOME_SIZE_OPTIONS = [
  { value: 'tiny', label: 'Tiny', radiusBlocks: 16 },
  { value: 'small', label: 'Small', radiusBlocks: 32 },
  { value: 'big', label: 'Big', radiusBlocks: 64 },
  { value: 'gigantic', label: 'Gigantic', radiusBlocks: 128 },
  { value: 'enormous', label: 'Enormous', radiusBlocks: 256 },
] as const

export type BiomeSize = (typeof BIOME_SIZE_OPTIONS)[number]['value']

export interface BlockPosition {
  x: number
  z: number
}

export interface StructureRequirement {
  kind: 'structure'
  id: string
  structureType: StructureType
  center: BlockPosition
  radiusBlocks: number
}

export interface BiomeRequirement {
  kind: 'biome'
  id: string
  biomeType: BiomeType
  center: BlockPosition
  size: BiomeSize
}

export type SearchRequirement = StructureRequirement | BiomeRequirement

function normalizeRequirementId(id: string): string {
  const normalizedId = id.trim()

  if (normalizedId.length === 0) {
    throw new Error('Requirement ID must not be blank.')
  }

  return normalizedId
}

export function createVillageRequirement(
  id: string,
): StructureRequirement {
  return createStructureRequirement(id, 'village')
}

export function createRuinedPortalRequirement(
  id: string,
): StructureRequirement {
  return createStructureRequirement(id, 'ruinedPortal')
}

export function createStructureRequirement(
  id: string,
  structureType: StructureType,
): StructureRequirement {
  return {
    kind: 'structure',
    id: normalizeRequirementId(id),
    structureType,
    center: {
      x: 0,
      z: 0,
    },
    radiusBlocks: DEFAULT_STRUCTURE_RADIUS_BLOCKS,
  }
}

export function createBiomeRequirement(
  id: string,
  biomeType: BiomeType,
): BiomeRequirement {
  return {
    kind: 'biome',
    id: normalizeRequirementId(id),
    biomeType,
    center: { x: 0, z: 0 },
    size: 'big',
  }
}

export function biomeSizeRadiusBlocks(size: BiomeSize): number {
  const option = BIOME_SIZE_OPTIONS.find(
    (candidate) => candidate.value === size,
  )

  if (option === undefined) {
    throw new Error(`Unsupported biome size: ${String(size)}`)
  }

  return option.radiusBlocks
}

export function searchRequirementRadiusBlocks(
  requirement: SearchRequirement,
): number {
  return requirement.kind === 'structure'
    ? requirement.radiusBlocks
    : biomeSizeRadiusBlocks(requirement.size)
}
