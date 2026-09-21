import { describe, expect, it } from 'vitest'
import {
  blockPositionToMapPoint,
  blockRadiusToMapUnits,
  clampBlockPositionToMap,
  createRandomSeed,
  createSeedMap,
  mapRatiosToBlockPosition,
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

  it('maps between viewport ratios and block coordinates', () => {
    const model = createSeedMap('42')

    expect(mapRatiosToBlockPosition(model, 0.5, 0.5)).toEqual({
      x: 0,
      z: 0,
    })
    expect(mapRatiosToBlockPosition(model, 0.75, 0.25)).toEqual({
      x: 768,
      z: -512,
    })
    expect(mapRatiosToBlockPosition(model, -1, 2)).toEqual({
      x: -1536,
      z: 1024,
    })
    expect(blockPositionToMapPoint(model, { x: 768, z: -512 })).toEqual({
      x: 36,
      y: 8,
    })
  })

  it('converts block radii into safe map units', () => {
    const model = createSeedMap('42')

    expect(blockRadiusToMapUnits(model, 1_000)).toBe(15.625)
    expect(blockRadiusToMapUnits(model, 128)).toBe(2)
    expect(blockRadiusToMapUnits(model, -20)).toBe(0)
    expect(blockRadiusToMapUnits(model, Number.NaN)).toBe(0)
  })

  it('keeps moved markers inside the visible map', () => {
    const model = createSeedMap('42')

    expect(
      clampBlockPositionToMap(model, { x: -2_000, z: 2_000 }),
    ).toEqual({ x: -1_536, z: 1_024 })
    expect(
      clampBlockPositionToMap(model, { x: 123.6, z: -456.4 }),
    ).toEqual({ x: 124, z: -456 })
  })
})
