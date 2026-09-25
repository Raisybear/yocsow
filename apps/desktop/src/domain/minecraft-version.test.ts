import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MINECRAFT_JAVA_RELEASE_ID,
  getMinecraftJavaRelease,
  isMinecraftJavaReleaseId,
  LATEST_MINECRAFT_JAVA_RELEASE_ID,
  MINECRAFT_JAVA_RELEASES,
  requireMinecraftJavaReleaseId,
} from './minecraft-version'

describe('Minecraft Java release contract', () => {
  it('exposes every catalog release in newest-first order', () => {
    const releaseIds = MINECRAFT_JAVA_RELEASES.map((release) => release.id)

    expect(releaseIds.length).toBeGreaterThan(100)
    expect(new Set(releaseIds).size).toBe(releaseIds.length)
    expect(MINECRAFT_JAVA_RELEASES[0]?.id).toBe('26.3')
    expect(MINECRAFT_JAVA_RELEASES.at(-1)?.id).toBe('1.0.0')
    expect(LATEST_MINECRAFT_JAVA_RELEASE_ID).toBe('26.3')
    expect(DEFAULT_MINECRAFT_JAVA_RELEASE_ID).toBe('1.21')
  })

  it('accepts only exact public release identifiers', () => {
    expect(isMinecraftJavaReleaseId('1.21.1')).toBe(true)
    expect(isMinecraftJavaReleaseId('1.0.0')).toBe(true)
    expect(isMinecraftJavaReleaseId('1.0')).toBe(false)
    expect(isMinecraftJavaReleaseId(' 1.21.1')).toBe(false)
    expect(isMinecraftJavaReleaseId('24w14potato')).toBe(false)
    expect(() => requireMinecraftJavaReleaseId('1.7.3')).toThrow(
      'Unknown Minecraft Java release: 1.7.3',
    )
  })

  it('keeps exact releases separate from generation profiles', () => {
    const verifiedRelease = getMinecraftJavaRelease(
      requireMinecraftJavaReleaseId('1.21.1'),
    )
    const pendingRelease = getMinecraftJavaRelease(
      requireMinecraftJavaReleaseId('1.21'),
    )

    expect(verifiedRelease.generationProfile).toEqual({
      status: 'verified',
      id: 'cubiomes/java-1.21.1',
      representativeReleaseId: '1.21.1',
      backend: {
        provider: 'cubiomes',
        version: 'MC_1_21_1',
        supportLevel: 'supported',
      },
    })
    expect(pendingRelease.generationProfile).toEqual({
      status: 'pending',
      id: 'pending/java/1.21',
      representativeReleaseId: '1.21',
    })
  })

  it('retains release-specific metadata', () => {
    expect(
      getMinecraftJavaRelease(requireMinecraftJavaReleaseId('1.0.1'))
        .serverOnly,
    ).toBe(true)
    expect(
      getMinecraftJavaRelease(requireMinecraftJavaReleaseId('1.0.0'))
        .serverOnly,
    ).toBe(false)
  })
})
