export const DEFAULT_VILLAGE_RADIUS_BLOCKS = 1_000

export type StructureType = 'village'

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

export type SearchRequirement = StructureRequirement

export function createVillageRequirement(
  id: string,
): StructureRequirement {
  const normalizedId = id.trim()

  if (normalizedId.length === 0) {
    throw new Error('Requirement ID must not be blank.')
  }

  return {
    kind: 'structure',
    id: normalizedId,
    structureType: 'village',
    center: {
      x: 0,
      z: 0,
    },
    radiusBlocks: DEFAULT_VILLAGE_RADIUS_BLOCKS,
  }
}