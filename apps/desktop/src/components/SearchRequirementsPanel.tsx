import { useState } from 'react'
import {
  createVillageRequirement,
  type SearchRequirement,
  type StructureRequirement,
  type StructureType,
} from '../domain/search-requirements'
import './SearchRequirementsPanel.css'

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
  const [selectedType, setSelectedType] =
    useState<StructureType>('village')

  function addRequirement(): void {
    if (selectedType === 'village') {
      onChange([
        ...requirements,
        createVillageRequirement(createRequirementId()),
      ])
    }
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
      <div className="search-requirements-heading">
        <div>
          <p className="section-label">Seed finder</p>
          <h2 id="search-requirements-title">
            Search requirements
          </h2>
        </div>

        <p className="search-requirements-description">
          Add structures and define where they should generate.
        </p>
      </div>

      <div className="search-requirement-add">
        <label>
          <span>Requirement type</span>

          <select
            value={selectedType}
            onChange={(event) => {
              setSelectedType(
                event.currentTarget.value as StructureType,
              )
            }}
          >
            <option value="village">Village</option>
          </select>
        </label>

        <button type="button" onClick={addRequirement}>
          Add requirement
        </button>
      </div>

      {requirements.length === 0 && (
        <p className="search-requirements-empty">
          No search requirements added yet.
        </p>
      )}

      <div className="search-requirements-list">
        {requirements.map((requirement, index) => (
          <fieldset
            className="search-requirement-card"
            key={requirement.id}
          >
            <legend>
              Village requirement {index + 1}
            </legend>

            <div className="search-requirement-card-heading">
              <p>
                Find a village within the selected radius around these
                coordinates.
              </p>

              <button
                type="button"
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
    </section>
  )
}