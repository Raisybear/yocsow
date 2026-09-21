import {
  useMemo,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
  type PointerEvent,
} from 'react'
import type { SearchRequirement } from '../domain/search-requirements'
import {
  clampBlockPositionToMap,
  createSeedMap,
  mapRatiosToBlockPosition,
  type SeedMapPosition,
} from '../domain/seed-map'
import { SeedMapCanvas } from './SeedMapCanvas'
import {
  containsDraggedFilter,
  readDraggedFilterId,
} from './seed-map-drag'
import { SEED_MAP_LEGEND } from './seed-map-presentation'
import './SeedMapWorkspace.css'

interface SeedMapWorkspaceProps {
  seed: string
  requirements: SearchRequirement[]
  onRandomize: () => void
  onFilterDrop: (filterId: string, position: SeedMapPosition) => void
  onRequirementMove: (
    requirementId: string,
    position: SeedMapPosition,
  ) => void
}

interface MarkerDragState {
  requirementId: string
  pointerId: number
  offset: SeedMapPosition
}

export function SeedMapWorkspace({
  seed,
  requirements,
  onRandomize,
  onFilterDrop,
  onRequirementMove,
}: SeedMapWorkspaceProps) {
  const model = useMemo(() => createSeedMap(seed), [seed])
  const viewportRef = useRef<HTMLDivElement>(null)
  const dragDepth = useRef(0)
  const markerDrag = useRef<MarkerDragState | undefined>(undefined)
  const [dropActive, setDropActive] = useState(false)
  const [draggingRequirementId, setDraggingRequirementId] =
    useState<string>()

  function clientPointToMapPosition(
    clientX: number,
    clientY: number,
  ): SeedMapPosition | undefined {
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY)) {
      return undefined
    }

    const bounds = viewportRef.current?.getBoundingClientRect()

    if (bounds === undefined || bounds.width <= 0 || bounds.height <= 0) {
      return undefined
    }

    return mapRatiosToBlockPosition(
      model,
      (clientX - bounds.left) / bounds.width,
      (clientY - bounds.top) / bounds.height,
    )
  }

  function handleDragEnter(event: DragEvent<HTMLDivElement>): void {
    if (!containsDraggedFilter(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    dragDepth.current++
    setDropActive(true)
  }

  function handleDragLeave(): void {
    dragDepth.current = Math.max(0, dragDepth.current - 1)

    if (dragDepth.current === 0) {
      setDropActive(false)
    }
  }

  function handleDragOver(event: DragEvent<HTMLDivElement>): void {
    if (!containsDraggedFilter(event.dataTransfer)) {
      return
    }

    event.preventDefault()
    event.dataTransfer.dropEffect = 'copy'
  }

  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault()
    dragDepth.current = 0
    setDropActive(false)

    const filterId = readDraggedFilterId(event.dataTransfer)

    if (filterId === undefined) {
      return
    }

    const position = clientPointToMapPosition(event.clientX, event.clientY)

    if (position === undefined) {
      return
    }

    onFilterDrop(filterId, position)
  }

  function handleMarkerPointerDown(
    requirementId: string,
    event: PointerEvent<SVGGElement>,
  ): void {
    if (event.button !== 0) {
      return
    }

    const requirement = requirements.find(
      (candidate) => candidate.id === requirementId,
    )
    const pointerPosition = clientPointToMapPosition(
      event.clientX,
      event.clientY,
    )

    if (requirement === undefined || pointerPosition === undefined) {
      return
    }

    event.preventDefault()
    event.stopPropagation()

    markerDrag.current = {
      requirementId,
      pointerId: event.pointerId,
      offset: {
        x: requirement.center.x - pointerPosition.x,
        z: requirement.center.z - pointerPosition.z,
      },
    }
    setDraggingRequirementId(requirementId)

    const viewport = viewportRef.current

    if (viewport !== null && typeof viewport.setPointerCapture === 'function') {
      viewport.setPointerCapture(event.pointerId)
    }
  }

  function handleMarkerPointerMove(
    event: PointerEvent<HTMLDivElement>,
  ): void {
    const activeDrag = markerDrag.current

    if (activeDrag === undefined || activeDrag.pointerId !== event.pointerId) {
      return
    }

    const pointerPosition = clientPointToMapPosition(
      event.clientX,
      event.clientY,
    )

    if (pointerPosition === undefined) {
      return
    }

    event.preventDefault()
    onRequirementMove(
      activeDrag.requirementId,
      clampBlockPositionToMap(model, {
        x: pointerPosition.x + activeDrag.offset.x,
        z: pointerPosition.z + activeDrag.offset.z,
      }),
    )
  }

  function finishMarkerDrag(pointerId: number): void {
    const activeDrag = markerDrag.current

    if (activeDrag === undefined || activeDrag.pointerId !== pointerId) {
      return
    }

    markerDrag.current = undefined
    setDraggingRequirementId(undefined)

    const viewport = viewportRef.current

    if (
      viewport !== null &&
      typeof viewport.hasPointerCapture === 'function' &&
      viewport.hasPointerCapture(pointerId)
    ) {
      viewport.releasePointerCapture(pointerId)
    }
  }

  function handleMarkerKeyDown(
    requirementId: string,
    event: KeyboardEvent<SVGGElement>,
  ): void {
    const requirement = requirements.find(
      (candidate) => candidate.id === requirementId,
    )

    if (requirement === undefined) {
      return
    }

    const step = event.shiftKey ? model.blocksPerCell : 16
    const delta = markerKeyDelta(event.key, step)

    if (delta === undefined) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    onRequirementMove(
      requirementId,
      clampBlockPositionToMap(model, {
        x: requirement.center.x + delta.x,
        z: requirement.center.z + delta.z,
      }),
    )
  }

  return (
    <section
      id="seed-map-workspace"
      className="seed-map-workspace"
      aria-labelledby="seed-map-title"
    >
      <header className="seed-map-workspace-heading">
        <div>
          <span>World preview</span>
          <h3 id="seed-map-title">Seed 2D map</h3>
        </div>
        <div className="seed-map-workspace-actions">
          <span className="seed-map-value">Seed {seed}</span>
          <button type="button" onClick={onRandomize}>
            New seed
          </button>
        </div>
      </header>

      <div
        ref={viewportRef}
        className={
          draggingRequirementId !== undefined
            ? 'seed-map-viewport seed-map-viewport--moving'
            : dropActive
            ? 'seed-map-viewport seed-map-viewport--drop-active'
            : 'seed-map-viewport'
        }
        aria-label="Seed map drop area"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPointerMove={handleMarkerPointerMove}
        onPointerUp={(event) => {
          finishMarkerDrag(event.pointerId)
        }}
        onPointerCancel={(event) => {
          finishMarkerDrag(event.pointerId)
        }}
        onLostPointerCapture={(event) => {
          finishMarkerDrag(event.pointerId)
        }}
      >
        <SeedMapCanvas
          model={model}
          requirements={requirements}
          draggingRequirementId={draggingRequirementId}
          onMarkerPointerDown={handleMarkerPointerDown}
          onMarkerKeyDown={handleMarkerKeyDown}
        />

        <div className="seed-map-drop-message" aria-hidden="true">
          Drop filter at this position
        </div>

        <div className="seed-map-search-area-note">
          Drag markers · rings show radius
        </div>

        <div className="seed-map-coordinate seed-map-coordinate--north">
          Z {model.minimumZ}
        </div>
        <div className="seed-map-coordinate seed-map-coordinate--south">
          Z {model.minimumZ + model.rows * model.blocksPerCell}
        </div>
        <div className="seed-map-coordinate seed-map-coordinate--west">
          X {model.minimumX}
        </div>
        <div className="seed-map-coordinate seed-map-coordinate--east">
          X {model.minimumX + model.columns * model.blocksPerCell}
        </div>

        <ul className="seed-map-legend" aria-label="Map legend">
          {SEED_MAP_LEGEND.map(([biome, color]) => (
            <li key={biome}>
              <span style={{ backgroundColor: color }} aria-hidden="true" />
              {biome}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function markerKeyDelta(
  key: string,
  step: number,
): SeedMapPosition | undefined {
  switch (key) {
    case 'ArrowLeft':
      return { x: -step, z: 0 }
    case 'ArrowRight':
      return { x: step, z: 0 }
    case 'ArrowUp':
      return { x: 0, z: -step }
    case 'ArrowDown':
      return { x: 0, z: step }
    default:
      return undefined
  }
}
