import { useState, type DragEvent } from 'react'
import {
  BIOME_SIZE_OPTIONS,
  createBiomeRequirement,
  createRuinedPortalRequirement,
  createVillageRequirement,
  createWoodlandMansionRequirement,
  type BiomeRequirement,
  type SearchRequirement,
  type StructureRequirement,
  type StructureType,
} from '../domain/search-requirements'
import {
  createRandomSeed,
  type SeedMapSettings,
} from '../domain/seed-map'
import { ResizablePanelGroup } from './ResizablePanelGroup'
import { SeedMapWorkspace } from './SeedMapWorkspace'
import { writeDraggedFilterId } from './seed-map-drag'
import './SearchRequirementsPanel.css'

type FilterCategory = 'structures' | 'biomes'

interface SearchRequirementsPanelProps {
  requirements: SearchRequirement[]
  onChange: (requirements: SearchRequirement[]) => void
  seedMap: SeedMapSettings
  onSeedMapChange: (seedMap: SeedMapSettings) => void
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
    description: 'Locate ruined portals around a target position.',
    createRequirement: createRuinedPortalRequirement,
  },
  {
    id: 'woodland-mansion',
    category: 'structures',
    name: 'Woodland Mansion',
    description: 'Locate woodland mansions around a target position.',
    createRequirement: createWoodlandMansionRequirement,
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
  seedMap,
  onSeedMapChange,
}: SearchRequirementsPanelProps) {
  const [activeCategory, setActiveCategory] =
    useState<FilterCategory>('structures')
  const [filterQuery, setFilterQuery] = useState('')
  const seedMapVisible = seedMap.visible
  const seedMapSeed = seedMap.seed

  const visibleCatalogItems = filterCatalog.filter(
    (item) =>
      item.category === activeCategory &&
      item.name.toLowerCase().includes(filterQuery.toLowerCase()),
  )
  const structureRequirements = requirements.flatMap(
    (requirement, index) =>
      requirement.kind === 'structure'
        ? [{ requirement, index }]
        : [],
  )
  const biomeRequirements = requirements.flatMap(
    (requirement, index) =>
      requirement.kind === 'biome'
        ? [{ requirement, index }]
        : [],
  )

  function addRequirement(
    item: FilterCatalogItem,
    center?: { x: number; z: number },
  ): void {
    if (item.createRequirement === undefined) {
      return
    }

    const requirement = item.createRequirement(createRequirementId())

    onChange([
      ...requirements,
      center === undefined ? requirement : { ...requirement, center },
    ])
  }

  function startFilterDrag(
    event: DragEvent<HTMLButtonElement>,
    item: FilterCatalogItem,
  ): void {
    if (item.createRequirement === undefined) {
      event.preventDefault()
      return
    }

    writeDraggedFilterId(event.dataTransfer, item.id)
  }

  function addDroppedFilter(
    filterId: string,
    center: { x: number; z: number },
  ): void {
    const item = filterCatalog.find(
      (candidate) => candidate.id === filterId,
    )

    if (item?.createRequirement !== undefined) {
      addRequirement(item, center)
    }
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

  function moveRequirement(
    requirementId: string,
    center: { x: number; z: number },
  ): void {
    const requirement = requirements.find(
      (candidate) => candidate.id === requirementId,
    )

    if (requirement !== undefined) {
      updateRequirement({ ...requirement, center })
    }
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

        <div className="search-requirements-heading-actions">
          <button
            className="seed-map-toggle"
            type="button"
            role="switch"
            aria-label="Toggle Seed 2D Map"
            aria-checked={seedMapVisible}
            aria-controls="seed-map-workspace"
            onClick={() => {
              onSeedMapChange({
                ...seedMap,
                visible: !seedMapVisible,
              })
            }}
          >
            <span>Toggle Seed 2D Map</span>
            <strong>{seedMapVisible ? 'On' : 'Off'}</strong>
          </button>

          <span className="search-requirements-count">
            {requirements.length}{' '}
            {requirements.length === 1 ? 'active filter' : 'active filters'}
          </span>
        </div>
      </header>

      <ResizablePanelGroup
        axis="columns"
        label="Resize filter catalog and selected filters"
        initialPercentage={27}
        minimumPrimaryPixels={220}
        minimumSecondaryPixels={480}
        className="search-requirements-workspace"
      >
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
                  draggable={available}
                  aria-label={
                    available
                      ? `Add ${item.name} filter`
                      : `${item.name} unavailable`
                  }
                  onClick={() => {
                    addRequirement(item)
                  }}
                  onDragStart={(event) => {
                    startFilterDrag(event, item)
                  }}
                  key={item.id}
                >
                  <strong>{item.name}</strong>
                  <span>{item.description}</span>
                  <small>
                    {available
                      ? seedMapVisible
                        ? 'Add or drag to map'
                        : 'Add filter'
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

        <div
          className={
            seedMapVisible
              ? 'search-requirements-content search-requirements-content--map-visible'
              : 'search-requirements-content'
          }
        >
          <div className="selected-filters">
            <header className="selected-filters-heading">
              <div>
                <span>Active configuration</span>
                <h3>Selected filters</h3>
              </div>
              <small>Changes are saved with the project</small>
            </header>

            <div className="selected-filter-groups">
              <section
                className="selected-filter-group"
                aria-labelledby="selected-biomes-title"
              >
                <header className="selected-filter-group-heading">
                  <h4 id="selected-biomes-title">Biomes</h4>
                  <span>{biomeRequirements.length}</span>
                </header>

                {biomeRequirements.length === 0 ? (
                  <div className="search-requirements-empty">
                    <strong>No active biomes</strong>
                    <p>Add a biome from the catalog.</p>
                  </div>
                ) : (
                  <div className="search-requirements-list">
                    {biomeRequirements.map(({ requirement, index }) => (
                      <BiomeRequirementCard
                        requirement={requirement}
                        index={index}
                        onChange={updateRequirement}
                        onRemove={removeRequirement}
                        key={requirement.id}
                      />
                    ))}
                  </div>
                )}
              </section>

              <section
                className="selected-filter-group"
                aria-labelledby="selected-structures-title"
              >
                <header className="selected-filter-group-heading">
                  <h4 id="selected-structures-title">Structures</h4>
                  <span>{structureRequirements.length}</span>
                </header>

                {structureRequirements.length === 0 ? (
                  <div className="search-requirements-empty">
                    <strong>No active structures</strong>
                    <p>Add a structure from the catalog.</p>
                  </div>
                ) : (
                  <div className="search-requirements-list">
                    {structureRequirements.map(({ requirement, index }) => (
                      <StructureRequirementCard
                        requirement={requirement}
                        index={index}
                        onChange={updateRequirement}
                        onRemove={removeRequirement}
                        key={requirement.id}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>

          {seedMapVisible && (
            <SeedMapWorkspace
              seed={seedMapSeed}
              requirements={requirements}
              onRandomize={() => {
                onSeedMapChange({
                  ...seedMap,
                  seed: createRandomSeed(),
                })
              }}
              onFilterDrop={addDroppedFilter}
              onRequirementMove={moveRequirement}
            />
          )}
        </div>
      </ResizablePanelGroup>
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
  const presentation = structurePresentation(requirement.structureType)

  return (
    <fieldset
      className="search-requirement-card"
      aria-label={`${presentation.name} requirement ${index + 1}`}
    >
      <RequirementCardHeading
        name={presentation.name}
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

function structurePresentation(structureType: StructureType): {
  name: string
} {
  switch (structureType) {
    case 'village':
      return { name: 'Village' }
    case 'ruinedPortal':
      return { name: 'Ruined Portal' }
    case 'woodlandMansion':
      return { name: 'Woodland Mansion' }
  }
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
    <fieldset
      className="search-requirement-card"
      aria-label={`Taiga requirement ${index + 1}`}
    >
      <RequirementCardHeading
        name="Taiga"
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
  index,
  onRemove,
}: {
  name: string
  index: number
  onRemove: () => void
}) {
  return (
    <div className="search-requirement-card-heading">
      <strong>{name}</strong>
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
