import { useMemo } from 'react'
import { createSeedMap } from '../domain/seed-map'
import { SeedMapCanvas } from './SeedMapCanvas'
import { SEED_MAP_LEGEND } from './seed-map-presentation'
import './SeedMapWorkspace.css'

interface SeedMapWorkspaceProps {
  seed: string
  onRandomize: () => void
}

export function SeedMapWorkspace({
  seed,
  onRandomize,
}: SeedMapWorkspaceProps) {
  const model = useMemo(() => createSeedMap(seed), [seed])

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

      <div className="seed-map-viewport">
        <SeedMapCanvas model={model} />

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
