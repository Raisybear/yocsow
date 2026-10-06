import { invoke, isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type { MinecraftJavaReleaseId } from '../domain/minecraft-version'
import type {
  BiomeType,
  SearchRequirement,
  StructureType,
} from '../domain/search-requirements'
import { biomeSizeRadiusBlocks } from '../domain/search-requirements'

const MINIMUM_SIGNED_64_BIT_INTEGER = BigInt(
  '-9223372036854775808',
)
const MAXIMUM_SIGNED_64_BIT_INTEGER = BigInt(
  '9223372036854775807',
)
const MAXIMUM_RESULTS = 100
const SEED_SEARCH_PROGRESS_EVENT = 'seed-search-progress'

export interface SeedSearchPosition {
  x: string
  z: string
}

export interface SeedSearchRequirement {
  id: string
  structureType: StructureType | BiomeType
  center: SeedSearchPosition
  radiusBlocks: string
}

export interface SeedSearchRequest {
  firstSeed: string
  minecraftVersion: MinecraftJavaReleaseId
  requirements: SeedSearchRequirement[]
  resultLimit: number
}

export interface StructureMatch {
  requirementId: string
  structureType: StructureType | BiomeType
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

export interface SeedSearchProgress {
  searchedSeedCount: string
  candidates: SeedSearchCandidate[]
  elapsedMilliseconds: number
}

export interface SeedSearchResult extends SeedSearchProgress {
  reason: 'limit' | 'stopped' | 'exhausted'
}

interface SeedSearchProgressEvent extends SeedSearchProgress {
  searchId: string
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

export function createRandomSearchStart(): bigint {
  const words = new Uint32Array(2)
  globalThis.crypto.getRandomValues(words)

  const unsignedSeed =
    (BigInt(words[0]) << BigInt(32)) | BigInt(words[1])

  return BigInt.asIntN(64, unsignedSeed)
}

export function createSeedSearchRequest(
  firstSeed: bigint,
  minecraftVersion: MinecraftJavaReleaseId,
  requirements: SearchRequirement[],
  resultLimit: number,
): SeedSearchRequest {
  if (
    firstSeed < MINIMUM_SIGNED_64_BIT_INTEGER ||
    firstSeed > MAXIMUM_SIGNED_64_BIT_INTEGER
  ) {
    throw new Error('First seed must be a signed 64-bit integer.')
  }

  if (requirements.length === 0) {
    throw new Error(
      'Add at least one search requirement before searching.',
    )
  }

  validateResultLimit(resultLimit)

  return {
    firstSeed: firstSeed.toString(),
    minecraftVersion,
    requirements: requirements.map((requirement) => ({
      id: requirement.id,
      structureType:
        requirement.kind === 'structure'
          ? requirement.structureType
          : requirement.biomeType,
      center: {
        x: String(requirement.center.x),
        z: String(requirement.center.z),
      },
      radiusBlocks: String(
        requirement.kind === 'structure'
          ? requirement.radiusBlocks
          : biomeSizeRadiusBlocks(requirement.size),
      ),
    })),
    resultLimit,
  }
}

export async function searchSeedBatches(
  request: SeedSearchRequest,
  onProgress: (progress: SeedSearchProgress) => void,
): Promise<SeedSearchResult | null> {
  if (!isTauri()) {
    return null
  }

  const searchId = globalThis.crypto.randomUUID()
  const unlisten = await listen<SeedSearchProgressEvent>(
    SEED_SEARCH_PROGRESS_EVENT,
    (event) => {
      if (event.payload.searchId === searchId) {
        onProgress({
          searchedSeedCount: event.payload.searchedSeedCount,
          candidates: event.payload.candidates,
          elapsedMilliseconds: event.payload.elapsedMilliseconds,
        })
      }
    },
  )

  try {
    return await invoke<SeedSearchResult>('search_seed_batches', {
      searchId,
      firstSeed: request.firstSeed,
      minecraftVersion: request.minecraftVersion,
      requirements: request.requirements,
      resultLimit: request.resultLimit,
    })
  } finally {
    unlisten()
  }
}

export async function stopSeedSearch(): Promise<boolean> {
  if (!isTauri()) {
    return false
  }

  return invoke<boolean>('stop_seed_search')
}
