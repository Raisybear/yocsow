import {
  type FocusEvent,
  type KeyboardEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'
import {
  getMinecraftJavaRelease,
  getMinecraftJavaReleaseSearchSupport,
  LATEST_MINECRAFT_JAVA_RELEASE_ID,
  MINECRAFT_JAVA_RELEASES,
  type MinecraftJavaRelease,
  type MinecraftJavaReleaseId,
} from '../domain/minecraft-version'
import './MinecraftVersionSelector.css'

interface MinecraftVersionSelectorProps {
  value: MinecraftJavaReleaseId
  onChange: (version: MinecraftJavaReleaseId) => void
  disabled?: boolean
  id?: string
}

function matchingReleases(query: string): readonly MinecraftJavaRelease[] {
  const normalizedQuery = query.trim().toLocaleLowerCase()

  if (normalizedQuery.length === 0) {
    return MINECRAFT_JAVA_RELEASES
  }

  return MINECRAFT_JAVA_RELEASES.filter((release) =>
    release.id.toLocaleLowerCase().includes(normalizedQuery),
  )
}

function supportLabel(release: MinecraftJavaRelease): string {
  switch (getMinecraftJavaReleaseSearchSupport(release.id)) {
    case 'supported':
      return 'Supported'
    case 'experimental':
      return 'Experimental'
    case 'pending':
      return 'Pending'
  }
}

function supportDescription(release: MinecraftJavaRelease): string {
  switch (getMinecraftJavaReleaseSearchSupport(release.id)) {
    case 'supported':
      return 'Seed search supported'
    case 'experimental':
      return 'Seed search support is experimental'
    case 'pending':
      return 'Seed search support is pending verification'
  }
}

function releaseMetadata(release: MinecraftJavaRelease): string {
  return [
    release.id === LATEST_MINECRAFT_JAVA_RELEASE_ID ? 'Latest' : null,
    release.serverOnly ? 'Server only' : null,
    supportLabel(release),
  ]
    .filter((label) => label !== null)
    .join(' · ')
}

export function MinecraftVersionSelector({
  value,
  onChange,
  disabled = false,
  id,
}: MinecraftVersionSelectorProps) {
  const generatedId = useId()
  const inputId = id ?? `minecraft-version-${generatedId}`
  const listboxId = `${inputId}-options`
  const helpId = `${inputId}-help`
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const releases = useMemo(() => matchingReleases(query), [query])
  const activeRelease = releases[activeIndex]
  const selectedRelease = getMinecraftJavaRelease(value)
  const selectedSupport = getMinecraftJavaReleaseSearchSupport(value)

  function close(): void {
    setOpen(false)
    setQuery('')
    setActiveIndex(0)
  }

  function selectRelease(release: MinecraftJavaRelease): void {
    onChange(release.id)
    setQuery('')
    setActiveIndex(0)
    setOpen(false)
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    const nextTarget = event.relatedTarget

    if (
      nextTarget instanceof Node &&
      rootRef.current?.contains(nextTarget)
    ) {
      return
    }

    close()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault()
      close()
      inputRef.current?.blur()
      return
    }

    if (event.key === 'Tab') {
      close()
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((currentIndex) =>
        releases.length === 0
          ? 0
          : Math.min(currentIndex + 1, releases.length - 1),
      )
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
      setActiveIndex((currentIndex) => Math.max(currentIndex - 1, 0))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(releases.length - 1, 0))
      return
    }

    if (event.key === 'Enter' && open && activeRelease !== undefined) {
      event.preventDefault()
      selectRelease(activeRelease)
    }
  }

  return (
    <div
      ref={rootRef}
      className="minecraft-version-selector"
      onBlur={handleBlur}
    >
      <div className="minecraft-version-selector-heading">
        <label htmlFor={inputId}>Minecraft version</label>
        <span
          className={`minecraft-version-support minecraft-version-support--${selectedSupport}`}
        >
          {supportLabel(selectedRelease)}
        </span>
      </div>

      <div className="minecraft-version-selector-control">
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          type="text"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          value={open ? query : value}
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={
            open && activeRelease !== undefined
              ? `${inputId}-option-${activeRelease.id}`
              : undefined
          }
          aria-describedby={helpId}
          onFocus={(event) => {
            setOpen(true)
            setQuery('')
            setActiveIndex(0)
            event.currentTarget.select()
          }}
          onChange={(event) => {
            setQuery(event.currentTarget.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />

        <button
          type="button"
          tabIndex={-1}
          disabled={disabled}
          aria-label={open ? 'Hide Minecraft versions' : 'Show Minecraft versions'}
          aria-expanded={open}
          aria-controls={listboxId}
          onMouseDown={(event) => {
            event.preventDefault()
          }}
          onClick={() => {
            if (open) {
              close()
              return
            }

            setOpen(true)
            setQuery('')
            setActiveIndex(0)
            inputRef.current?.focus()
          }}
        >
          <span aria-hidden="true">⌄</span>
        </button>
      </div>

      <small id={helpId}>{supportDescription(selectedRelease)}.</small>

      {open && (
        <div
          id={listboxId}
          className="minecraft-version-options"
          role="listbox"
          aria-label="Minecraft Java releases"
        >
          {releases.length === 0 ? (
            <p role="status">No matching full release.</p>
          ) : (
            releases.map((release, index) => (
              <button
                id={`${inputId}-option-${release.id}`}
                className={
                  index === activeIndex
                    ? 'minecraft-version-option minecraft-version-option--active'
                    : 'minecraft-version-option'
                }
                type="button"
                role="option"
                aria-label={`Java ${release.id}${
                  release.id === LATEST_MINECRAFT_JAVA_RELEASE_ID
                    ? ', latest'
                    : ''
                }${release.serverOnly ? ', server only' : ''}`}
                aria-description={supportDescription(release)}
                aria-selected={release.id === value}
                tabIndex={-1}
                key={release.id}
                onMouseDown={(event) => {
                  event.preventDefault()
                }}
                onMouseEnter={() => {
                  setActiveIndex(index)
                }}
                onClick={() => {
                  selectRelease(release)
                }}
              >
                <strong>Java {release.id}</strong>
                <span
                  className={`minecraft-version-option-metadata minecraft-version-option-metadata--${getMinecraftJavaReleaseSearchSupport(release.id)}`}
                >
                  {releaseMetadata(release)}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
