import releaseCatalog from '../../../../config/minecraft-java-releases.json'

declare const minecraftJavaReleaseIdBrand: unique symbol

export type MinecraftJavaReleaseId = string & {
  readonly [minecraftJavaReleaseIdBrand]: true
}

export type MinecraftGenerationSupportLevel =
  | 'supported'
  | 'experimental'

export interface MinecraftGenerationBackend {
  provider: string
  version: string
  supportLevel: MinecraftGenerationSupportLevel
}

export type MinecraftGenerationProfile =
  | {
      status: 'verified'
      id: string
      representativeReleaseId: MinecraftJavaReleaseId
      backend: MinecraftGenerationBackend
    }
  | {
      status: 'pending'
      id: string
      representativeReleaseId: MinecraftJavaReleaseId
    }

export interface MinecraftJavaRelease {
  id: MinecraftJavaReleaseId
  serverOnly: boolean
  generationProfile: MinecraftGenerationProfile
}

interface CatalogGenerationProfile {
  id: string
  representativeReleaseId: string
  releaseIds: string[]
  backend: MinecraftGenerationBackend
}

interface MinecraftJavaReleaseCatalogData {
  latestRelease: string
  releaseIds: string[]
  serverOnlyReleaseIds: string[]
  generationProfilePolicy: {
    pendingProfilePrefix: string
    verifiedProfiles: CatalogGenerationProfile[]
  }
}

const catalog = releaseCatalog as MinecraftJavaReleaseCatalogData
const releaseIdValues = new Set(catalog.releaseIds)
const serverOnlyReleaseIds = new Set(catalog.serverOnlyReleaseIds)
const verifiedProfilesByReleaseId = new Map<
  string,
  MinecraftGenerationProfile
>()

function asReleaseId(value: string): MinecraftJavaReleaseId {
  return value as MinecraftJavaReleaseId
}

for (const profile of catalog.generationProfilePolicy.verifiedProfiles) {
  const generationProfile = Object.freeze({
    status: 'verified' as const,
    id: profile.id,
    representativeReleaseId: asReleaseId(
      profile.representativeReleaseId,
    ),
    backend: Object.freeze({ ...profile.backend }),
  })

  for (const releaseId of profile.releaseIds) {
    verifiedProfilesByReleaseId.set(releaseId, generationProfile)
  }
}

function createRelease(releaseId: string): MinecraftJavaRelease {
  const id = asReleaseId(releaseId)
  const generationProfile =
    verifiedProfilesByReleaseId.get(releaseId) ??
    Object.freeze({
      status: 'pending' as const,
      id: `${catalog.generationProfilePolicy.pendingProfilePrefix}${releaseId}`,
      representativeReleaseId: id,
    })

  return Object.freeze({
    id,
    serverOnly: serverOnlyReleaseIds.has(releaseId),
    generationProfile,
  })
}

export const MINECRAFT_JAVA_RELEASES: readonly MinecraftJavaRelease[] =
  Object.freeze(catalog.releaseIds.map(createRelease))

const releasesById = new Map(
  MINECRAFT_JAVA_RELEASES.map((release) => [release.id, release]),
)

export const LATEST_MINECRAFT_JAVA_RELEASE_ID =
  requireMinecraftJavaReleaseId(catalog.latestRelease)

export const DEFAULT_MINECRAFT_JAVA_RELEASE_ID =
  requireMinecraftJavaReleaseId('1.21')

export function isMinecraftJavaReleaseId(
  value: string,
): value is MinecraftJavaReleaseId {
  return releaseIdValues.has(value)
}

export function requireMinecraftJavaReleaseId(
  value: string,
): MinecraftJavaReleaseId {
  if (!isMinecraftJavaReleaseId(value)) {
    throw new Error(`Unknown Minecraft Java release: ${value}`)
  }

  return value
}

export function getMinecraftJavaRelease(
  releaseId: MinecraftJavaReleaseId,
): MinecraftJavaRelease {
  const release = releasesById.get(releaseId)

  if (release === undefined) {
    throw new Error(`Unknown Minecraft Java release: ${releaseId}`)
  }

  return release
}
