import { type FormEvent, useState } from 'react'
import {
  seedRangeContains,
  type SeedRangeQuery,
} from '../native/seed-range'
import './SeedRangePanel.css'

type SeedRangeQueryState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'result'; contains: boolean }
  | { status: 'browser' }
  | { status: 'error'; message: string }

interface SeedRangeRequestState {
  seedRange: SeedRangeQuery
  state: SeedRangeQueryState
}

interface SeedRangePanelProps {
  seedRange: SeedRangeQuery
  onChange: (field: keyof SeedRangeQuery, value: string) => void
}

const idleState: SeedRangeQueryState = {
  status: 'idle',
}

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

function seedRangesEqual(
  left: SeedRangeQuery,
  right: SeedRangeQuery,
): boolean {
  return (
    left.minimum === right.minimum &&
    left.maximum === right.maximum &&
    left.seed === right.seed
  )
}

export function SeedRangePanel({
  seedRange,
  onChange,
}: SeedRangePanelProps) {
  const [requestState, setRequestState] =
    useState<SeedRangeRequestState>({
      seedRange,
      state: idleState,
    })

  const queryState = seedRangesEqual(
    requestState.seedRange,
    seedRange,
  )
    ? requestState.state
    : idleState

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault()

    const submittedSeedRange = {
      ...seedRange,
    }

    setRequestState({
      seedRange: submittedSeedRange,
      state: { status: 'checking' },
    })

    try {
      const result = await seedRangeContains(submittedSeedRange)

      setRequestState({
        seedRange: submittedSeedRange,
        state:
          result === null
            ? { status: 'browser' }
            : {
                status: 'result',
                contains: result.contains,
              },
      })
    } catch (error) {
      setRequestState({
        seedRange: submittedSeedRange,
        state: {
          status: 'error',
          message: errorMessage(error),
        },
      })
    }
  }

  return (
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
          Test a signed 64-bit Minecraft seed against the range stored
          in this project.
        </p>
      </div>

      <form
        className="seed-range-form"
        onSubmit={handleSubmit}
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
              value={seedRange.minimum}
              onChange={(event) => {
                onChange('minimum', event.currentTarget.value)
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
              value={seedRange.maximum}
              onChange={(event) => {
                onChange('maximum', event.currentTarget.value)
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
              value={seedRange.seed}
              onChange={(event) => {
                onChange('seed', event.currentTarget.value)
              }}
            />
          </label>
        </div>

        <button
          className="seed-range-submit"
          type="submit"
          disabled={queryState.status === 'checking'}
        >
          {queryState.status === 'checking'
            ? 'Checking…'
            : 'Check seed'}
        </button>
      </form>

      <div
        className={`query-result query-result--${queryResultModifier(
          queryState,
        )}`}
        role="status"
        aria-live="polite"
      >
        {queryState.status === 'idle' && (
          <p>Ready to query the Java engine.</p>
        )}

        {queryState.status === 'checking' && (
          <p>Checking seed range…</p>
        )}

        {queryState.status === 'result' &&
          queryState.contains && (
            <p>Seed is inside the selected range.</p>
          )}

        {queryState.status === 'result' &&
          !queryState.contains && (
            <p>Seed is outside the selected range.</p>
          )}

        {queryState.status === 'browser' && (
          <p>Seed queries require the native Tauri application.</p>
        )}

        {queryState.status === 'error' && (
          <p>Seed query failed: {queryState.message}</p>
        )}
      </div>
    </section>
  )
}