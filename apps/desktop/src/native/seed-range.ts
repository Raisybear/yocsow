import { invoke, isTauri } from '@tauri-apps/api/core'

export interface SeedRangeQuery {
  minimum: string
  maximum: string
  seed: string
}

export interface SeedRangeResult {
  contains: boolean
}

export async function seedRangeContains(
  query: SeedRangeQuery,
): Promise<SeedRangeResult | null> {
  if (!isTauri()) {
    return null
  }

  return invoke<SeedRangeResult>('seed_range_contains', {
    minimum: query.minimum,
    maximum: query.maximum,
    seed: query.seed,
  })
}