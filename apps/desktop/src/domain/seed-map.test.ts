import { describe, expect, it } from 'vitest'
import {
  createRandomSeed,
  createSeedMap,
  SEED_MAP_BIOMES,
  SEED_MAP_BLOCKS_PER_CELL,
  SEED_MAP_COLUMNS,
  SEED_MAP_ROWS,
} from './seed-map'

describe('seed map', () => {
  it('creates a deterministic map for a signed 64-bit seed', () => {
    const firstMap = createSeedMap('-9223372036854775808')
    const secondMap = createSeedMap('-9223372036854775808')

    expect(secondMap).toEqual(firstMap)
    expect(firstMap.columns).toBe(SEED_MAP_COLUMNS)
    expect(firstMap.rows).toBe(SEED_MAP_ROWS)
    expect(firstMap.blocksPerCell).toBe(SEED_MAP_BLOCKS_PER_CELL)
    expect(firstMap.cells).toHaveLength(SEED_MAP_COLUMNS * SEED_MAP_ROWS)
    expect(
      firstMap.cells.every((cell) =>
        SEED_MAP_BIOMES.includes(cell.biome),
      ),
    ).toBe(true)
  })

  it('changes the generated terrain when the seed changes', () => {
    const firstBiomes = createSeedMap('42').cells.map(
      (cell) => cell.biome,
    )
    const secondBiomes = createSeedMap('43').cells.map(
      (cell) => cell.biome,
    )

    expect(secondBiomes).not.toEqual(firstBiomes)
  })

  it('creates signed seeds from cryptographic random words', () => {
    expect(
      createRandomSeed((values) => {
        values[0] = 0
        values[1] = 42
      }),
    ).toBe('42')

    expect(
      createRandomSeed((values) => {
        values[0] = 0xffffffff
        values[1] = 0xffffffff
      }),
    ).toBe('-1')
  })
})
