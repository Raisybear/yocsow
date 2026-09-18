import { memo } from 'react'
import type { SeedMapModel } from '../domain/seed-map'
import { blockPositionToMapPoint } from '../domain/seed-map'
import type { SearchRequirement } from '../domain/search-requirements'
import { SEED_MAP_BIOME_COLORS } from './seed-map-presentation'

interface SeedMapCanvasProps {
  model: SeedMapModel
  requirements: SearchRequirement[]
}

export const SeedMapCanvas = memo(function SeedMapCanvas({
  model,
  requirements,
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

      {requirements.map((requirement) => {
        const point = blockPositionToMapPoint(model, requirement.center)
        const label = requirementMarkerLabel(requirement)

        return (
          <g
            className={`seed-map-marker seed-map-marker--${requirement.kind}`}
            transform={`translate(${point.x} ${point.y})`}
            role="img"
            aria-label={label}
            key={requirement.id}
          >
            <title>{label}</title>
            <circle className="seed-map-marker-halo" r={1.25} />
            {requirement.kind === 'biome' ? (
              <circle className="seed-map-marker-symbol" r={0.68} />
            ) : (
              <path
                className="seed-map-marker-symbol"
                d="M 0 -0.82 L 0.82 0 L 0 0.82 L -0.82 0 Z"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
})

function requirementMarkerLabel(requirement: SearchRequirement): string {
  const name =
    requirement.kind === 'biome'
      ? 'Taiga'
      : requirement.structureType === 'village'
        ? 'Village'
        : 'Ruined Portal'

  return `${name} filter at X ${requirement.center.x}, Z ${requirement.center.z}`
}
