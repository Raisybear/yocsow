import type { SeedMapBiome } from '../domain/seed-map'

export const SEED_MAP_BIOME_COLORS: Record<SeedMapBiome, string> = {
  ocean: '#255b78',
  plains: '#739b58',
  forest: '#286044',
  taiga: '#416b62',
  desert: '#c6a85e',
  mountains: '#7c8490',
  swamp: '#4e6848',
}

export const SEED_MAP_LEGEND = Object.entries(
  SEED_MAP_BIOME_COLORS,
) as Array<[SeedMapBiome, string]>
