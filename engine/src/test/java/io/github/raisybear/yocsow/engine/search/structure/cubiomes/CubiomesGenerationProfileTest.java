package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import static java.util.Map.entry;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import java.util.Map;
import org.junit.jupiter.api.Test;

final class CubiomesGenerationProfileTest {

  @Test
  void resolvesEveryVerifiedReleaseToItsExplicitNativeProfile() {
    Map<String, ExpectedProfile> expectedProfiles =
        Map.ofEntries(
            entry("1.21.3", new ExpectedProfile("cubiomes/java-1.21.3", 2)),
            entry("1.21.1", new ExpectedProfile("cubiomes/java-1.21.1", 1)),
            entry("1.21", new ExpectedProfile("cubiomes/java-1.21.1", 1)),
            entry("1.20.6", new ExpectedProfile("cubiomes/java-1.20.6", 3)),
            entry("1.19.4", new ExpectedProfile("cubiomes/java-1.19.4", 4)),
            entry("1.19.2", new ExpectedProfile("cubiomes/java-1.19.2", 5)),
            entry("1.18.2", new ExpectedProfile("cubiomes/java-1.18.2", 6)),
            entry("1.17.1", new ExpectedProfile("cubiomes/java-1.17.1", 7)),
            entry("1.16.5", new ExpectedProfile("cubiomes/java-1.16.5", 8)),
            entry("1.16.1", new ExpectedProfile("cubiomes/java-1.16.1", 9)),
            entry("1.15.2", new ExpectedProfile("cubiomes/java-1.15.2", 10)),
            entry("1.14.4", new ExpectedProfile("cubiomes/java-1.14.4", 11)),
            entry("1.13.2", new ExpectedProfile("cubiomes/java-1.13.2", 12)),
            entry("1.12.2", new ExpectedProfile("cubiomes/java-1.12.2", 13)),
            entry("1.11.2", new ExpectedProfile("cubiomes/java-1.11.2", 14)),
            entry("1.10.2", new ExpectedProfile("cubiomes/java-1.10.2", 15)),
            entry("1.9.4", new ExpectedProfile("cubiomes/java-1.9.4", 16)),
            entry("1.8.9", new ExpectedProfile("cubiomes/java-1.8.9", 17)),
            entry("1.7.10", new ExpectedProfile("cubiomes/java-1.7.10", 18)),
            entry("1.6.4", new ExpectedProfile("cubiomes/java-1.6.4", 19)),
            entry("1.5.2", new ExpectedProfile("cubiomes/java-1.5.2", 20)),
            entry("1.4.7", new ExpectedProfile("cubiomes/java-1.4.7", 21)),
            entry("1.3.2", new ExpectedProfile("cubiomes/java-1.3.2", 22)),
            entry("1.2.5", new ExpectedProfile("cubiomes/java-1.2.5", 23)),
            entry("1.1", new ExpectedProfile("cubiomes/java-1.1", 24)),
            entry("1.0.0", new ExpectedProfile("cubiomes/java-1.0.0", 25)));

    assertEquals(26, expectedProfiles.size());

    for (Map.Entry<String, ExpectedProfile> entry : expectedProfiles.entrySet()) {
      CubiomesGenerationProfile profile =
          CubiomesGenerationProfile.resolve(MinecraftVersion.fromIdentifier(entry.getKey()));

      assertEquals(entry.getValue().id(), profile.id());
      assertEquals(entry.getValue().nativeVersion(), profile.nativeVersion());
    }

    assertSame(
        CubiomesGenerationProfile.resolve(MinecraftVersion.fromIdentifier("1.21.1")),
        CubiomesGenerationProfile.resolve(MinecraftVersion.fromIdentifier("1.21")));
  }

  @Test
  void rejectsReleasesWithoutVerifiedCubiomesProfiles() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> CubiomesGenerationProfile.resolve(MinecraftVersion.fromIdentifier("1.20.5")));

    assertEquals(
        "Minecraft Java release 1.20.5 does not have a verified Cubiomes generation profile",
        error.getMessage());
  }

  private record ExpectedProfile(String id, int nativeVersion) {}
}
