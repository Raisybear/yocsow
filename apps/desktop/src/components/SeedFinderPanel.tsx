import { type FormEvent, useState } from 'react'
import type { SearchRequirement } from '../domain/search-requirements'
import {
  createSeedSearchRequest,
  searchSeeds,
  type SeedSearchResult,
} from '../native/seed-search'
import type { SeedRangeQuery } from '../native/seed-range'
import './SeedFinderPanel.css'

type SeedFinderState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'result'; result: SeedSearchResult }
  | { status: 'browser' }
  | { status: 'error'; message: string }

interface SeedFinderRequestState {
  fingerprint: string
  state: SeedFinderState
}

interface SeedFinderPanelProps {
  seedRange: SeedRangeQuery
  requirements: SearchRequirement[]
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
  seedRange: SeedRangeQuery,
  requirements: SearchRequirement[],
  resultLimit: string,
): string {
  return JSON.stringify({
    minimum: seedRange.minimum,
    maximum: seedRange.maximum,
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

export function SeedFinderPanel({
  seedRange,
  requirements,
}: SeedFinderPanelProps) {
  const [resultLimit, setResultLimit] = useState('20')
  const [requestState, setRequestState] =
    useState<SeedFinderRequestState>({
      fingerprint: '',
      state: idleState,
    })

  const fingerprint = requestFingerprint(
    seedRange,
    requirements,
    resultLimit,
  )

  const searchState =
    requestState.fingerprint === fingerprint
      ? requestState.state
      : idleState

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()

    const submittedFingerprint = fingerprint

    setRequestState({
      fingerprint: submittedFingerprint,
      state: { status: 'searching' },
    })

    try {
      const parsedResultLimit = parseResultLimit(resultLimit)
      const request = createSeedSearchRequest(
        seedRange,
        requirements,
        parsedResultLimit,
      )
      const result = await searchSeeds(request)

      setRequestState({
        fingerprint: submittedFingerprint,
        state:
          result === null
            ? { status: 'browser' }
            : {
                status: 'result',
                result,
              },
      })
    } catch (error) {
      setRequestState({
        fingerprint: submittedFingerprint,
        state: {
          status: 'error',
          message: errorMessage(error),
        },
      })
    }
  }

  return (
    <section
      className="seed-finder-panel"
      aria-labelledby="seed-finder-title"
    >
      <div className="seed-finder-heading">
        <div>
          <p className="section-label">Native seed finder</p>
          <h2 id="seed-finder-title">
            Find matching seeds
          </h2>
        </div>

        <p className="seed-finder-description">
          Search the configured inclusive seed range with the Java
          engine and native Cubiomes locator.
        </p>
      </div>

      <form
        className="seed-finder-form"
        onSubmit={handleSubmit}
      >
        <div className="seed-finder-summary">
          <div>
            <span>Seed range</span>
            <strong>
              {seedRange.minimum} to {seedRange.maximum}
            </strong>
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
            value={resultLimit}
            onChange={(event) => {
              setResultLimit(event.currentTarget.value)
            }}
          />
        </label>

        <button
          className="seed-finder-submit"
          type="submit"
          disabled={
            requirements.length === 0 ||
            searchState.status === 'searching'
          }
        >
          {searchState.status === 'searching'
            ? 'Searching…'
            : 'Search seeds'}
        </button>
      </form>

      <div
        className={`seed-finder-status seed-finder-status--${searchState.status}`}
        role="status"
        aria-live="polite"
      >
        {searchState.status === 'idle' &&
          requirements.length === 0 && (
            <p>
              Add at least one search requirement to start.
            </p>
          )}

        {searchState.status === 'idle' &&
          requirements.length > 0 && (
            <p>Ready to search with the native engine.</p>
          )}

        {searchState.status === 'searching' && (
          <p>Searching the selected seed range…</p>
        )}

        {searchState.status === 'browser' && (
          <p>
            Seed searches require the native Tauri application.
          </p>
        )}

        {searchState.status === 'error' && (
          <p>Seed search failed: {searchState.message}</p>
        )}

        {searchState.status === 'result' && (
          <p>
            Searched {searchState.result.searchedSeedCount} seeds and
            found {searchState.result.candidates.length} candidates.
          </p>
        )}
      </div>

      {searchState.status === 'result' &&
        searchState.result.candidates.length === 0 && (
          <p className="seed-finder-empty">
            No seeds matched the configured requirements.
          </p>
        )}

      {searchState.status === 'result' &&
        searchState.result.candidates.length > 0 && (
          <ol className="seed-results">
            {searchState.result.candidates.map(
              (candidate, index) => (
                <li
                  className="seed-result-card"
                  key={candidate.seed}
                >
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
                      <dd>
                        {Math.round(
                          candidate.matchRatio * 100,
                        )}
                        %
                      </dd>
                    </div>

                    <div>
                      <dt>Average distance score</dt>
                      <dd>
                        {candidate.averageNormalizedDistance.toFixed(
                          3,
                        )}
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
                          Distance:{' '}
                          {formatDistance(
                            match.distanceBlocks,
                          )}{' '}
                          blocks
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ),
            )}
          </ol>
        )}
    </section>
  )
}