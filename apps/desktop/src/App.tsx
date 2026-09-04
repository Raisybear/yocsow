import { type FormEvent, useEffect, useState } from 'react'
import { getAppInfo, type AppInfo } from './native/app-info'
import {
  getEngineStatus,
  type EngineStatus,
} from './native/engine-status'
import {
  seedRangeContains,
  type SeedRangeQuery,
} from './native/seed-range'
import './App.css'

const components = [
  { name: 'Frontend', technology: 'React 19' },
  { name: 'Build', technology: 'Vite 8' },
  { name: 'Engine', technology: 'Java 21' },
] as const

const initialSeedRangeQuery: SeedRangeQuery = {
  minimum: '-10',
  maximum: '10',
  seed: '0',
}

type NativeBridgeState =
  | { status: 'connecting' }
  | { status: 'connected'; appInfo: AppInfo }
  | { status: 'browser' }
  | { status: 'unavailable' }

type EngineBridgeState =
  | { status: 'connecting' }
  | { status: 'connected'; engineStatus: EngineStatus }
  | { status: 'browser' }
  | { status: 'unavailable' }

type SeedRangeQueryState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'result'; contains: boolean }
  | { status: 'browser' }
  | { status: 'error'; message: string }

function queryResultModifier(state: SeedRangeQueryState): string {
  if (state.status !== 'result') {
    return state.status
  }

  return state.contains ? 'inside' : 'outside'
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function App() {
  const [nativeBridge, setNativeBridge] = useState<NativeBridgeState>({
    status: 'connecting',
  })

  const [engineBridge, setEngineBridge] = useState<EngineBridgeState>({
    status: 'connecting',
  })

  const [seedRangeQuery, setSeedRangeQuery] = useState<SeedRangeQuery>(
    initialSeedRangeQuery,
  )

  const [seedRangeState, setSeedRangeState] =
    useState<SeedRangeQueryState>({
      status: 'idle',
    })

  useEffect(() => {
    let active = true

    void getAppInfo()
      .then((appInfo) => {
        if (!active) {
          return
        }

        setNativeBridge(
          appInfo === null
            ? { status: 'browser' }
            : { status: 'connected', appInfo },
        )
      })
      .catch(() => {
        if (active) {
          setNativeBridge({ status: 'unavailable' })
        }
      })

    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    let active = true

    void getEngineStatus()
      .then((engineStatus) => {
        if (!active) {
          return
        }

        setEngineBridge(
          engineStatus === null
            ? { status: 'browser' }
            : { status: 'connected', engineStatus },
        )
      })
      .catch(() => {
        if (active) {
          setEngineBridge({ status: 'unavailable' })
        }
      })

    return () => {
      active = false
    }
  }, [])

  async function handleSeedRangeSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()
    setSeedRangeState({ status: 'checking' })

    try {
      const result = await seedRangeContains(seedRangeQuery)

      setSeedRangeState(
        result === null
          ? { status: 'browser' }
          : { status: 'result', contains: result.contains },
      )
    } catch (error) {
      setSeedRangeState({
        status: 'error',
        message: errorMessage(error),
      })
    }
  }

  function updateSeedRangeQuery(
    field: keyof SeedRangeQuery,
    value: string,
  ): void {
    setSeedRangeQuery((currentQuery) => ({
      ...currentQuery,
      [field]: value,
    }))

    setSeedRangeState({ status: 'idle' })
  }

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

        <section
          className="seed-range-panel"
          aria-labelledby="seed-range-title"
        >
          <div className="seed-range-heading">
            <div>
              <p className="section-label">Engine query</p>
              <h2 id="seed-range-title">Check a seed range</h2>
            </div>

            <p className="seed-range-description">
              Test a signed 64-bit Minecraft seed against an inclusive
              range.
            </p>
          </div>

          <form
            className="seed-range-form"
            onSubmit={handleSeedRangeSubmit}
          >
            <div className="seed-range-fields">
              <label className="seed-range-field">
                <span>Minimum</span>
                <input
                  name="minimum"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={seedRangeQuery.minimum}
                  onChange={(event) => {
                    updateSeedRangeQuery(
                      'minimum',
                      event.currentTarget.value,
                    )
                  }}
                />
              </label>

              <label className="seed-range-field">
                <span>Maximum</span>
                <input
                  name="maximum"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={seedRangeQuery.maximum}
                  onChange={(event) => {
                    updateSeedRangeQuery(
                      'maximum',
                      event.currentTarget.value,
                    )
                  }}
                />
              </label>

              <label className="seed-range-field">
                <span>Seed</span>
                <input
                  name="seed"
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  spellCheck={false}
                  required
                  value={seedRangeQuery.seed}
                  onChange={(event) => {
                    updateSeedRangeQuery(
                      'seed',
                      event.currentTarget.value,
                    )
                  }}
                />
              </label>
            </div>

            <button
              className="seed-range-submit"
              type="submit"
              disabled={seedRangeState.status === 'checking'}
            >
              {seedRangeState.status === 'checking'
                ? 'Checking…'
                : 'Check seed'}
            </button>
          </form>

          <div
            className={`query-result query-result--${queryResultModifier(
              seedRangeState,
            )}`}
            role="status"
            aria-live="polite"
          >
            {seedRangeState.status === 'idle' && (
              <p>Ready to query the Java engine.</p>
            )}

            {seedRangeState.status === 'checking' && (
              <p>Checking seed range…</p>
            )}

            {seedRangeState.status === 'result' &&
              seedRangeState.contains && (
                <p>Seed is inside the selected range.</p>
              )}

            {seedRangeState.status === 'result' &&
              !seedRangeState.contains && (
                <p>Seed is outside the selected range.</p>
              )}

            {seedRangeState.status === 'browser' && (
              <p>Seed queries require the native Tauri application.</p>
            )}

            {seedRangeState.status === 'error' && (
              <p>Seed query failed: {seedRangeState.message}</p>
            )}
          </div>
        </section>

        <div className="status-list">
          <p
            className={`status status--${nativeBridge.status}`}
            role="status"
          >
            <span className="status-indicator" aria-hidden="true" />

            {nativeBridge.status === 'connecting' && (
              <span>Connecting to native bridge</span>
            )}

            {nativeBridge.status === 'connected' && (
              <span>
                Native bridge operational
                <span className="status-details">
                  {' '}
                  — {nativeBridge.appInfo.platform} ·{' '}
                  {nativeBridge.appInfo.architecture} · v
                  {nativeBridge.appInfo.version}
                </span>
              </span>
            )}

            {nativeBridge.status === 'browser' && (
              <span>
                Browser preview active
                <span className="status-details">
                  {' '}
                  — native commands require Tauri
                </span>
              </span>
            )}

            {nativeBridge.status === 'unavailable' && (
              <span>Native bridge unavailable</span>
            )}
          </p>

          <p
            className={`status status--${engineBridge.status}`}
            role="status"
          >
            <span className="status-indicator" aria-hidden="true" />

            {engineBridge.status === 'connecting' && (
              <span>Connecting to Java engine</span>
            )}

            {engineBridge.status === 'connected' && (
              <span>
                Java engine operational
                <span className="status-details">
                  {' '}
                  — v{engineBridge.engineStatus.engineVersion} · protocol{' '}
                  {engineBridge.engineStatus.protocolVersion}
                </span>
              </span>
            )}

            {engineBridge.status === 'browser' && (
              <span>Java engine requires Tauri</span>
            )}

            {engineBridge.status === 'unavailable' && (
              <span>Java engine unavailable</span>
            )}
          </p>
        </div>
      </section>
    </main>
  )
}

export default App