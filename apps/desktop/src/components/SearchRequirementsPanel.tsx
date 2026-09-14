import { useState } from 'react'
import {
  createVillageRequirement,
  type SearchRequirement,
  type StructureRequirement,
} from '../domain/search-requirements'
import './SearchRequirementsPanel.css'

type FilterCategory = 'structures' | 'biomes'

interface SearchRequirementsPanelProps {
  requirements: SearchRequirement[]
  onChange: (requirements: SearchRequirement[]) => void
}

interface IntegerInputProps {
  label: string
  value: number
  minimum?: number
  onChange: (value: number) => void
}

interface IntegerInputState {
  sourceValue: number
  draft: string
}

interface FilterCatalogItem {
  id: string
  category: FilterCategory
  name: string
  description: string
  available: boolean
}

const filterCatalog: FilterCatalogItem[] = [
  {
    id: 'village',
    category: 'structures',
    name: 'Village',
    description: 'Locate villages around a target position.',
    available: true,
  },
  {
    id: 'ruined-portal',
    category: 'structures',
    name: 'Ruined Portal',
    description: 'Structure support is planned.',
    available: false,
  },
  {
    id: 'ocean-monument',
    category: 'structures',
    name: 'Ocean Monument',
    description: 'Structure support is planned.',
    available: false,
  },
  {
    id: 'taiga',
    category: 'biomes',
    name: 'Taiga',
    description: 'Biome filtering requires engine support.',
    available: false,
  },
  {
    id: 'forest',
    category: 'biomes',
    name: 'Forest',
    description: 'Biome filtering requires engine support.',
    available: false,
  },
  {
    id: 'ocean',
    category: 'biomes',
    name: 'Ocean',
    description: 'Biome filtering requires engine support.',
    available: false,
  },
]

function IntegerInput({
  label,
  value,
  minimum,
  onChange,
}: IntegerInputProps) {
  const [inputState, setInputState] = useState<IntegerInputState>({
    sourceValue: value,
    draft: String(value),
  })

  const draft =
    inputState.sourceValue === value
      ? inputState.draft
      : String(value)

  function updateDraft(nextDraft: string): void {
    setInputState({
      sourceValue: value,
      draft: nextDraft,
    })

    if (!/^-?\d+$/.test(nextDraft)) {
      return
    }

    const parsedValue = Number(nextDraft)

    if (
      !Number.isSafeInteger(parsedValue) ||
      (minimum !== undefined && parsedValue < minimum)
    ) {
      return
    }

    onChange(parsedValue)
  }

  return (
    <label className="search-requirement-field">
      <span>{label}</span>

      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onChange={(event) => {
          updateDraft(event.currentTarget.value)
        }}
        onBlur={() => {
          setInputState({
            sourceValue: value,
            draft: String(value),
          })
        }}
      />
    </label>
  )
}

function createRequirementId(): string {
  return globalThis.crypto.randomUUID()
}

