import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))

export const minecraftJavaReleaseCatalogPath = resolve(
  scriptDirectory,
  '..',
  'config',
  'minecraft-java-releases.json',
)

function requireCondition(condition, message) {
  if (!condition) {
    throw new Error(`Invalid Minecraft Java release catalog: ${message}`)
  }
}

function numericParts(identifier) {
  requireCondition(
    /^\d+(?:\.\d+)+$/.test(identifier),
    `invalid release identifier ${JSON.stringify(identifier)}`,
  )

  return identifier.split('.').map(Number)
}

export function compareMinecraftReleaseIds(left, right) {
  const leftParts = numericParts(left)
  const rightParts = numericParts(right)
  const partCount = Math.max(leftParts.length, rightParts.length)

  for (let index = 0; index < partCount; index++) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0)

    if (difference !== 0) {
      return difference
    }
  }

  return 0
}

export function validateMinecraftJavaReleaseCatalog(catalog) {
  requireCondition(catalog?.schemaVersion === 1, 'schemaVersion must be 1')
  requireCondition(catalog.edition === 'java', 'edition must be java')
  requireCondition(catalog.channel === 'release', 'channel must be release')
  requireCondition(
    Array.isArray(catalog.releaseIds) && catalog.releaseIds.length > 0,
    'releaseIds must be a non-empty array',
  )

  const releaseIds = catalog.releaseIds
  const uniqueReleaseIds = new Set(releaseIds)

  requireCondition(
    uniqueReleaseIds.size === releaseIds.length,
    'releaseIds must not contain duplicates',
  )
  requireCondition(
    catalog.latestRelease === releaseIds[0],
    'latestRelease must match the first releaseId',
  )

  for (let index = 0; index < releaseIds.length; index++) {
    numericParts(releaseIds[index])

    if (index > 0) {
      requireCondition(
        compareMinecraftReleaseIds(releaseIds[index - 1], releaseIds[index]) > 0,
        'releaseIds must be ordered newest first without numeric aliases',
      )
    }
  }

  requireCondition(
    catalog.launcherAliases !== null &&
      typeof catalog.launcherAliases === 'object' &&
      !Array.isArray(catalog.launcherAliases),
    'launcherAliases must be an object',
  )

  for (const [releaseId, launcherId] of Object.entries(catalog.launcherAliases)) {
    requireCondition(
      uniqueReleaseIds.has(releaseId),
      `launcher alias references unknown release ${releaseId}`,
    )
    requireCondition(
      typeof launcherId === 'string' && launcherId.length > 0,
      `launcher alias for ${releaseId} must be a non-empty string`,
    )
  }

  requireCondition(
    Array.isArray(catalog.serverOnlyReleaseIds),
    'serverOnlyReleaseIds must be an array',
  )
  requireCondition(
    new Set(catalog.serverOnlyReleaseIds).size ===
      catalog.serverOnlyReleaseIds.length,
    'serverOnlyReleaseIds must not contain duplicates',
  )

  for (const releaseId of catalog.serverOnlyReleaseIds) {
    requireCondition(
      uniqueReleaseIds.has(releaseId),
      `server-only list references unknown release ${releaseId}`,
    )
  }

  requireCondition(
    Array.isArray(catalog.sources) && catalog.sources.length > 0,
    'sources must be a non-empty array',
  )

  for (const source of catalog.sources) {
    requireCondition(
      typeof source?.id === 'string' && source.id.length > 0,
      'every source must have an id',
    )
    requireCondition(
      typeof source.url === 'string' && source.url.startsWith('https://'),
      `source ${source.id} must use an HTTPS URL`,
    )
    requireCondition(
      /^\d{4}-\d{2}-\d{2}$/.test(source.retrievedOn),
      `source ${source.id} must have an ISO retrieval date`,
    )
  }

  return catalog
}

export function loadMinecraftJavaReleaseCatalog(
  catalogPath = minecraftJavaReleaseCatalogPath,
) {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  return validateMinecraftJavaReleaseCatalog(catalog)
}
