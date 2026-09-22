import { useState } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SearchRequirement } from '../domain/search-requirements'
import type { SeedMapSettings } from '../domain/seed-map'
import { SearchRequirementsPanel } from './SearchRequirementsPanel'

function SearchRequirementsHarness() {
  const [requirements, setRequirements] = useState<
    SearchRequirement[]
  >([])
  const [seedMap, setSeedMap] = useState<SeedMapSettings>({
    visible: false,
    seed: '42',
  })

  return (
    <>
      <SearchRequirementsPanel
        requirements={requirements}
        onChange={setRequirements}
        seedMap={seedMap}
        onSeedMapChange={setSeedMap}
      />

      <output data-testid="requirements-state">
        {JSON.stringify(requirements)}
      </output>
      <output data-testid="seed-map-state">
        {JSON.stringify(seedMap)}
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

function firePointerEvent(
  target: Element,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  properties: {
    pointerId: number
    button?: number
    clientX?: number
    clientY?: number
  },
): void {
  const event = new Event(type, {
    bubbles: true,
    cancelable: true,
  })

  Object.defineProperties(event, {
    pointerId: { value: properties.pointerId },
    button: { value: properties.button ?? 0 },
    clientX: { value: properties.clientX ?? 0 },
    clientY: { value: properties.clientY ?? 0 },
  })
  fireEvent(target, event)
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
    expect(screen.getByTestId('seed-map-state')).toHaveTextContent(
      '{"visible":true,"seed":"42"}',
    )

    await user.click(toggle)

    expect(toggle).toHaveAttribute('aria-checked', 'false')
    expect(
      screen.queryByRole('region', { name: 'Seed 2D map' }),
    ).not.toBeInTheDocument()
  })

  it('drops a catalog filter onto map coordinates', async () => {
    const user = userEvent.setup()
    const dataTransfer = createDataTransfer()

    const { container } = render(<SearchRequirementsHarness />)
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
      screen.getByRole('button', {
        name: 'Move Village filter at X 768, Z -512 with 1000 block search radius',
      }),
    ).toBeInTheDocument()

    const requirement = screen.getByRole('group', {
      name: 'Village requirement 1',
    })
    const xCoordinate = within(requirement).getByLabelText('X coordinate')

    await user.clear(xCoordinate)
    await user.type(xCoordinate, '256')

    expect(
      screen.getByRole('button', {
        name: 'Move Village filter at X 256, Z -512 with 1000 block search radius',
      }),
    ).toBeInTheDocument()

    const radius = within(requirement).getByLabelText('Radius in blocks')

    await user.clear(radius)
    await user.type(radius, '320')

    expect(
      screen.getByRole('button', {
        name: 'Move Village filter at X 256, Z -512 with 320 block search radius',
      }),
    ).toBeInTheDocument()
    expect(
      container.querySelector('.seed-map-search-area--structure'),
    ).toHaveAttribute('r', '5')
  })

  it('moves a filter marker across the map and clamps it at the edge', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)
    await user.click(
      screen.getByRole('button', { name: 'Add Village filter' }),
    )
    await user.click(
      screen.getByRole('switch', { name: 'Toggle Seed 2D Map' }),
    )

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

    let marker = screen.getByRole('button', {
      name: 'Move Village filter at X 0, Z 0 with 1000 block search radius',
    })

    firePointerEvent(marker, 'pointerdown', {
      pointerId: 7,
      button: 0,
      clientX: 340,
      clientY: 210,
    })
    firePointerEvent(dropArea, 'pointermove', {
      pointerId: 7,
      clientX: 460,
      clientY: 130,
    })
    firePointerEvent(dropArea, 'pointerup', { pointerId: 7 })

    expect(renderedRequirements()[0].center).toEqual({ x: 768, z: -512 })

    marker = screen.getByRole('button', {
      name: 'Move Village filter at X 768, Z -512 with 1000 block search radius',
    })
    firePointerEvent(marker, 'pointerdown', {
      pointerId: 8,
      button: 0,
      clientX: 460,
      clientY: 130,
    })
    firePointerEvent(dropArea, 'pointermove', {
      pointerId: 8,
      clientX: 10_000,
      clientY: 10_000,
    })
    firePointerEvent(dropArea, 'pointerup', { pointerId: 8 })

    expect(renderedRequirements()[0].center).toEqual({
      x: 1_536,
      z: 1_024,
    })
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

  it('adds and configures a woodland mansion requirement', async () => {
    const user = userEvent.setup()

    render(<SearchRequirementsHarness />)
    await user.click(
      screen.getByRole('button', { name: 'Add Woodland Mansion filter' }),
    )

    const requirement = screen.getByRole('group', {
      name: 'Woodland Mansion requirement 1',
    })
    const xCoordinate = within(requirement).getByLabelText('X coordinate')
    const zCoordinate = within(requirement).getByLabelText('Z coordinate')
    const radius = within(requirement).getByLabelText('Radius in blocks')

    await user.clear(xCoordinate)
    await user.type(xCoordinate, '4096')
    await user.clear(zCoordinate)
    await user.type(zCoordinate, '-2048')
    await user.clear(radius)
    await user.type(radius, '8000')

    expect(renderedRequirements()).toMatchObject([
      {
        kind: 'structure',
        structureType: 'woodlandMansion',
        center: { x: 4096, z: -2048 },
        radiusBlocks: 8000,
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

    const { container } = render(<SearchRequirementsHarness />)
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

    await user.click(
      screen.getByRole('switch', { name: 'Toggle Seed 2D Map' }),
    )

    expect(
      screen.getByRole('button', {
        name: 'Move Taiga filter at X 240, Z -80 with 256 block search radius',
      }),
    ).toBeInTheDocument()
    expect(
      container.querySelector('.seed-map-search-area--biome'),
    ).toHaveAttribute('r', '4')
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
