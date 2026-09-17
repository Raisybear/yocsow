import './SeedMapWorkspace.css'

export function SeedMapWorkspace() {
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
        <small>Interactive map</small>
      </header>

      <div className="seed-map-workspace-empty">
        <div className="seed-map-workspace-grid" aria-hidden="true" />
        <strong>Map workspace ready</strong>
        <p>The seed renderer will be added in the next step.</p>
      </div>
    </section>
  )
}
