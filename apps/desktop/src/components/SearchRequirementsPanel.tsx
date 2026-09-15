import { useState } from 'react'
import {
  BIOME_SIZE_OPTIONS,
  createBiomeRequirement,
  createVillageRequirement,
  type BiomeRequirement,
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
  createRequirement?: (id: string) => SearchRequirement
}

const filterCatalog: FilterCatalogItem[] = [
  {
    id: 'village',
    category: 'structures',
    name: 'Village',
    description: 'Locate villages around a target position.',
    createRequirement: createVillageRequirement,
  },
  {
    id: 'ruined-portal',
    category: 'structures',
    name: 'Ruined Portal',
    description: 'Structure support is planned.',
  },
  {
    id: 'ocean-monument',
    category: 'structures',
    name: 'Ocean Monument',
    description: 'Structure support is planned.',
  },
  {
    id: 'taiga',
    category: 'biomes',
    name: 'Taiga',
    description: 'Require a Taiga biome around a target position.',
    createRequirement: (id) => createBiomeRequirement(id, 'taiga'),
  },
  {
    id: 'forest',
    category: 'biomes',
    name: 'Forest',
    description: 'Biome filtering requires engine support.',
  },
  {
    id: 'ocean',
    category: 'biomes',
    name: 'Ocean',
    description: 'Biome filtering requires engine support.',
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

  function addRequirement(item: FilterCatalogItem): void {
    if (item.createRequirement === undefined) {
      return
    }

    onChange([
      ...requirements,
      item.createRequirement(createRequirementId()),
    ])
  }

  function updateRequirement(
    updatedRequirement: SearchRequirement,
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
            {visibleCatalogItems.map((item) => {
              const available = item.createRequirement !== undefined

              return (
                <button
                  className="filter-catalog-item"
                  type="button"
                  disabled={!available}
                  aria-label={
                    available
                      ? `Add ${item.name} filter`
                      : `${item.name} unavailable`
                  }
                  onClick={() => {
                    addRequirement(item)
                  }}
                  key={item.id}
                >
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                  <small>
                    {available
                      ? 'Add filter'
                      : 'Engine support required'}
                  </small>
                </button>
              )
            })}

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
                Choose an available filter from the catalog.
              </p>
            </div>
          ) : (
            <div className="search-requirements-list">
              {requirements.map((requirement, index) =>
                requirement.kind === 'structure' ? (
                  <StructureRequirementCard
                    requirement={requirement}
                    index={index}
                    onChange={updateRequirement}
                    onRemove={removeRequirement}
                    key={requirement.id}
                  />
                ) : (
                  <BiomeRequirementCard
                    requirement={requirement}
                    index={index}
                    onChange={updateRequirement}
                    onRemove={removeRequirement}
                    key={requirement.id}
                  />
                ),
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

interface RequirementCardProps<T extends SearchRequirement> {
  requirement: T
  index: number
  onChange: (requirement: SearchRequirement) => void
  onRemove: (id: string) => void
}

function StructureRequirementCard({
  requirement,
  index,
  onChange,
  onRemove,
}: RequirementCardProps<StructureRequirement>) {
  return (
    <fieldset className="search-requirement-card">
      <legend>Village requirement {index + 1}</legend>
      <RequirementCardHeading
        name="Village"
        description="Structure within a radius of the target position"
        index={index}
        onRemove={() => onRemove(requirement.id)}
      />
      <div className="search-requirement-fields">
        <CoordinateInputs requirement={requirement} onChange={onChange} />
        <IntegerInput
          label="Radius in blocks"
          value={requirement.radiusBlocks}
          minimum={1}
          onChange={(radiusBlocks) => {
            onChange({ ...requirement, radiusBlocks })
          }}
        />
      </div>
    </fieldset>
  )
}

function BiomeRequirementCard({
  requirement,
  index,
  onChange,
  onRemove,
}: RequirementCardProps<BiomeRequirement>) {
  const sizeIndex = BIOME_SIZE_OPTIONS.findIndex(
    (option) => option.value === requirement.size,
  )
  const selectedSize = BIOME_SIZE_OPTIONS[sizeIndex]

  return (
    <fieldset className="search-requirement-card">
      <legend>Taiga requirement {index + 1}</legend>
      <RequirementCardHeading
        name="Taiga"
        description="Biome with the selected minimum extent around the target"
        index={index}
        onRemove={() => onRemove(requirement.id)}
      />
      <div className="search-requirement-fields search-requirement-fields--biome">
        <CoordinateInputs requirement={requirement} onChange={onChange} />
        <label className="biome-size-field">
          <span>Biome size</span>
          <div className="biome-size-control">
            <input
              type="range"
              aria-label="Biome size"
              min={0}
              max={BIOME_SIZE_OPTIONS.length - 1}
              step={1}
              value={sizeIndex}
              onChange={(event) => {
                const option =
                  BIOME_SIZE_OPTIONS[
                    Number(event.currentTarget.value)
                  ]
                onChange({ ...requirement, size: option.value })
              }}
            />
            <output>
              {selectedSize.label} · {selectedSize.radiusBlocks} block radius
            </output>
          </div>
          <span className="biome-size-labels" aria-hidden="true">
            {BIOME_SIZE_OPTIONS.map((option) => (
              <span key={option.value}>{option.label}</span>
            ))}
          </span>
        </label>
      </div>
    </fieldset>
  )
}

function RequirementCardHeading({
  name,
  description,
  index,
  onRemove,
}: {
  name: string
  description: string
  index: number
  onRemove: () => void
}) {
  return (
    <div className="search-requirement-card-heading">
      <div>
        <strong>{name}</strong>
        <span>{description}</span>
      </div>
      <button
        type="button"
        aria-label={`Remove ${name} requirement ${index + 1}`}
        onClick={onRemove}
      >
        Remove
      </button>
    </div>
  )
}

function CoordinateInputs({
  requirement,
  onChange,
}: {
  requirement: SearchRequirement
  onChange: (requirement: SearchRequirement) => void
}) {
  return (
    <>
      <IntegerInput
        label="X coordinate"
        value={requirement.center.x}
        onChange={(x) =>
          onChange({
            ...requirement,
            center: { ...requirement.center, x },
          })
        }
      />
      <IntegerInput
        label="Z coordinate"
        value={requirement.center.z}
        onChange={(z) =>
          onChange({
            ...requirement,
            center: { ...requirement.center, z },
          })
        }
      />
    </>
  )
}
