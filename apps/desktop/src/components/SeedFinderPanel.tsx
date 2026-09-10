import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from 'react'
import type { SearchRequirement } from '../domain/search-requirements'
import {
  createRandomSearchStart,
  createSeedSearchRequest,
  nextSeedAfterBatch,
  searchSeeds,
  type SeedSearchCandidate,
  type SeedSearchResult,
} from '../native/seed-search'
import './SeedFinderPanel.css'

interface SearchProgress extends SeedSearchResult {
  elapsedMilliseconds: number
}

type SeedFinderState =
  | { status: 'idle' }
  | {
      status: 'searching'
      progress: SearchProgress
      stopRequested: boolean
    }
  | {
      status: 'result'
      progress: SearchProgress
      reason: 'limit' | 'stopped'
    }
  | { status: 'browser' }
  | { status: 'error'; message: string }

interface SeedFinderRequestState {
  fingerprint: string
  state: SeedFinderState
}

interface SearchSession {
  fingerprint: string
  cancelled: boolean
  progress: SearchProgress
}

interface SeedFinderPanelProps {
  requirements: SearchRequirement[]
}

const idleState: SeedFinderState = {
  status: 'idle',
}

const numberFormatter = new Intl.NumberFormat('en-US')

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

function requestFingerprint(
  requirements: SearchRequirement[],
  resultLimit: string,
): string {
  return JSON.stringify({
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

function formatDistance(distance: number): string {
  return distance.toFixed(1)
}

function formatElapsedTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1_000))
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return minutes === 0
    ? `${seconds}s`
    : `${minutes}m ${seconds.toString().padStart(2, '0')}s`
}

function compareCandidates(
  left: SeedSearchCandidate,
  right: SeedSearchCandidate,
): number {
  const matchDifference =
    right.matchedRequirementCount - left.matchedRequirementCount

  if (matchDifference !== 0) {
    return matchDifference
  }

  const distanceDifference =
    left.averageNormalizedDistance -
    right.averageNormalizedDistance

  if (distanceDifference !== 0) {
    return distanceDifference
  }

  const leftSeed = BigInt(left.seed)
  const rightSeed = BigInt(right.seed)

  return leftSeed < rightSeed ? -1 : leftSeed > rightSeed ? 1 : 0
}

function mergeCandidates(
  current: SeedSearchCandidate[],
  incoming: SeedSearchCandidate[],
  resultLimit: number,
): SeedSearchCandidate[] {
  const candidates = new Map(
    current.map((candidate) => [candidate.seed, candidate]),
  )

  for (const candidate of incoming) {
    candidates.set(candidate.seed, candidate)
  }

  return [...candidates.values()]
    .sort(compareCandidates)
    .slice(0, resultLimit)
}

function completeMatchCount(
  candidates: SeedSearchCandidate[],
): number {
  return candidates.filter(
    (candidate) => candidate.matchesAllRequirements,
  ).length
}

