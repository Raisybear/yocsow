package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

enum CubiomesGenerationProfile {
  JAVA_1_21_3("cubiomes/java-1.21.3", 2, "1.21.3"),
  JAVA_1_21_1("cubiomes/java-1.21.1", 1, "1.21.1", "1.21"),
  JAVA_1_20_6("cubiomes/java-1.20.6", 3, "1.20.6"),
  JAVA_1_19_4("cubiomes/java-1.19.4", 4, "1.19.4"),
  JAVA_1_19_2("cubiomes/java-1.19.2", 5, "1.19.2"),
  JAVA_1_18_2("cubiomes/java-1.18.2", 6, "1.18.2"),
  JAVA_1_17_1("cubiomes/java-1.17.1", 7, "1.17.1"),
  JAVA_1_16_5("cubiomes/java-1.16.5", 8, "1.16.5"),
  JAVA_1_16_1("cubiomes/java-1.16.1", 9, "1.16.1"),
  JAVA_1_15_2("cubiomes/java-1.15.2", 10, "1.15.2"),
  JAVA_1_14_4("cubiomes/java-1.14.4", 11, "1.14.4"),
  JAVA_1_13_2("cubiomes/java-1.13.2", 12, "1.13.2"),
  JAVA_1_12_2("cubiomes/java-1.12.2", 13, "1.12.2"),
  JAVA_1_11_2("cubiomes/java-1.11.2", 14, "1.11.2"),
  JAVA_1_10_2("cubiomes/java-1.10.2", 15, "1.10.2"),
  JAVA_1_9_4("cubiomes/java-1.9.4", 16, "1.9.4"),
  JAVA_1_8_9("cubiomes/java-1.8.9", 17, "1.8.9"),
  JAVA_1_7_10("cubiomes/java-1.7.10", 18, "1.7.10"),
  JAVA_1_6_4("cubiomes/java-1.6.4", 19, "1.6.4"),
  JAVA_1_5_2("cubiomes/java-1.5.2", 20, "1.5.2"),
  JAVA_1_4_7("cubiomes/java-1.4.7", 21, "1.4.7"),
  JAVA_1_3_2("cubiomes/java-1.3.2", 22, "1.3.2"),
  JAVA_1_2_5("cubiomes/java-1.2.5", 23, "1.2.5"),
  JAVA_1_1("cubiomes/java-1.1", 24, "1.1"),
  JAVA_1_0_0("cubiomes/java-1.0.0", 25, "1.0.0");

  private static final Map<String, CubiomesGenerationProfile> PROFILES_BY_RELEASE =
      createProfileIndex();

  private final String id;
  private final int nativeVersion;
  private final List<String> releaseIdentifiers;

  CubiomesGenerationProfile(String id, int nativeVersion, String... releaseIdentifiers) {
    this.id = id;
    this.nativeVersion = nativeVersion;
    this.releaseIdentifiers = List.of(releaseIdentifiers);
  }

  String id() {
    return id;
  }

  int nativeVersion() {
    return nativeVersion;
  }

  List<String> releaseIdentifiers() {
    return releaseIdentifiers;
  }

  static CubiomesGenerationProfile resolve(MinecraftVersion minecraftVersion) {
    Objects.requireNonNull(minecraftVersion, "minecraftVersion");

    CubiomesGenerationProfile profile = PROFILES_BY_RELEASE.get(minecraftVersion.identifier());

    if (profile == null) {
      throw new IllegalArgumentException(
          "Minecraft Java release "
              + minecraftVersion.identifier()
              + " does not have a verified Cubiomes generation profile");
    }

    return profile;
  }

  private static Map<String, CubiomesGenerationProfile> createProfileIndex() {
    Map<String, CubiomesGenerationProfile> profilesByRelease = new HashMap<>();

    for (CubiomesGenerationProfile profile : values()) {
      for (String releaseIdentifier : profile.releaseIdentifiers) {
        CubiomesGenerationProfile existing = profilesByRelease.put(releaseIdentifier, profile);

        if (existing != null) {
          throw new IllegalStateException(
              "Minecraft Java release "
                  + releaseIdentifier
                  + " belongs to multiple Cubiomes generation profiles");
        }
      }
    }

    return Map.copyOf(profilesByRelease);
  }
}
