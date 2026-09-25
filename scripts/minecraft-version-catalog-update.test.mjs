import assert from 'node:assert/strict'
import test from 'node:test'
import { loadMinecraftJavaReleaseCatalog } from './minecraft-version-catalog.mjs'
import {
  createUpdatedMinecraftJavaReleaseCatalog,
  describeReleaseCatalogDifference,
  releaseIdsFromMojangManifest,
} from './update-minecraft-version-catalog.mjs'

function manifestForCatalog(catalog, additionalVersions = []) {
  const exceptions = new Set(catalog.launcherManifestExceptions)
  const releaseVersions = catalog.releaseIds
    .filter((releaseId) => !exceptions.has(releaseId))
    .map((releaseId) => ({
      id: catalog.launcherAliases[releaseId] ?? releaseId,
      type: 'release',
    }))

  return {
    latest: { release: additionalVersions[0]?.id ?? releaseVersions[0].id },
    versions: [
      ...additionalVersions,
      { id: 'future-snapshot', type: 'snapshot' },
      ...releaseVersions,
      { id: '1.7.3', type: 'release' },
      { id: 'b1.8.1', type: 'release' },
    ],
  }
}

test('reconstructs the checked-in release list from a launcher manifest', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  const manifest = manifestForCatalog(catalog)

  assert.deepEqual(releaseIdsFromMojangManifest(catalog, manifest), catalog.releaseIds)
})

test('adds a new full release as an exact catalog entry', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  const manifest = manifestForCatalog(catalog, [{ id: '26.4', type: 'release' }])
  const updated = createUpdatedMinecraftJavaReleaseCatalog(
    catalog,
    manifest,
    '2026-12-01',
  )
  const difference = describeReleaseCatalogDifference(
    catalog.releaseIds,
    updated.releaseIds,
  )

  assert.equal(updated.latestRelease, '26.4')
  assert.equal(updated.releaseIds[0], '26.4')
  assert.deepEqual(difference, { added: ['26.4'], removed: [] })
  assert.equal(
    updated.sources.find((source) => source.id === 'mojang-launcher-manifest')
      .retrievedOn,
    '2026-12-01',
  )
  assert.deepEqual(
    updated.generationProfilePolicy,
    catalog.generationProfilePolicy,
  )
})

test('ignores development versions and releases before 1.0', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  const manifest = manifestForCatalog(catalog, [
    { id: '26.4-snapshot-1', type: 'snapshot' },
  ])
  manifest.latest.release = catalog.latestRelease

  const releaseIds = releaseIdsFromMojangManifest(catalog, manifest)

  assert.ok(!releaseIds.includes('26.4-snapshot-1'))
  assert.ok(!releaseIds.includes('1.7.3'))
  assert.ok(!releaseIds.includes('b1.8.1'))
})

test('rejects manifests without the full-release boundary', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  const manifest = manifestForCatalog(catalog)
  manifest.versions = manifest.versions.filter((version) => version.id !== '1.0')

  assert.throws(
    () => releaseIdsFromMojangManifest(catalog, manifest),
    /does not contain the 1.0 release boundary/,
  )
})