export function SearchRequirementsPanel({
  requirements,
  onChange,
}: SearchRequirementsPanelProps) {
  const [activeCategory, setActiveCategory] =
    useState<FilterCategory>('structures')
  const [filterQuery, setFilterQuery] = useState('')

  const visibleCatalogItems = filterCatalog.filter(
    (item) =>
      item.category === activeCategory &&
      item.name.toLowerCase().includes(filterQuery.toLowerCase()),
  )

  function addVillageRequirement(): void {
    onChange([
      ...requirements,
      createVillageRequirement(createRequirementId()),
    ])
  }

  function updateRequirement(
    updatedRequirement: StructureRequirement,
  ): void {
    onChange(
      requirements.map((requirement) =>
        requirement.id === updatedRequirement.id
          ? updatedRequirement
          : requirement,
      ),
    )
  }

  function removeRequirement(id: string): void {
    onChange(
      requirements.filter((requirement) => requirement.id !== id),
    )
  }

  return (
    <section
      className="search-requirements-panel"
      aria-labelledby="search-requirements-title"
    >
      <header className="search-requirements-heading">
        <div>
          <p className="section-label">Search configuration</p>
          <h2 id="search-requirements-title">Seed filters</h2>
        </div>

        <span className="search-requirements-count">
          {requirements.length}{' '}
          {requirements.length === 1 ? 'active filter' : 'active filters'}
        </span>
      </header>

      <div className="search-requirements-workspace">
        <aside className="filter-catalog" aria-label="Filter catalog">
          <div
            className="filter-catalog-tabs"
            role="tablist"
            aria-label="Filter categories"
          >
            <button
              id="structures-tab"
              type="button"
              role="tab"
              aria-selected={activeCategory === 'structures'}
              aria-controls="filter-catalog-panel"
              onClick={() => {
                setActiveCategory('structures')
                setFilterQuery('')
              }}
            >
              Structures
            </button>

            <button
              id="biomes-tab"
              type="button"
              role="tab"
              aria-selected={activeCategory === 'biomes'}
              aria-controls="filter-catalog-panel"
              onClick={() => {
                setActiveCategory('biomes')
                setFilterQuery('')
              }}
            >
              Biomes
            </button>
          </div>

          <label className="filter-catalog-search">
            <span>
              Search {activeCategory === 'structures' ? 'structures' : 'biomes'}
            </span>
            <input
              type="search"
              value={filterQuery}
              placeholder="Filter list"
              onChange={(event) => {
                setFilterQuery(event.currentTarget.value)
              }}
            />
          </label>

          <div
            id="filter-catalog-panel"
            className="filter-catalog-list"
            role="tabpanel"
            aria-labelledby={`${activeCategory}-tab`}
          >
            {visibleCatalogItems.map((item) => (
              <button
                className="filter-catalog-item"
                type="button"
                disabled={!item.available}
                aria-label={
                  item.available
                    ? `Add ${item.name} filter`
                    : `${item.name} unavailable`
                }
                onClick={
                  item.id === 'village'
                    ? addVillageRequirement
                    : undefined
                }
                key={item.id}
              >
                <strong>{item.name}</strong>
                <span>{item.description}</span>
                <small>
                  {item.available ? 'Add filter' : 'Engine support required'}
                </small>
              </button>
            ))}

            {visibleCatalogItems.length === 0 && (
              <p className="filter-catalog-empty">
                No filters match this search.
              </p>
            )}
          </div>
        </aside>

        <div className="selected-filters">
          <header className="selected-filters-heading">
            <div>
              <span>Active configuration</span>
              <h3>Selected filters</h3>
            </div>
            <small>Changes are saved with the project</small>
          </header>

          {requirements.length === 0 ? (
            <div className="search-requirements-empty">
              <strong>No filters added yet</strong>
              <p>
                Choose an available structure filter from the catalog.
              </p>
            </div>
          ) : (
            <div className="search-requirements-list">
              {requirements.map((requirement, index) => (
                <fieldset
                  className="search-requirement-card"
                  key={requirement.id}
                >
                  <legend>Village requirement {index + 1}</legend>

                  <div className="search-requirement-card-heading">
                    <div>
                      <strong>Village</strong>
                      <span>
                        Structure within a radius of the target position
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remove Village requirement ${index + 1}`}
                      onClick={() => {
                        removeRequirement(requirement.id)
                      }}
                    >
                      Remove
                    </button>
                  </div>

                  <div className="search-requirement-fields">
                    <IntegerInput
                      label="X coordinate"
                      value={requirement.center.x}
                      onChange={(x) => {
                        updateRequirement({
                          ...requirement,
                          center: {
                            ...requirement.center,
                            x,
                          },
                        })
                      }}
                    />

                    <IntegerInput
                      label="Z coordinate"
                      value={requirement.center.z}
                      onChange={(z) => {
                        updateRequirement({
                          ...requirement,
                          center: {
                            ...requirement.center,
                            z,
                          },
                        })
                      }}
                    />

                    <IntegerInput
                      label="Radius in blocks"
                      value={requirement.radiusBlocks}
                      minimum={1}
                      onChange={(radiusBlocks) => {
                        updateRequirement({
                          ...requirement,
                          radiusBlocks,
                        })
                      }}
                    />
                  </div>
                </fieldset>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}
