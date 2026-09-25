#!/usr/bin/env node

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  compareMinecraftReleaseIds,
  loadMinecraftJavaReleaseCatalog,
  minecraftJavaReleaseCatalogPath,
  validateMinecraftJavaReleaseCatalog,
} from './minecraft-version-catalog.mjs'

export const mojangVersionManifestUrl =
  'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(`Cannot update Minecraft Java release catalog: ${message}`)
  }
}

function canonicalReleaseId(catalog, launcherId) {
  for (const [releaseId, alias] of Object.entries(catalog.launcherAliases)) {
    if (alias === launcherId) {
      return releaseId
    }
  }

  return launcherId
}

export function releaseIdsFromMojangManifest(catalog, manifest) {
  validateMinecraftJavaReleaseCatalog(catalog)
  requireCondition(
    manifest !== null && typeof manifest === 'object' && !Array.isArray(manifest),
    'manifest must be an object',
  )
  requireCondition(
    typeof manifest.latest?.release === 'string',
    'manifest must declare latest.release',
  )
  requireCondition(
    Array.isArray(manifest.versions),
    'manifest must contain versions',
  )

  const launcherOldestRelease = catalog.launcherAliases['1.0.0'] ?? '1.0.0'
  const launcherReleases = manifest.versions.filter(
    (version) => version?.type === 'release' && typeof version.id === 'string',
  )
  const oldestReleaseIndex = launcherReleases.findIndex(
    (version) => version.id === launcherOldestRelease,
  )

  requireCondition(
    oldestReleaseIndex >= 0,
    `manifest does not contain the ${launcherOldestRelease} release boundary`,
  )

  const releaseIds = new Set(
    launcherReleases
      .slice(0, oldestReleaseIndex + 1)
      .map((version) => canonicalReleaseId(catalog, version.id))
      .filter(
        (releaseId) => !catalog.launcherManifestExclusions.includes(releaseId),
      ),
  )

  for (const releaseId of catalog.launcherManifestExceptions) {
    releaseIds.add(releaseId)
  }

  const sortedReleaseIds = [...releaseIds].sort((left, right) =>
    compareMinecraftReleaseIds(right, left),
  )
  const canonicalLatestRelease = canonicalReleaseId(
    catalog,
    manifest.latest.release,
  )

  requireCondition(
    sortedReleaseIds[0] === canonicalLatestRelease,
    'latest.release does not match the newest release entry',
  )

  return sortedReleaseIds
}

export function describeReleaseCatalogDifference(currentReleaseIds, nextReleaseIds) {
  const current = new Set(currentReleaseIds)
  const next = new Set(nextReleaseIds)

  return Object.freeze({
    added: Object.freeze(nextReleaseIds.filter((releaseId) => !current.has(releaseId))),
    removed: Object.freeze(
      currentReleaseIds.filter((releaseId) => !next.has(releaseId)),
    ),
  })
}

export function createUpdatedMinecraftJavaReleaseCatalog(
  catalog,
  manifest,
  retrievedOn,
) {
  requireCondition(
    /^\d{4}-\d{2}-\d{2}$/.test(retrievedOn),
    'retrievedOn must be an ISO date',
  )

  const updatedCatalog = structuredClone(catalog)
  updatedCatalog.releaseIds = releaseIdsFromMojangManifest(catalog, manifest)
  updatedCatalog.latestRelease = updatedCatalog.releaseIds[0]

  const manifestSource = updatedCatalog.sources.find(
    (source) => source.id === 'mojang-launcher-manifest',
  )
  requireCondition(
    manifestSource !== undefined,
    'catalog does not declare the Mojang launcher manifest source',
  )
  manifestSource.retrievedOn = retrievedOn

  return validateMinecraftJavaReleaseCatalog(updatedCatalog)
}

function parseArguments(args) {
  const options = {
    mode: undefined,
    manifestPath: undefined,
    retrievedOn: new Date().toISOString().slice(0, 10),
  }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    switch (argument) {
      case '--check':
      case '--write':
        requireCondition(options.mode === undefined, 'choose either --check or --write')
        options.mode = argument.slice(2)
        break
      case '--manifest':
        options.manifestPath = args[++index]
        requireCondition(options.manifestPath !== undefined, '--manifest needs a path')
        break
      case '--retrieved-on':
        options.retrievedOn = args[++index]
        requireCondition(options.retrievedOn !== undefined, '--retrieved-on needs a date')
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  if (!options.help) {
    requireCondition(options.mode !== undefined, 'choose --check or --write')
  }

  return options
}

async function loadManifest(manifestPath) {
  if (manifestPath !== undefined) {
    return JSON.parse(readFileSync(resolve(manifestPath), 'utf8'))
  }

  const response = await fetch(mojangVersionManifestUrl)
  requireCondition(
    response.ok,
    `Mojang manifest request failed with HTTP ${response.status}`,
  )
  return response.json()
}

function printHelp() {
  console.log(`Usage: node scripts/update-minecraft-version-catalog.mjs MODE [options]

Modes:
  --check                    Fail when the checked-in release list is outdated
  --write                    Update the checked-in release list

Options:
  --manifest <path>          Read a local Mojang manifest instead of downloading it
  --retrieved-on <date>      Override the ISO retrieval date used by --write
  -h, --help                 Show this help`)
}

async function main() {
  const options = parseArguments(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const catalog = loadMinecraftJavaReleaseCatalog()
  const manifest = await loadManifest(options.manifestPath)
  const updatedCatalog = createUpdatedMinecraftJavaReleaseCatalog(
    catalog,
    manifest,
    options.retrievedOn,
  )
  const difference = describeReleaseCatalogDifference(
    catalog.releaseIds,
    updatedCatalog.releaseIds,
  )

  if (options.mode === 'check') {
    requireCondition(
      difference.added.length === 0 && difference.removed.length === 0,
      `catalog differs from Mojang manifest (add: ${difference.added.join(', ') || 'none'}; remove: ${difference.removed.join(', ') || 'none'})`,
    )
    console.log(
      `Minecraft Java release catalog is current through ${catalog.latestRelease}.`,
    )
    return
  }

  writeFileSync(
    minecraftJavaReleaseCatalogPath,
    `${JSON.stringify(updatedCatalog, null, 2)}\n`,
    'utf8',
  )
  console.log(
    `Updated Minecraft Java release catalog through ${updatedCatalog.latestRelease}.`,
  )
  console.log(`Added releases: ${difference.added.join(', ') || 'none'}`)
  console.log(`Removed releases: ${difference.removed.join(', ') || 'none'}`)
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
}
