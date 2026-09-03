import './App.css'

const components = [
  { name: 'Frontend', technology: 'React 19' },
  { name: 'Build', technology: 'Vite 8' },
  { name: 'Engine', technology: 'Java 21' },
] as const

function App() {
  return (
    <main className="app-shell">
      <section className="welcome-card" aria-labelledby="app-title">
        <p className="eyebrow">YOCSOW</p>

        <h1 id="app-title">Your world. Your rules.</h1>

        <p className="introduction">
          The foundation for the custom Minecraft world editor is ready.
        </p>

        <dl className="component-list">
          {components.map(({ name, technology }) => (
            <div className="component" key={name}>
              <dt>{name}</dt>
              <dd>{technology}</dd>
            </div>
          ))}
        </dl>

        <p className="status">
          <span className="status-indicator" aria-hidden="true" />
          Desktop foundation operational
        </p>
      </section>
    </main>
  )
}

export default App
