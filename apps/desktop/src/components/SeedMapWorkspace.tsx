import { useMemo, useRef, useState, type DragEvent } from 'react'
import type { SearchRequirement } from '../domain/search-requirements'
import {
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
}

export function SeedMapWorkspace({
  seed,
  requirements,
  onRandomize,
  onFilterDrop,
}: SeedMapWorkspaceProps) {
  const model = useMemo(() => createSeedMap(seed), [seed])
  const dragDepth = useRef(0)
  const [dropActive, setDropActive] = useState(false)

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

    if (!Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) {
      return
    }

    const bounds = event.currentTarget.getBoundingClientRect()

    if (bounds.width <= 0 || bounds.height <= 0) {
      return
    }

    onFilterDrop(
      filterId,
      mapRatiosToBlockPosition(
        model,
        (event.clientX - bounds.left) / bounds.width,
        (event.clientY - bounds.top) / bounds.height,
      ),
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
        className={
          dropActive
            ? 'seed-map-viewport seed-map-viewport--drop-active'
            : 'seed-map-viewport'
        }
        aria-label="Seed map drop area"
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <SeedMapCanvas model={model} requirements={requirements} />

        <div className="seed-map-drop-message" aria-hidden="true">
          Drop filter at this position
        </div>

        <div className="seed-map-search-area-note">
          Rings show search radius
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
