import { ProjectWorkspace } from './components/ProjectWorkspace'
import { SearchRequirementsPanel } from './components/SearchRequirementsPanel'
import { SeedFinderPanel } from './components/SeedFinderPanel'
import { SystemStatus } from './components/SystemStatus'
import { useProjectWorkspace } from './hooks/useProjectWorkspace'
import './App.css'

const components = [
  { name: 'Frontend', technology: 'React 19' },
  { name: 'Build', technology: 'Vite 8' },
  { name: 'Engine', technology: 'Java 21' },
] as const

function App() {
  const workspace = useProjectWorkspace()

  return (
    <main className="app-shell">
      <section
        className="welcome-card"
        aria-labelledby="app-title"
      >
        <header className="app-header">
          <div>
            <p className="eyebrow">YOCSOW</p>
            <h1 id="app-title">Your world. Your rules.</h1>

            <p className="introduction">
              Create local Minecraft world projects backed by the Java
              engine.
            </p>
          </div>
        </header>

        <ProjectWorkspace workspace={workspace} />

        <dl className="component-list">
          {components.map(({ name, technology }) => (
            <div className="component" key={name}>
              <dt>{name}</dt>
              <dd>{technology}</dd>
            </div>
          ))}
        </dl>

        <SearchRequirementsPanel
          requirements={workspace.project.searchRequirements}
          onChange={workspace.updateSearchRequirements}
        />

        <SeedFinderPanel
          requirements={workspace.project.searchRequirements}
        />

        <SystemStatus />
      </section>
    </main>
  )
}

export default App
