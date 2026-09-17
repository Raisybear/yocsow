import { memo } from 'react'
import type { SeedMapModel } from '../domain/seed-map'
import { SEED_MAP_BIOME_COLORS } from './seed-map-presentation'

interface SeedMapCanvasProps {
  model: SeedMapModel
}

export const SeedMapCanvas = memo(function SeedMapCanvas({
  model,
}: SeedMapCanvasProps) {
  return (
    <svg
      className="seed-map-canvas"
      viewBox={`0 0 ${model.columns} ${model.rows}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`Terrain preview for seed ${model.seed}`}
    >
      <title>Terrain preview for seed {model.seed}</title>

      {model.cells.map((cell, index) => (
        <rect
          x={index % model.columns}
          y={Math.floor(index / model.columns)}
          width={1.04}
          height={1.04}
          fill={SEED_MAP_BIOME_COLORS[cell.biome]}
          key={`${cell.x}:${cell.z}`}
        />
      ))}

      <line
        className="seed-map-axis"
        x1={model.columns / 2}
        x2={model.columns / 2}
        y1={0}
        y2={model.rows}
        vectorEffect="non-scaling-stroke"
      />
      <line
        className="seed-map-axis"
        x1={0}
        x2={model.columns}
        y1={model.rows / 2}
        y2={model.rows / 2}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  )
})
