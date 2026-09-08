import { invoke, isTauri } from '@tauri-apps/api/core'
import type {
  SearchRequirement,
  StructureType,
} from '../domain/search-requirements'
import type { SeedRangeQuery } from './seed-range'

const MINIMUM_SIGNED_64_BIT_INTEGER = BigInt(
  '-9223372036854775808',
)
const MAXIMUM_SIGNED_64_BIT_INTEGER = BigInt(
  '9223372036854775807',
)
const MAXIMUM_SEEDS_PER_BATCH = 10_000
const MAXIMUM_RESULTS = 100

export interface SeedSearchPosition {
  x: string
  z: string
}

export interface SeedSearchRequirement {
  id: string
  structureType: StructureType
  center: SeedSearchPosition
  radiusBlocks: string
}

export interface SeedSearchRequest {
  firstSeed: string
  seedCount: number
  minecraftVersion: '1.21'
  requirements: SeedSearchRequirement[]
  resultLimit: number
}

export interface StructureMatch {
  requirementId: string
  structureType: StructureType
  targetCenter: SeedSearchPosition
  radiusBlocks: string
  actualPosition: SeedSearchPosition
  distanceBlocks: number
  normalizedDistance: number
}

export interface SeedSearchCandidate {
  seed: string
  totalRequirementCount: number
  matchedRequirementCount: number
  matchesAllRequirements: boolean
  matchRatio: number
  averageNormalizedDistance: number
  matches: StructureMatch[]
}

export interface SeedSearchResult {
  searchedSeedCount: number
  candidates: SeedSearchCandidate[]
}

function parseSigned64BitInteger(
  name: string,
  value: string,
): bigint {
  const normalizedValue = value.trim()

  if (!/^-?\d+$/.test(normalizedValue)) {
    throw new Error(
      `${name} must be a signed 64-bit integer.`,
    )
  }

  const parsedValue = BigInt(normalizedValue)

  if (
    parsedValue < MINIMUM_SIGNED_64_BIT_INTEGER ||
    parsedValue > MAXIMUM_SIGNED_64_BIT_INTEGER
  ) {
    throw new Error(
      `${name} must be a signed 64-bit integer.`,
    )
  }

  return parsedValue
}

function validateResultLimit(resultLimit: number): void {
  if (
    !Number.isInteger(resultLimit) ||
    resultLimit <= 0 ||
    resultLimit > MAXIMUM_RESULTS
  ) {
    throw new Error(
      `Result limit must be between 1 and ${MAXIMUM_RESULTS}.`,
    )
  }
}

export function createSeedSearchRequest(
  seedRange: SeedRangeQuery,
  requirements: SearchRequirement[],
  resultLimit: number,
): SeedSearchRequest {
  const minimum = parseSigned64BitInteger(
    'Minimum seed',
    seedRange.minimum,
  )
  const maximum = parseSigned64BitInteger(
    'Maximum seed',
    seedRange.maximum,
  )

  if (minimum > maximum) {
    throw new Error(
      'Minimum seed must not be greater than maximum seed.',
    )
  }

  const seedCount = maximum - minimum + BigInt(1)

  if (seedCount > BigInt(MAXIMUM_SEEDS_PER_BATCH)) {
    throw new Error(
      `Seed range must not contain more than ${MAXIMUM_SEEDS_PER_BATCH} seeds.`,
    )
  }

  if (requirements.length === 0) {
    throw new Error(
      'Add at least one search requirement before searching.',
    )
  }

  validateResultLimit(resultLimit)

  return {
    firstSeed: minimum.toString(),
    seedCount: Number(seedCount),
    minecraftVersion: '1.21',
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      structureType: requirement.structureType,
      center: {
        x: String(requirement.center.x),
        z: String(requirement.center.z),
      },
      radiusBlocks: String(requirement.radiusBlocks),
    })),
    resultLimit,
  }
}

export async function searchSeeds(
  request: SeedSearchRequest,
): Promise<SeedSearchResult | null> {
  if (!isTauri()) {
    return null
  }

  return invoke<SeedSearchResult>('search_seeds', {
    firstSeed: request.firstSeed,
    seedCount: request.seedCount,
    minecraftVersion: request.minecraftVersion,
    requirements: request.requirements,
    resultLimit: request.resultLimit,
  })
}