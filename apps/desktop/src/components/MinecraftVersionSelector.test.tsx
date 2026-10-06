import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import {
  MINECRAFT_JAVA_RELEASES,
  requireMinecraftJavaReleaseId,
  type MinecraftJavaReleaseId,
} from '../domain/minecraft-version'
import { MinecraftVersionSelector } from './MinecraftVersionSelector'

const defaultVersion = requireMinecraftJavaReleaseId('1.21')

function SelectorHarness() {
  const [version, setVersion] =
    useState<MinecraftJavaReleaseId>(defaultVersion)

  return (
    <MinecraftVersionSelector value={version} onChange={setVersion} />
  )
}

describe('MinecraftVersionSelector', () => {
  it('shows the selected release and opens the complete catalog', async () => {
    const user = userEvent.setup()

    render(<SelectorHarness />)

    const selector = screen.getByRole('combobox', {
      name: 'Minecraft version',
    })

    expect(selector).toHaveValue('1.21')
    expect(selector).toHaveAttribute('aria-expanded', 'false')

    await user.click(selector)

    const options = within(
      screen.getByRole('listbox', {
        name: 'Minecraft Java releases',
      }),
    ).getAllByRole('option')

    expect(options).toHaveLength(MINECRAFT_JAVA_RELEASES.length)
    expect(options[0]).toHaveTextContent('Java 26.3Latest')
    expect(options.at(-1)).toHaveTextContent('Java 1.0.0')
  })

  it('filters full releases and selects one without accepting free text', async () => {
    const user = userEvent.setup()

    render(<SelectorHarness />)

    const selector = screen.getByRole('combobox', {
      name: 'Minecraft version',
    })

    await user.click(selector)
    await user.keyboard('1.20.6')

    const listbox = screen.getByRole('listbox')

    expect(within(listbox).getAllByRole('option')).toHaveLength(1)

    await user.click(
      within(listbox).getByRole('option', {
        name: 'Java 1.20.6',
      }),
    )

    expect(selector).toHaveValue('1.20.6')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()

    await user.click(selector)
    await user.keyboard('not-a-release')

    expect(screen.getByRole('status')).toHaveTextContent(
      'No matching full release.',
    )

    await user.tab()

    expect(selector).toHaveValue('1.20.6')
  })

  it('supports keyboard selection from the filtered results', async () => {
    const user = userEvent.setup()

    render(<SelectorHarness />)

    const selector = screen.getByRole('combobox', {
      name: 'Minecraft version',
    })

    await user.click(selector)
    await user.keyboard('1.19')
    await user.keyboard('{ArrowDown}{Enter}')

    expect(selector).toHaveValue('1.19.3')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('identifies server-only releases', async () => {
    const user = userEvent.setup()

    render(<SelectorHarness />)

    const selector = screen.getByRole('combobox', {
      name: 'Minecraft version',
    })

    await user.click(selector)
    await user.keyboard('1.0.1')

    expect(
      screen.getByRole('option', {
        name: 'Java 1.0.1, server only',
      }),
    ).toBeInTheDocument()
  })

  it('does not open or change while disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()

    render(
      <MinecraftVersionSelector
        value={defaultVersion}
        onChange={onChange}
        disabled
      />,
    )

    const selector = screen.getByRole('combobox', {
      name: 'Minecraft version',
    })

    await user.click(selector)

    expect(selector).toBeDisabled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onChange).not.toHaveBeenCalled()
  })
})
