export const SEED_MAP_COLUMNS = 48
export const SEED_MAP_ROWS = 32
export const SEED_MAP_BLOCKS_PER_CELL = 64

export const SEED_MAP_BIOMES = [
  'ocean',
  'plains',
  'forest',
  'taiga',
  'desert',
  'mountains',
  'swamp',
] as const

export type SeedMapBiome = (typeof SEED_MAP_BIOMES)[number]

export interface SeedMapCell {
  biome: SeedMapBiome
  x: number
  z: number
}

export interface SeedMapModel {
  seed: string
  columns: number
  rows: number
  blocksPerCell: number
  minimumX: number
  minimumZ: number
  cells: SeedMapCell[]
}

export interface SeedMapPosition {
  x: number
  z: number
}

export interface SeedMapSettings {
  visible: boolean
  seed: string
}

export interface SeedMapPoint {
  x: number
  y: number
}

type RandomValueFiller = (values: Uint32Array<ArrayBuffer>) => void

const UINT32_RANGE = 0x1_0000_0000
const BIT_SHIFT_32 = BigInt(32)

export function createRandomSeed(
  fillRandomValues: RandomValueFiller = (values) => {
    globalThis.crypto.getRandomValues(values)
  },
): string {
  const words = new Uint32Array(new ArrayBuffer(2 * Uint32Array.BYTES_PER_ELEMENT))
  fillRandomValues(words)

  const unsignedSeed =
    (BigInt(words[0]) << BIT_SHIFT_32) | BigInt(words[1])

  return BigInt.asIntN(64, unsignedSeed).toString()
}

export function createSeedMap(seed: string): SeedMapModel {
  const parsedSeed = BigInt(seed)
  const minimumX =
    -(SEED_MAP_COLUMNS / 2) * SEED_MAP_BLOCKS_PER_CELL
  const minimumZ =
    -(SEED_MAP_ROWS / 2) * SEED_MAP_BLOCKS_PER_CELL
  const cells: SeedMapCell[] = []

  for (let row = 0; row < SEED_MAP_ROWS; row++) {
    for (let column = 0; column < SEED_MAP_COLUMNS; column++) {
      const x = minimumX + column * SEED_MAP_BLOCKS_PER_CELL
      const z = minimumZ + row * SEED_MAP_BLOCKS_PER_CELL

      cells.push({
        biome: samplePreviewBiome(parsedSeed, column, row),
        x,
        z,
      })
    }
  }

  return {
    seed: parsedSeed.toString(),
    columns: SEED_MAP_COLUMNS,
    rows: SEED_MAP_ROWS,
    blocksPerCell: SEED_MAP_BLOCKS_PER_CELL,
    minimumX,
    minimumZ,
    cells,
  }
}

export function mapRatiosToBlockPosition(
  model: SeedMapModel,
  horizontalRatio: number,
  verticalRatio: number,
): SeedMapPosition {
  const clampedHorizontalRatio = clamp(horizontalRatio, 0, 1)
  const clampedVerticalRatio = clamp(verticalRatio, 0, 1)

  return {
    x: Math.round(
      model.minimumX +
        clampedHorizontalRatio *
          model.columns *
          model.blocksPerCell,
    ),
    z: Math.round(
      model.minimumZ +
        clampedVerticalRatio * model.rows * model.blocksPerCell,
    ),
  }
}

export function blockPositionToMapPoint(
  model: SeedMapModel,
  position: SeedMapPosition,
): SeedMapPoint {
  return {
    x: (position.x - model.minimumX) / model.blocksPerCell,
    y: (position.z - model.minimumZ) / model.blocksPerCell,
  }
}

export function clampBlockPositionToMap(
  model: SeedMapModel,
  position: SeedMapPosition,
): SeedMapPosition {
  const maximumX =
    model.minimumX + model.columns * model.blocksPerCell
  const maximumZ = model.minimumZ + model.rows * model.blocksPerCell

  return {
    x: Math.round(clamp(position.x, model.minimumX, maximumX)),
    z: Math.round(clamp(position.z, model.minimumZ, maximumZ)),
  }
}

export function blockRadiusToMapUnits(
  model: SeedMapModel,
  radiusBlocks: number,
): number {
  if (!Number.isFinite(radiusBlocks)) {
    return 0
  }

  return Math.max(0, radiusBlocks) / model.blocksPerCell
}

function samplePreviewBiome(
  seed: bigint,
  column: number,
  row: number,
): SeedMapBiome {
  const continentalness = octaveNoise(seed, column, row, 0x4f1bbcdc)
  const temperature = octaveNoise(seed, column, row, 0x6d2b79f5)
  const moisture = octaveNoise(seed, column, row, 0x1b873593)

  if (continentalness < 0.32) {
    return 'ocean'
  }

  if (continentalness > 0.78) {
    return 'mountains'
  }

  if (moisture > 0.73 && continentalness < 0.58) {
    return 'swamp'
  }

  if (temperature > 0.66 && moisture < 0.47) {
    return 'desert'
  }

  if (temperature < 0.38) {
    return 'taiga'
  }

  if (moisture > 0.52) {
    return 'forest'
  }

  return 'plains'
}

function octaveNoise(
  seed: bigint,
  x: number,
  z: number,
  salt: number,
): number {
  return (
    interpolatedNoise(seed, x, z, 12, salt) * 0.55 +
    interpolatedNoise(seed, x, z, 6, salt ^ 0x85ebca6b) * 0.3 +
    interpolatedNoise(seed, x, z, 3, salt ^ 0xc2b2ae35) * 0.15
  )
}

function interpolatedNoise(
  seed: bigint,
  x: number,
  z: number,
  scale: number,
  salt: number,
): number {
  const gridX = Math.floor(x / scale)
  const gridZ = Math.floor(z / scale)
  const fractionX = smoothStep((x % scale) / scale)
  const fractionZ = smoothStep((z % scale) / scale)
  const top = interpolate(
    hashNoise(seed, gridX, gridZ, salt),
    hashNoise(seed, gridX + 1, gridZ, salt),
    fractionX,
  )
  const bottom = interpolate(
    hashNoise(seed, gridX, gridZ + 1, salt),
    hashNoise(seed, gridX + 1, gridZ + 1, salt),
    fractionX,
  )

  return interpolate(top, bottom, fractionZ)
}

function hashNoise(
  seed: bigint,
  x: number,
  z: number,
  salt: number,
): number {
  const lowSeed = Number(BigInt.asUintN(32, seed))
  const highSeed = Number(BigInt.asUintN(32, seed >> BIT_SHIFT_32))
  let hash = lowSeed ^ Math.imul(highSeed, 0x9e3779b1) ^ salt

  hash = Math.imul(hash ^ Math.imul(x, 0x85ebca6b), 0xc2b2ae35)
  hash = Math.imul(hash ^ Math.imul(z, 0x27d4eb2f), 0x165667b1)
  hash ^= hash >>> 15
  hash = Math.imul(hash, 0x85ebca6b)
  hash ^= hash >>> 13

  return (hash >>> 0) / UINT32_RANGE
}

function smoothStep(value: number): number {
  return value * value * (3 - 2 * value)
}

function interpolate(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum)
}
