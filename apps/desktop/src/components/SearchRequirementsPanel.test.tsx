import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
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

function createDataTransfer(): DataTransfer {
  const values = new Map<string, string>()

  return {
    dropEffect: 'none',
    effectAllowed: 'uninitialized',
    files: [] as unknown as FileList,
    items: [] as unknown as DataTransferItemList,
    get types() {
      return [...values.keys()]
    },
    clearData: (format?: string) => {
      if (format === undefined) {
        values.clear()
      } else {
        values.delete(format)
      }
    },
    getData: (format: string) => values.get(format) ?? '',
    setData: (format: string, value: string) => {
      values.set(format, value)
    },
    setDragImage: () => {},
  }
}

describe('SearchRequirementsPanel', () => {
  it('starts without requirements', () => {
    render(<SearchRequirementsHarness />)

    expect(
      screen.getByText('No active biomes'),
    ).toBeInTheDocument()
    expect(
      screen.getByText('No active structures'),
    ).toBeInTheDocument()

    expect(renderedRequirements()).toEqual([])
  })

  it('toggles the seed map workspace', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)

    const toggle = screen.getByRole('switch', {
      name: 'Toggle Seed 2D Map',
    })

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.queryByRole('region', { name: 'Seed 2D map' }),
    ).not.toBeInTheDocument()

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('region', { name: 'Seed 2D map' }),
    ).toBeInTheDocument()

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.queryByRole('region', { name: 'Seed 2D map' }),
    ).not.toBeInTheDocument()
  })

  it('drops a catalog filter onto map coordinates', async () => {
    const user = userEvent.setup()
    const dataTransfer = createDataTransfer()

    render(<SearchRequirementsHarness />)
    await user.click(
      screen.getByRole('switch', { name: 'Toggle Seed 2D Map' }),
    )

    const catalogItem = screen.getByRole('button', {
      name: 'Add Village filter',
    })
    const dropArea = screen.getByLabelText('Seed map drop area')

    vi.spyOn(dropArea, 'getBoundingClientRect').mockReturnValue({
      x: 100,
      y: 50,
      left: 100,
      top: 50,
      right: 580,
      bottom: 370,
      width: 480,
      height: 320,
      toJSON: () => ({}),
    })

    fireEvent.dragStart(catalogItem, { dataTransfer })
    fireEvent.dragEnter(dropArea, { dataTransfer })
    fireEvent.dragOver(dropArea, { dataTransfer })
    const dropEvent = new Event('drop', {
      bubbles: true,
      cancelable: true,
    })
    Object.defineProperties(dropEvent, {
      dataTransfer: { value: dataTransfer },
      clientX: { value: 460 },
      clientY: { value: 130 },
    })
    fireEvent(dropArea, dropEvent)

    expect(renderedRequirements()).toMatchObject([
      {
        kind: 'structure',
        structureType: 'village',
        center: { x: 768, z: -512 },
      },
    ])
    expect(
      screen.getByRole('img', {
        name: 'Village filter at X 768, Z -512',
      }),
    ).toBeInTheDocument()

    const requirement = screen.getByRole('group', {
      name: 'Village requirement 1',
    })
    const xCoordinate = within(requirement).getByLabelText('X coordinate')

    await user.clear(xCoordinate)
    await user.type(xCoordinate, '256')

    expect(
      screen.getByRole('img', {
        name: 'Village filter at X 256, Z -512',
      }),
    ).toBeInTheDocument()
  })

  it('adds a village requirement with default values', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Add Village filter',
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
        name: 'Add Village filter',
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

  it('adds and configures a ruined portal requirement', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)
    await user.click(
      screen.getByRole('button', { name: 'Add Ruined Portal filter' }),
    )

    const requirement = screen.getByRole('group', {
      name: 'Ruined Portal requirement 1',
    })
    const xCoordinate = within(requirement).getByLabelText('X coordinate')
    const zCoordinate = within(requirement).getByLabelText('Z coordinate')
    const radius = within(requirement).getByLabelText('Radius in blocks')

    await user.clear(xCoordinate)
    await user.type(xCoordinate, '-800')
    await user.clear(zCoordinate)
    await user.type(zCoordinate, '1200')
    await user.clear(radius)
    await user.type(radius, '640')

    expect(renderedRequirements()).toMatchObject([
      {
        kind: 'structure',
        structureType: 'ruinedPortal',
        center: { x: -800, z: 1200 },
        radiusBlocks: 640,
      },
    ])
  })

  it('removes an existing requirement', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)

    await user.click(
      screen.getByRole('button', {
        name: 'Add Village filter',
      }),
    )

    await user.click(
      screen.getByRole('button', {
        name: 'Remove Village requirement 1',
      }),
    )

    expect(renderedRequirements()).toEqual([])

    expect(
      screen.getByText('No active structures'),
    ).toBeInTheDocument()
  })

  it('switches between independently searchable filter catalogs', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)

    expect(
      screen.getByRole('tab', { name: 'Structures' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(
      screen.getByRole('button', { name: 'Add Village filter' }),
    ).toBeEnabled()

    await user.click(screen.getByRole('tab', { name: 'Biomes' }))

    expect(
      screen.getByRole('tab', { name: 'Biomes' }),
    ).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByLabelText('Search biomes')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Add Taiga filter' }),
    ).toBeEnabled()
  })

  it('adds and configures a taiga biome requirement', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)
    await user.click(screen.getByRole('tab', { name: 'Biomes' }))
    await user.click(
      screen.getByRole('button', { name: 'Add Taiga filter' }),
    )

    const requirement = screen.getByRole('group', {
      name: 'Taiga requirement 1',
    })
    const xCoordinate = within(requirement).getByLabelText('X coordinate')
    const zCoordinate = within(requirement).getByLabelText('Z coordinate')
    const size = within(requirement).getByLabelText('Biome size')

    expect(size).toHaveValue('2')
    expect(within(requirement).getByText(/Big · 64 block radius/)).toBeInTheDocument()

    await user.clear(xCoordinate)
    await user.type(xCoordinate, '240')
    await user.clear(zCoordinate)
    await user.type(zCoordinate, '-80')
    fireEvent.change(size, { target: { value: '4' } })

    expect(renderedRequirements()).toMatchObject([
      {
        kind: 'biome',
        biomeType: 'taiga',
        center: { x: 240, z: -80 },
        size: 'enormous',
      },
    ])
  })

  it('separates active biome and structure requirements', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)

    await user.click(
      screen.getByRole('button', { name: 'Add Village filter' }),
    )
    await user.click(screen.getByRole('tab', { name: 'Biomes' }))
    await user.click(
      screen.getByRole('button', { name: 'Add Taiga filter' }),
    )

    const activeBiomes = screen.getByRole('region', {
      name: 'Biomes',
    })
    const activeStructures = screen.getByRole('region', {
      name: 'Structures',
    })

    expect(
      within(activeBiomes).getByRole('group', {
        name: 'Taiga requirement 2',
      }),
    ).toBeInTheDocument()
    expect(
      within(activeStructures).getByRole('group', {
        name: 'Village requirement 1',
      }),
    ).toBeInTheDocument()
  })
})
