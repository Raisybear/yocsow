import { useState } from 'react'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import type { SearchRequirement } from '../domain/search-requirements'
import { SearchRequirementsPanel } from './SearchRequirementsPanel'

function SearchRequirementsHarness() {
  const [requirements, setRequirements] = useState<
    SearchRequirement[]
  >([])

  return (
    <>
      <SearchRequirementsPanel
        requirements={requirements}
        onChange={setRequirements}
      />

      <output data-testid="requirements-state">
        {JSON.stringify(requirements)}
      </output>
    </>
  )
}

function renderedRequirements(): SearchRequirement[] {
  return JSON.parse(
    screen.getByTestId('requirements-state').textContent ?? '[]',
  ) as SearchRequirement[]
}

describe('SearchRequirementsPanel', () => {
  it('starts without requirements', () => {
    render(<SearchRequirementsHarness />)

    expect(
      screen.getByText('No search requirements added yet.'),
    ).toBeInTheDocument()

    expect(renderedRequirements()).toEqual([])
  })

  it('adds a village requirement with default values', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)

    expect(
      screen.getByRole('combobox', {
        name: 'Requirement type',
      }),
    ).toHaveValue('village')

    await user.click(
      screen.getByRole('button', {
        name: 'Add requirement',
      }),
    )

    const requirement = screen.getByRole('group', {
      name: 'Village requirement 1',
    })

    expect(
      within(requirement).getByLabelText('X coordinate'),
    ).toHaveValue('0')

    expect(
      within(requirement).getByLabelText('Z coordinate'),
    ).toHaveValue('0')

    expect(
      within(requirement).getByLabelText('Radius in blocks'),
    ).toHaveValue('1000')

    expect(renderedRequirements()).toMatchObject([
      {
        kind: 'structure',
        structureType: 'village',
        center: {
          x: 0,
          z: 0,
        },
        radiusBlocks: 1000,
      },
    ])
  })

  it('updates coordinates and radius', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Add requirement',
      }),
    )

    const xCoordinate = screen.getByLabelText('X coordinate')
    const zCoordinate = screen.getByLabelText('Z coordinate')
    const radius = screen.getByLabelText('Radius in blocks')

    await user.clear(xCoordinate)
    await user.type(xCoordinate, '120')

    await user.clear(zCoordinate)
    await user.type(zCoordinate, '-340')

    await user.clear(radius)
    await user.type(radius, '750')

    expect(renderedRequirements()).toMatchObject([
      {
        center: {
          x: 120,
          z: -340,
        },
        radiusBlocks: 750,
      },
    ])
  })

  it('removes an existing requirement', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Add requirement',
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Remove',
      }),
    )

    expect(renderedRequirements()).toEqual([])

    expect(
      screen.getByText('No search requirements added yet.'),
    ).toBeInTheDocument()
  })
})