export function SeedFinderPanel({
  requirements,
}: SeedFinderPanelProps) {
  const [resultLimit, setResultLimit] = useState('20')
  const [requestState, setRequestState] =
    useState<SeedFinderRequestState>({
      fingerprint: '',
      state: idleState,
    })
  const activeSession = useRef<SearchSession | null>(null)

  const fingerprint = requestFingerprint(
    requirements,
    resultLimit,
  )

  const searchState =
    requestState.fingerprint === fingerprint
      ? requestState.state
      : idleState

  useEffect(() => {
    return () => {
      if (activeSession.current !== null) {
        activeSession.current.cancelled = true
      }
    }
  }, [fingerprint])

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()

    const submittedFingerprint = fingerprint
    const startedAt = performance.now()
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
      cancelled: false,
      progress: {
        searchedSeedCount: 0,
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
      let nextSeed = createRandomSearchStart()

      while (!session.cancelled) {
        const request = createSeedSearchRequest(
          nextSeed,
          requirements,
          parsedResultLimit,
        )
        const batchResult = await searchSeeds(request)

        if (batchResult === null) {
          if (activeSession.current === session) {
            activeSession.current = null
            setRequestState({
              fingerprint: submittedFingerprint,
              state: session.cancelled
                ? {
                    status: 'result',
                    progress: session.progress,
                    reason: 'stopped',
                  }
                : { status: 'browser' },
            })
          }
          return
        }

        session.progress = {
          searchedSeedCount:
            session.progress.searchedSeedCount +
            batchResult.searchedSeedCount,
          candidates: mergeCandidates(
            session.progress.candidates,
            batchResult.candidates,
            parsedResultLimit,
          ),
          elapsedMilliseconds: performance.now() - startedAt,
        }

        if (session.cancelled) {
          if (activeSession.current === session) {
            activeSession.current = null
            setRequestState({
              fingerprint: submittedFingerprint,
              state: {
                status: 'result',
                progress: session.progress,
                reason: 'stopped',
              },
            })
          }
          return
        }

        if (
          completeMatchCount(session.progress.candidates) >=
          parsedResultLimit
        ) {
          if (activeSession.current === session) {
            activeSession.current = null
            setRequestState({
              fingerprint: submittedFingerprint,
              state: {
                status: 'result',
                progress: session.progress,
                reason: 'limit',
              },
            })
          }
          return
        }

        setRequestState({
          fingerprint: submittedFingerprint,
          state: {
            status: 'searching',
            progress: session.progress,
            stopRequested: false,
          },
        })

        nextSeed = nextSeedAfterBatch(request)
      }
    } catch (error) {
      if (
        !session.cancelled &&
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

  function handleStop(): void {
    const session = activeSession.current

    if (session === null || session.cancelled) {
      return
    }

    session.cancelled = true
    setRequestState({
      fingerprint: session.fingerprint,
      state: {
        status: 'searching',
        progress: session.progress,
        stopRequested: true,
      },
    })
  }

  const visibleProgress =
    searchState.status === 'searching' ||
    searchState.status === 'result'
      ? searchState.progress
      : null

  return (
    <section
      className="seed-finder-panel"
      aria-labelledby="seed-finder-title"
    >
      <div className="seed-finder-heading">
        <div>
          <p className="section-label">Native seed finder</p>
          <h2 id="seed-finder-title">Find matching seeds</h2>
        </div>

        <p className="seed-finder-description">
          Continuously scan the full signed 64-bit seed space with
          the Java engine until enough seeds match every requirement.
        </p>
      </div>

      <form className="seed-finder-form" onSubmit={handleSubmit}>
        <div className="seed-finder-summary">
          <div>
            <span>Search mode</span>
            <strong>Continuous 64-bit scan</strong>
          </div>

          <div>
            <span>Requirements</span>
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
              setResultLimit(event.currentTarget.value)
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
            {searchState.stopRequested
              ? 'Stopping…'
              : 'Stop search'}
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

      <div
        className={`seed-finder-status seed-finder-status--${searchState.status}`}
        role="status"
        aria-live="polite"
      >
        {searchState.status === 'idle' &&
          requirements.length === 0 && (
            <p>Add at least one search requirement to start.</p>
          )}

        {searchState.status === 'idle' &&
          requirements.length > 0 && (
            <p>Ready to scan the full 64-bit seed space.</p>
          )}

        {searchState.status === 'searching' && (
          <p>
            {searchState.stopRequested
              ? 'Stopping after the current batch…'
              : 'Searching continuously…'}{' '}
            Checked{' '}
            {numberFormatter.format(
              searchState.progress.searchedSeedCount,
            )}{' '}
            seeds, found{' '}
            {completeMatchCount(
              searchState.progress.candidates,
            )}
            /{resultLimit} complete matches. Showing{' '}
            {searchState.progress.candidates.length} best candidates
            after{' '}
            {formatElapsedTime(
              searchState.progress.elapsedMilliseconds,
            )}
            .
          </p>
        )}

        {searchState.status === 'browser' && (
          <p>Seed searches require the native Tauri application.</p>
        )}

        {searchState.status === 'error' && (
          <p>Seed search failed: {searchState.message}</p>
        )}

        {searchState.status === 'result' && (
          <p>
            {searchState.reason === 'stopped'
              ? 'Search stopped.'
              : 'Result limit reached.'}{' '}
            Checked{' '}
            {numberFormatter.format(
              searchState.progress.searchedSeedCount,
            )}{' '}
            seeds and found{' '}
            {completeMatchCount(
              searchState.progress.candidates,
            )}
            /{resultLimit} complete matches. Showing{' '}
            {searchState.progress.candidates.length} best candidates
            after{' '}
            {formatElapsedTime(
              searchState.progress.elapsedMilliseconds,
            )}
            .
          </p>
        )}
      </div>

      {searchState.status === 'result' &&
        searchState.progress.candidates.length === 0 && (
          <p className="seed-finder-empty">
            No candidates were found before the search stopped.
          </p>
        )}

      {visibleProgress !== null &&
        visibleProgress.candidates.length > 0 && (
          <ol className="seed-results">
            {visibleProgress.candidates.map((candidate, index) => (
              <li className="seed-result-card" key={candidate.seed}>
                <div className="seed-result-heading">
                  <div>
                    <span className="seed-result-rank">
                      Result {index + 1}
                    </span>
                    <h3>Seed {candidate.seed}</h3>
                  </div>

                  <span
                    className={
                      candidate.matchesAllRequirements
                        ? 'seed-result-badge seed-result-badge--complete'
                        : 'seed-result-badge'
                    }
                  >
                    {candidate.matchedRequirementCount}/
                    {candidate.totalRequirementCount} matched
                  </span>
                </div>

                <dl className="seed-result-metrics">
                  <div>
                    <dt>Match ratio</dt>
                    <dd>{Math.round(candidate.matchRatio * 100)}%</dd>
                  </div>

                  <div>
                    <dt>Average distance score</dt>
                    <dd>
                      {candidate.averageNormalizedDistance.toFixed(3)}
                    </dd>
                  </div>
                </dl>

                <ul className="structure-matches">
                  {candidate.matches.map((match) => (
                    <li key={match.requirementId}>
                      <div>
                        <strong>Village</strong>
                        <span>{match.requirementId}</span>
                      </div>

                      <p>
                        X {match.actualPosition.x}, Z{' '}
                        {match.actualPosition.z}
                      </p>

                      <span>
                        Distance: {formatDistance(match.distanceBlocks)}{' '}
                        blocks
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>
        )}
    </section>
  )
}
