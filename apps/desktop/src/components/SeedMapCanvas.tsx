import {
  memo,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import {
  blockPositionToMapPoint,
  blockRadiusToMapUnits,
  type SeedMapModel,
  type SeedMapPoint,
} from '../domain/seed-map'
import {
  searchRequirementRadiusBlocks,
  type SearchRequirement,
} from '../domain/search-requirements'
import { SEED_MAP_BIOME_COLORS } from './seed-map-presentation'

interface SeedMapCanvasProps {
  model: SeedMapModel
  requirements: SearchRequirement[]
  draggingRequirementId?: string
  onMarkerPointerDown: (
    requirementId: string,
    event: PointerEvent<SVGGElement>,
  ) => void
  onMarkerKeyDown: (
    requirementId: string,
    event: KeyboardEvent<SVGGElement>,
  ) => void
}

export const SeedMapCanvas = memo(function SeedMapCanvas({
  model,
  requirements,
  draggingRequirementId,
  onMarkerPointerDown,
  onMarkerKeyDown,
}: SeedMapCanvasProps) {
  const overlays = requirements.map((requirement) =>
    createRequirementOverlay(model, requirement),
  )

  return (
    <svg
      className="seed-map-canvas"
      viewBox={`0 0 ${model.columns} ${model.rows}`}
      preserveAspectRatio="none"
      role="group"
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

      {overlays.map(({ point, radiusMapUnits, requirement }) => (
        <circle
          className={`seed-map-search-area seed-map-search-area--${requirement.kind}`}
          cx={point.x}
          cy={point.y}
          r={radiusMapUnits}
          data-requirement-id={requirement.id}
          vectorEffect="non-scaling-stroke"
          aria-hidden="true"
          key={`area:${requirement.id}`}
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

      {overlays.map(({ point, radiusBlocks, requirement }) => {
        const label = requirementMarkerLabel(requirement, radiusBlocks)

        return (
          <g
            className={
              draggingRequirementId === requirement.id
                ? `seed-map-marker seed-map-marker--${requirement.kind} seed-map-marker--dragging`
                : `seed-map-marker seed-map-marker--${requirement.kind}`
            }
            transform={`translate(${point.x} ${point.y})`}
            data-requirement-id={requirement.id}
            role="button"
            tabIndex={0}
            aria-label={`Move ${label}`}
            onPointerDown={(event) => {
              onMarkerPointerDown(requirement.id, event)
            }}
            onKeyDown={(event) => {
              onMarkerKeyDown(requirement.id, event)
            }}
            key={requirement.id}
          >
            <title>Drag to move {label}</title>
            <circle className="seed-map-marker-hit-target" r={1.15} />
            <circle
              className="seed-map-marker-halo"
              r={requirement.kind === 'biome' ? 0.2 : 0.46}
            />
            {requirement.kind === 'biome' ? (
              <circle className="seed-map-marker-symbol" r={0.1} />
            ) : (
              <path
                className="seed-map-marker-symbol"
                d="M 0 -0.32 L 0.32 0 L 0 0.32 L -0.32 0 Z"
              />
            )}
          </g>
        )
      })}
    </svg>
  )
})

interface RequirementOverlay {
  point: SeedMapPoint
  radiusBlocks: number
  radiusMapUnits: number
  requirement: SearchRequirement
}

function createRequirementOverlay(
  model: SeedMapModel,
  requirement: SearchRequirement,
): RequirementOverlay {
  const radiusBlocks = searchRequirementRadiusBlocks(requirement)

  return {
    point: blockPositionToMapPoint(model, requirement.center),
    radiusBlocks,
    radiusMapUnits: blockRadiusToMapUnits(model, radiusBlocks),
    requirement,
  }
}

function requirementMarkerLabel(
  requirement: SearchRequirement,
  radiusBlocks: number,
): string {
  const name =
    requirement.kind === 'biome'
      ? 'Taiga'
      : requirement.structureType === 'village'
        ? 'Village'
        : requirement.structureType === 'ruinedPortal'
          ? 'Ruined Portal'
          : 'Woodland Mansion'

  return `${name} filter at X ${requirement.center.x}, Z ${requirement.center.z} with ${radiusBlocks} block search radius`
}
