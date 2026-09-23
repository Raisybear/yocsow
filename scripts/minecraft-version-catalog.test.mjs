import assert from 'node:assert/strict'
import test from 'node:test'
import {
  loadMinecraftJavaReleaseCatalog,
  validateMinecraftJavaReleaseCatalog,
} from './minecraft-version-catalog.mjs'

test('loads every Java full release through 26.3', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()

  assert.equal(catalog.latestRelease, '26.3')
  assert.equal(catalog.releaseIds.length, 104)
  assert.deepEqual(catalog.releaseIds.slice(0, 5), [
    '26.3',
    '26.2',
    '26.1.2',
    '26.1.1',
    '26.1',
  ])
  assert.deepEqual(catalog.releaseIds.slice(-4), [
    '1.2.1',
    '1.1',
    '1.0.1',
    '1.0.0',
  ])

  assert.ok(catalog.releaseIds.includes('1.5'))
  assert.equal(catalog.launcherAliases['1.0.0'], '1.0')
  assert.deepEqual(catalog.serverOnlyReleaseIds, ['1.0.1'])

  for (const developmentVersion of [
    '26.4',
    '26.3-rc1',
    '1.21.5-pre1',
    '25w02a',
  ]) {
    assert.ok(!catalog.releaseIds.includes(developmentVersion))
  }
})

test('rejects duplicate, unordered, or unknown catalog references', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  const duplicate = structuredClone(catalog)
  duplicate.releaseIds.splice(1, 0, duplicate.releaseIds[0])

  assert.throws(
    () => validateMinecraftJavaReleaseCatalog(duplicate),
    /must not contain duplicates/,
  )

  const unordered = structuredClone(catalog)
  ;[unordered.releaseIds[1], unordered.releaseIds[2]] = [
    unordered.releaseIds[2],
    unordered.releaseIds[1],
  ]

  assert.throws(
    () => validateMinecraftJavaReleaseCatalog(unordered),
    /ordered newest first/,
  )

  const unknownServerOnlyRelease = structuredClone(catalog)
  unknownServerOnlyRelease.serverOnlyReleaseIds.push('not-a-release')

  assert.throws(
    () => validateMinecraftJavaReleaseCatalog(unknownServerOnlyRelease),
    /server-only list references unknown release/,
  )
})
