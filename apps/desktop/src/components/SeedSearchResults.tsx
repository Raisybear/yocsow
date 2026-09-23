import type {
  SeedSearchProgress,
  SeedSearchResult,
} from '../native/seed-search'
import './SeedSearchResults.css'

export type SeedFinderState =
  | { status: 'idle' }
  | {
      status: 'searching'
      progress: SeedSearchProgress
      stopRequested: boolean
    }
  | {
      status: 'result'
      result: SeedSearchResult
    }
  | { status: 'browser' }
  | { status: 'error'; message: string }

interface SeedSearchResultsProps {
  searchState: SeedFinderState
  resultLimit: string
  requirementCount: number
}

const numberFormatter = new Intl.NumberFormat('en-US')

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

function completeMatchCount(result: SeedSearchProgress): number {
  return result.candidates.filter(
    (candidate) => candidate.matchesAllRequirements,
  ).length
}

function formatSeedCount(value: string): string {
  return numberFormatter.format(BigInt(value))
}

function matchName(structureType: string): string {
  switch (structureType) {
    case 'taiga':
      return 'Taiga biome'
    case 'ruinedPortal':
      return 'Ruined Portal'
    case 'woodlandMansion':
      return 'Woodland Mansion'
    case 'desertTemple':
      return 'Desert Temple'
    default:
      return 'Village'
  }
}

export function SeedSearchResults({
  searchState,
  resultLimit,
  requirementCount,
}: SeedSearchResultsProps) {
  const visibleProgress =
    searchState.status === 'searching'
      ? searchState.progress
      : searchState.status === 'result'
        ? searchState.result
        : null
  const candidateCount = visibleProgress?.candidates.length ?? 0

  return (
    <div className="seed-search-output">
      <div
        className={`seed-finder-status seed-finder-status--${searchState.status}`}
        role="status"
        aria-live="polite"
      >
        {searchState.status === 'idle' && requirementCount === 0 && (
          <p>Add at least one search requirement to start.</p>
        )}

        {searchState.status === 'idle' && requirementCount > 0 && (
          <p>Ready to scan the full 64-bit seed space.</p>
        )}

        {searchState.status === 'searching' && (
          <p>
            {searchState.stopRequested
              ? 'Stopping after the current batch…'
              : 'Searching continuously…'}{' '}
            Checked{' '}
            {formatSeedCount(searchState.progress.searchedSeedCount)}{' '}
            seeds, found {completeMatchCount(searchState.progress)}/
            {resultLimit} complete matches. Showing{' '}
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
            {searchState.result.reason === 'stopped' &&
              'Search stopped. '}
            {searchState.result.reason === 'limit' &&
              'Result limit reached. '}
            {searchState.result.reason === 'exhausted' &&
              'The complete 64-bit seed space was searched. '}
            Checked{' '}
            {formatSeedCount(searchState.result.searchedSeedCount)} seeds
            and found {completeMatchCount(searchState.result)}/
            {resultLimit} complete matches. Showing{' '}
            {searchState.result.candidates.length} best candidates after{' '}
            {formatElapsedTime(searchState.result.elapsedMilliseconds)}.
          </p>
        )}
      </div>

      <section
        className="seed-results-panel"
        aria-labelledby="seed-results-title"
      >
        <header className="seed-results-heading">
          <div>
            <span>Ranked candidates</span>
            <h3 id="seed-results-title">Results</h3>
          </div>
          <strong>
            {candidateCount}{' '}
            {candidateCount === 1 ? 'candidate' : 'candidates'}
          </strong>
        </header>

        <div className="seed-results-scroll">
          {searchState.status === 'result' && candidateCount === 0 && (
            <p className="seed-finder-empty">
              No candidates were found before the search stopped.
            </p>
          )}

          {visibleProgress === null && (
            <div className="seed-results-empty">
              <strong>No results to display</strong>
              <p>
                Configure filters and start a search to rank candidate
                seeds.
              </p>
            </div>
          )}

          {visibleProgress !== null && candidateCount > 0 && (
            <ol className="seed-results">
              {visibleProgress.candidates.map((candidate, index) => (
                <li className="seed-result-card" key={candidate.seed}>
                  <div className="seed-result-heading">
                    <div>
                      <span className="seed-result-rank">
                        Result {index + 1}
                      </span>
                      <h4>Seed {candidate.seed}</h4>
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
                        {Math.round(candidate.matchRatio * 100)}%
                      </dd>
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
                          <strong>{matchName(match.structureType)}</strong>
                          <span>{match.requirementId}</span>
                        </div>

                        <p>
                          X {match.actualPosition.x}, Z{' '}
                          {match.actualPosition.z}
                        </p>

                        <span>
                          {match.structureType === 'taiga'
                            ? `Minimum extent: ${match.radiusBlocks} block radius`
                            : `Distance: ${formatDistance(match.distanceBlocks)} blocks`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          )}
        </div>
      </section>
    </div>
  )
}
