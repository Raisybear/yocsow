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

export const cubiomesVersionHeaderPath = resolve(
  scriptDirectory,
  '..',
  'third_party',
  'cubiomes',
  'biomes.h',
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

function validateGenerationProfilePolicy(catalog, uniqueReleaseIds) {
  const policy = catalog.generationProfilePolicy

  requireCondition(
    policy !== null && typeof policy === 'object' && !Array.isArray(policy),
    'generationProfilePolicy must be an object',
  )
  requireCondition(
    typeof policy.pendingProfilePrefix === 'string' &&
      /^[a-z0-9][a-z0-9./-]*\/$/.test(policy.pendingProfilePrefix),
    'pendingProfilePrefix must be a stable path-like prefix',
  )
  requireCondition(
    Array.isArray(policy.verifiedProfiles),
    'verifiedProfiles must be an array',
  )

  const profileIds = new Set()
  const assignedReleaseIds = new Set()

  for (const profile of policy.verifiedProfiles) {
    requireCondition(
      profile !== null && typeof profile === 'object' && !Array.isArray(profile),
      'every verified profile must be an object',
    )
    requireCondition(
      typeof profile.id === 'string' &&
        /^[a-z0-9][a-z0-9./-]*$/.test(profile.id),
      'every verified profile must have a stable id',
    )
    requireCondition(
      !profile.id.startsWith(policy.pendingProfilePrefix),
      `verified profile ${profile.id} uses the reserved pending prefix`,
    )
    requireCondition(
      !profileIds.has(profile.id),
      `duplicate verified profile id ${profile.id}`,
    )
    profileIds.add(profile.id)

    requireCondition(
      Array.isArray(profile.releaseIds) && profile.releaseIds.length > 0,
      `verified profile ${profile.id} must contain releaseIds`,
    )
    requireCondition(
      new Set(profile.releaseIds).size === profile.releaseIds.length,
      `verified profile ${profile.id} contains duplicate releases`,
    )
    requireCondition(
      profile.releaseIds.includes(profile.representativeReleaseId),
      `verified profile ${profile.id} must contain its representative release`,
    )
    requireCondition(
      profile.backend !== null &&
        typeof profile.backend === 'object' &&
        !Array.isArray(profile.backend),
      `verified profile ${profile.id} must declare a backend`,
    )
    requireCondition(
      /^[a-z][a-z0-9-]*$/.test(profile.backend.provider),
      `verified profile ${profile.id} has an invalid backend provider`,
    )
    requireCondition(
      typeof profile.backend.version === 'string' &&
        profile.backend.version.length > 0,
      `verified profile ${profile.id} must declare a backend version`,
    )
    requireCondition(
      ['supported', 'experimental'].includes(profile.backend.supportLevel),
      `verified profile ${profile.id} has an invalid backend support level`,
    )

    for (const releaseId of profile.releaseIds) {
      requireCondition(
        uniqueReleaseIds.has(releaseId),
        `verified profile ${profile.id} references unknown release ${releaseId}`,
      )
      requireCondition(
        !assignedReleaseIds.has(releaseId),
        `release ${releaseId} belongs to more than one verified profile`,
      )
      assignedReleaseIds.add(releaseId)
    }
  }
}

export function validateMinecraftJavaGenerationProfileBindings(
  catalog,
  cubiomesHeaderPath = cubiomesVersionHeaderPath,
) {
  validateMinecraftJavaReleaseCatalog(catalog)

  const cubiomesHeader = readFileSync(cubiomesHeaderPath, 'utf8')
  const availableCubiomesVersions = new Set(
    cubiomesHeader.match(/\bMC_[A-Z0-9_]+\b/g) ?? [],
  )
  const backendBindings = new Set()

  for (const profile of catalog.generationProfilePolicy.verifiedProfiles) {
    const binding = `${profile.backend.provider}/${profile.backend.version}`

    requireCondition(
      !backendBindings.has(binding),
      `backend binding ${binding} is assigned to more than one profile`,
    )
    backendBindings.add(binding)

    if (profile.backend.provider === 'cubiomes') {
      requireCondition(
        /^MC_[A-Z0-9_]+$/.test(profile.backend.version),
        `profile ${profile.id} has an invalid Cubiomes version symbol`,
      )
      requireCondition(
        availableCubiomesVersions.has(profile.backend.version),
        `profile ${profile.id} references missing Cubiomes version ${profile.backend.version}`,
      )
    }
  }

  return catalog
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

  validateGenerationProfilePolicy(catalog, uniqueReleaseIds)

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

export function createMinecraftJavaGenerationProfileIndex(catalog) {
  validateMinecraftJavaReleaseCatalog(catalog)

  const verifiedProfileByReleaseId = new Map()

  for (const profile of catalog.generationProfilePolicy.verifiedProfiles) {
    const normalizedProfile = Object.freeze({
      id: profile.id,
      representativeReleaseId: profile.representativeReleaseId,
      releaseIds: Object.freeze([...profile.releaseIds]),
      verificationStatus: 'verified',
      backend: Object.freeze({ ...profile.backend }),
    })

    for (const releaseId of profile.releaseIds) {
      verifiedProfileByReleaseId.set(releaseId, normalizedProfile)
    }
  }

  const profiles = []
  const profileByReleaseId = Object.create(null)
  const addedProfileIds = new Set()

  for (const releaseId of catalog.releaseIds) {
    const verifiedProfile = verifiedProfileByReleaseId.get(releaseId)
    const profile =
      verifiedProfile ??
      Object.freeze({
        id: `${catalog.generationProfilePolicy.pendingProfilePrefix}${releaseId}`,
        representativeReleaseId: releaseId,
        releaseIds: Object.freeze([releaseId]),
        verificationStatus: 'pending',
      })

    profileByReleaseId[releaseId] = profile

    if (!addedProfileIds.has(profile.id)) {
      profiles.push(profile)
      addedProfileIds.add(profile.id)
    }
  }

  return Object.freeze({
    profiles: Object.freeze(profiles),
    profileByReleaseId: Object.freeze(profileByReleaseId),
  })
}

export function requireMinecraftJavaGenerationProfile(index, releaseId) {
  const profile = index.profileByReleaseId[releaseId]

  if (profile === undefined) {
    throw new Error(`Unknown Minecraft Java release: ${releaseId}`)
  }

  return profile
}

export function loadMinecraftJavaReleaseCatalog(
  catalogPath = minecraftJavaReleaseCatalogPath,
) {
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'))
  return validateMinecraftJavaGenerationProfileBindings(catalog)
}
