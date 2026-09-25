import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { MinecraftJavaReleaseId } from '../domain/minecraft-version'
import type { SearchRequirement } from '../domain/search-requirements'
import {
  createRandomSearchStart,
  createSeedSearchRequest,
  searchSeedBatches,
  stopSeedSearch,
  type SeedSearchProgress,
} from '../native/seed-search'
import {
  SeedSearchResults,
  type SeedFinderState,
} from './SeedSearchResults'
import './SeedFinderPanel.css'

interface SeedFinderRequestState {
  fingerprint: string
  state: SeedFinderState
}

interface SearchSession {
  fingerprint: string
  discarded: boolean
  stopRequested: boolean
  progress: SeedSearchProgress
}

interface SeedFinderPanelProps {
  minecraftVersion: MinecraftJavaReleaseId
  requirements: SearchRequirement[]
  resultLimit?: string
  onResultLimitChange?: (resultLimit: string) => void
}

const idleState: SeedFinderState = {
  status: 'idle',
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function requestFingerprint(
  minecraftVersion: MinecraftJavaReleaseId,
  requirements: SearchRequirement[],
  resultLimit: string,
): string {
  return JSON.stringify({
    minecraftVersion,
    requirements,
    resultLimit,
  })
}

function parseResultLimit(value: string): number {
  if (!/^\d+$/.test(value.trim())) {
    throw new Error(
      'Result limit must be a whole number between 1 and 100.',
    )
  }

  const resultLimit = Number(value)

  if (
    !Number.isSafeInteger(resultLimit) ||
    resultLimit < 1 ||
    resultLimit > 100
  ) {
    throw new Error(
      'Result limit must be a whole number between 1 and 100.',
    )
  }

  return resultLimit
}

export function SeedFinderPanel({
  minecraftVersion,
  requirements,
  resultLimit: controlledResultLimit,
  onResultLimitChange,
}: SeedFinderPanelProps) {
  const [localResultLimit, setLocalResultLimit] = useState('20')
  const [requestState, setRequestState] =
    useState<SeedFinderRequestState>({
      fingerprint: '',
      state: idleState,
    })
  const activeSession = useRef<SearchSession | null>(null)
  const resultLimit = controlledResultLimit ?? localResultLimit

  function updateResultLimit(nextResultLimit: string): void {
    if (onResultLimitChange === undefined) {
      setLocalResultLimit(nextResultLimit)
      return
    }

    onResultLimitChange(nextResultLimit)
  }

  const fingerprint = requestFingerprint(
    minecraftVersion,
    requirements,
    resultLimit,
  )

  const searchState =
    requestState.fingerprint === fingerprint
      ? requestState.state
      : idleState

  useEffect(() => {
    return () => {
      const session = activeSession.current

      if (session !== null) {
        session.discarded = true
        activeSession.current = null
        void stopSeedSearch().catch(() => undefined)
      }
    }
  }, [fingerprint])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()

    const submittedFingerprint = fingerprint
    let parsedResultLimit: number

    try {
      parsedResultLimit = parseResultLimit(resultLimit)
    } catch (error) {
      setRequestState({
        fingerprint: submittedFingerprint,
        state: {
          status: 'error',
          message: errorMessage(error),
        },
      })
      return
    }

    const session: SearchSession = {
      fingerprint: submittedFingerprint,
      discarded: false,
      stopRequested: false,
      progress: {
        searchedSeedCount: '0',
        candidates: [],
        elapsedMilliseconds: 0,
      },
    }

    activeSession.current = session
    setRequestState({
      fingerprint: submittedFingerprint,
      state: {
        status: 'searching',
        progress: session.progress,
        stopRequested: false,
      },
    })

    try {
      const result = await searchSeedBatches(
        createSeedSearchRequest(
          createRandomSearchStart(),
          minecraftVersion,
          requirements,
          parsedResultLimit,
        ),
        (progress) => {
          session.progress = progress

          if (
            !session.discarded &&
            activeSession.current === session
          ) {
            setRequestState({
              fingerprint: submittedFingerprint,
              state: {
                status: 'searching',
                progress,
                stopRequested: session.stopRequested,
              },
            })
          }
        },
      )

      if (session.discarded || activeSession.current !== session) {
        return
      }

      activeSession.current = null
      setRequestState({
        fingerprint: submittedFingerprint,
        state:
          result === null
            ? { status: 'browser' }
            : { status: 'result', result },
      })
    } catch (error) {
      if (
        !session.discarded &&
        activeSession.current === session
      ) {
        setRequestState({
          fingerprint: submittedFingerprint,
          state: {
            status: 'error',
            message: errorMessage(error),
          },
        })
      }

      if (activeSession.current === session) {
        activeSession.current = null
      }
    }
  }

  async function handleStop(): Promise<void> {
    const session = activeSession.current

    if (session === null || session.stopRequested) {
      return
    }

    session.stopRequested = true
    setRequestState({
      fingerprint: session.fingerprint,
      state: {
        status: 'searching',
        progress: session.progress,
        stopRequested: true,
      },
    })

    try {
      await stopSeedSearch()
    } catch (error) {
      if (activeSession.current === session) {
        session.discarded = true
        activeSession.current = null
        setRequestState({
          fingerprint: session.fingerprint,
          state: {
            status: 'error',
            message: errorMessage(error),
          },
        })
      }
    }
  }

  return (
    <section
      className="seed-finder-panel"
      aria-labelledby="seed-finder-title"
    >
      <header className="seed-finder-heading">
        <div>
          <p className="section-label">Native search</p>
          <h2 id="seed-finder-title">Seed search</h2>
        </div>

        <p>
          Scan the signed 64-bit seed space until enough candidates
          match every active filter.
        </p>
      </header>

      <form className="seed-finder-form" onSubmit={handleSubmit}>
        <div className="seed-finder-summary">
          <div>
            <span>Mode</span>
            <strong>Continuous 64-bit scan</strong>
          </div>

          <div>
            <span>Filters</span>
            <strong>{requirements.length}</strong>
          </div>
        </div>

        <label className="seed-finder-limit">
          <span>Result limit</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            required
            disabled={searchState.status === 'searching'}
            value={resultLimit}
            onChange={(event) => {
              updateResultLimit(event.currentTarget.value)
            }}
          />
        </label>

        {searchState.status === 'searching' ? (
          <button
            className="seed-finder-stop"
            type="button"
            disabled={searchState.stopRequested}
            onClick={handleStop}
          >
            {searchState.stopRequested ? 'Stopping…' : 'Stop search'}
          </button>
        ) : (
          <button
            className="seed-finder-submit"
            type="submit"
            disabled={requirements.length === 0}
          >
            Search seeds
          </button>
        )}
      </form>

      <SeedSearchResults
        searchState={searchState}
        resultLimit={resultLimit}
        requirementCount={requirements.length}
      />
    </section>
  )
}
