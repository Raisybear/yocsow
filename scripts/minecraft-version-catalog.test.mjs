import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createMinecraftJavaGenerationProfileIndex,
  loadMinecraftJavaReleaseCatalog,
  requireMinecraftJavaGenerationProfile,
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

test('assigns every release a conservative generation profile', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  const index = createMinecraftJavaGenerationProfileIndex(catalog)

  assert.equal(
    Object.keys(index.profileByReleaseId).length,
    catalog.releaseIds.length,
  )
  assert.equal(index.profiles.length, catalog.releaseIds.length)

  for (const releaseId of catalog.releaseIds) {
    const profile = requireMinecraftJavaGenerationProfile(index, releaseId)

    assert.equal(profile.id, `pending/java/${releaseId}`)
    assert.equal(profile.representativeReleaseId, releaseId)
    assert.deepEqual(profile.releaseIds, [releaseId])
    assert.equal(profile.verificationStatus, 'pending')
  }

  assert.throws(
    () => requireMinecraftJavaGenerationProfile(index, 'not-a-release'),
    /Unknown Minecraft Java release/,
  )
})

test('shares a profile only after releases are explicitly verified together', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  catalog.generationProfilePolicy.verifiedProfiles.push({
    id: 'cubiomes/java-1.21.1',
    representativeReleaseId: '1.21.1',
    releaseIds: ['1.21.1', '1.21'],
  })

  const index = createMinecraftJavaGenerationProfileIndex(catalog)
  const patchProfile = requireMinecraftJavaGenerationProfile(index, '1.21.1')
  const baseProfile = requireMinecraftJavaGenerationProfile(index, '1.21')

  assert.strictEqual(baseProfile, patchProfile)
  assert.equal(patchProfile.id, 'cubiomes/java-1.21.1')
  assert.equal(patchProfile.verificationStatus, 'verified')
  assert.equal(index.profiles.length, catalog.releaseIds.length - 1)
  assert.equal(
    requireMinecraftJavaGenerationProfile(index, '1.20.6').verificationStatus,
    'pending',
  )
})

test('rejects ambiguous or invalid verified generation profiles', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  catalog.generationProfilePolicy.verifiedProfiles.push(
    {
      id: 'cubiomes/java-1.21.1',
      representativeReleaseId: '1.21.1',
      releaseIds: ['1.21.1', '1.21'],
    },
    {
      id: 'cubiomes/java-1.21',
      representativeReleaseId: '1.21',
      releaseIds: ['1.21'],
    },
  )

  assert.throws(
    () => validateMinecraftJavaReleaseCatalog(catalog),
    /belongs to more than one verified profile/,
  )

  const unknownRelease = loadMinecraftJavaReleaseCatalog()
  unknownRelease.generationProfilePolicy.verifiedProfiles.push({
    id: 'cubiomes/future',
    representativeReleaseId: 'future',
    releaseIds: ['future'],
  })

  assert.throws(
    () => validateMinecraftJavaReleaseCatalog(unknownRelease),
    /references unknown release/,
  )

  const missingRepresentative = loadMinecraftJavaReleaseCatalog()
  missingRepresentative.generationProfilePolicy.verifiedProfiles.push({
    id: 'cubiomes/java-1.21',
    representativeReleaseId: '1.21.1',
    releaseIds: ['1.21'],
  })

  assert.throws(
    () => validateMinecraftJavaReleaseCatalog(missingRepresentative),
    /must contain its representative release/,
  )
})
