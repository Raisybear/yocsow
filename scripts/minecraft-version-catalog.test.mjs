import assert from 'node:assert/strict'
import test from 'node:test'
import './minecraft-version-catalog-update.test.mjs'
import {
  createMinecraftJavaGenerationProfileIndex,
  loadMinecraftJavaReleaseCatalog,
  requireMinecraftJavaGenerationProfile,
  validateMinecraftJavaReleaseCatalog,
  validateMinecraftJavaGenerationProfileBindings,
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
  assert.deepEqual(catalog.launcherManifestExceptions, ['1.5', '1.0.1'])
  assert.deepEqual(catalog.launcherManifestExclusions, ['1.7.3'])
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

test('assigns every release exactly one generation profile', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  const index = createMinecraftJavaGenerationProfileIndex(catalog)

  assert.equal(
    Object.keys(index.profileByReleaseId).length,
    catalog.releaseIds.length,
  )
  assert.equal(index.profiles.length, catalog.releaseIds.length)

  for (const releaseId of catalog.releaseIds) {
    const profile = requireMinecraftJavaGenerationProfile(index, releaseId)

    assert.ok(profile.releaseIds.includes(releaseId))
    assert.ok(profile.releaseIds.includes(profile.representativeReleaseId))

    if (profile.verificationStatus === 'pending') {
      assert.equal(profile.id, `pending/java/${releaseId}`)
      assert.equal(profile.representativeReleaseId, releaseId)
      assert.deepEqual(profile.releaseIds, [releaseId])
    } else {
      assert.equal(profile.verificationStatus, 'verified')
      assert.ok(profile.backend)
    }
  }

  assert.throws(
    () => requireMinecraftJavaGenerationProfile(index, 'not-a-release'),
    /Unknown Minecraft Java release/,
  )
})

test('shares a profile only after releases are explicitly verified together', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  catalog.generationProfilePolicy.verifiedProfiles.push({
    id: 'fixture/java-1.20.5-1.20.4',
    representativeReleaseId: '1.20.5',
    releaseIds: ['1.20.5', '1.20.4'],
    backend: {
      provider: 'fixture',
      version: 'same-generation',
      supportLevel: 'supported',
    },
  })

  const index = createMinecraftJavaGenerationProfileIndex(catalog)
  const patchProfile = requireMinecraftJavaGenerationProfile(index, '1.20.5')
  const baseProfile = requireMinecraftJavaGenerationProfile(index, '1.20.4')

  assert.strictEqual(baseProfile, patchProfile)
  assert.equal(patchProfile.id, 'fixture/java-1.20.5-1.20.4')
  assert.equal(patchProfile.verificationStatus, 'verified')
  assert.deepEqual(patchProfile.backend, {
    provider: 'fixture',
    version: 'same-generation',
    supportLevel: 'supported',
  })
  assert.equal(index.profiles.length, catalog.releaseIds.length - 1)
  assert.equal(
    requireMinecraftJavaGenerationProfile(index, '1.20.3').verificationStatus,
    'pending',
  )
})

test('rejects ambiguous or invalid verified generation profiles', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  catalog.generationProfilePolicy.verifiedProfiles.push(
    {
      id: 'fixture/java-1.20.5-1.20.4',
      representativeReleaseId: '1.20.5',
      releaseIds: ['1.20.5', '1.20.4'],
      backend: {
        provider: 'fixture',
        version: 'same-generation',
        supportLevel: 'supported',
      },
    },
    {
      id: 'fixture/java-1.20.4',
      representativeReleaseId: '1.20.4',
      releaseIds: ['1.20.4'],
      backend: {
        provider: 'fixture',
        version: 'other-generation',
        supportLevel: 'supported',
      },
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
    backend: {
      provider: 'cubiomes',
      version: 'MC_NEWEST',
      supportLevel: 'supported',
    },
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
    backend: {
      provider: 'cubiomes',
      version: 'MC_1_21_1',
      supportLevel: 'supported',
    },
  })

  assert.throws(
    () => validateMinecraftJavaReleaseCatalog(missingRepresentative),
    /must contain its representative release/,
  )
})

test('binds only explicit Cubiomes release profiles', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  const index = createMinecraftJavaGenerationProfileIndex(catalog)
  const expectedBindings = new Map([
    ['1.21.3', 'MC_1_21_3'],
    ['1.21.1', 'MC_1_21_1'],
    ['1.20.6', 'MC_1_20_6'],
    ['1.19.4', 'MC_1_19_4'],
    ['1.19.2', 'MC_1_19_2'],
    ['1.18.2', 'MC_1_18_2'],
    ['1.17.1', 'MC_1_17_1'],
    ['1.16.5', 'MC_1_16_5'],
    ['1.16.1', 'MC_1_16_1'],
    ['1.15.2', 'MC_1_15_2'],
    ['1.14.4', 'MC_1_14_4'],
    ['1.13.2', 'MC_1_13_2'],
    ['1.12.2', 'MC_1_12_2'],
    ['1.11.2', 'MC_1_11_2'],
    ['1.10.2', 'MC_1_10_2'],
    ['1.9.4', 'MC_1_9_4'],
    ['1.8.9', 'MC_1_8_9'],
    ['1.7.10', 'MC_1_7_10'],
    ['1.6.4', 'MC_1_6_4'],
    ['1.5.2', 'MC_1_5_2'],
    ['1.4.7', 'MC_1_4_7'],
    ['1.3.2', 'MC_1_3_2'],
    ['1.2.5', 'MC_1_2_5'],
    ['1.1', 'MC_1_1_0'],
    ['1.0.0', 'MC_1_0_0'],
  ])

  assert.equal(
    catalog.generationProfilePolicy.verifiedProfiles.length,
    expectedBindings.size,
  )

  for (const [releaseId, cubiomesVersion] of expectedBindings) {
    const profile = requireMinecraftJavaGenerationProfile(index, releaseId)

    assert.equal(profile.verificationStatus, 'verified')
    assert.equal(profile.backend.provider, 'cubiomes')
    assert.equal(profile.backend.version, cubiomesVersion)
  }

  assert.equal(
    requireMinecraftJavaGenerationProfile(index, '1.0.0').backend.supportLevel,
    'experimental',
  )

  for (const pendingRelease of ['26.3', '1.21.4', '1.21', '1.20.5', '1.0.1']) {
    assert.equal(
      requireMinecraftJavaGenerationProfile(index, pendingRelease)
        .verificationStatus,
      'pending',
    )
  }
})

test('rejects Cubiomes bindings missing from the vendored header', () => {
  const catalog = loadMinecraftJavaReleaseCatalog()
  catalog.generationProfilePolicy.verifiedProfiles[0].backend.version =
    'MC_NOT_A_REAL_VERSION'

  assert.throws(
    () => validateMinecraftJavaGenerationProfileBindings(catalog),
    /references missing Cubiomes version/,
  )
})
