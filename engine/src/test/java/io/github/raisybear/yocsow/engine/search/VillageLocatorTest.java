package io.github.raisybear.yocsow.engine.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Optional;
import org.junit.jupiter.api.Test;

class VillageLocatorTest {

  @Test
  void createsVersionedVillageSearchRequests() {
    StructureRequirement requirement =
        new StructureRequirement(
            "village-1", StructureType.VILLAGE, new BlockPosition(100, -200), 1_000);

    VillageSearchRequest request =
        new VillageSearchRequest(42, MinecraftVersion.JAVA_1_21, requirement);

    assertEquals(42, request.seed());
    assertEquals(MinecraftVersion.JAVA_1_21, request.minecraftVersion());
    assertEquals(requirement, request.requirement());
  }

  @Test
  void resolvesMinecraftVersionsByStableIdentifier() {
    assertEquals(MinecraftVersion.JAVA_1_21, MinecraftVersion.fromIdentifier("1.21"));
  }

  @Test
  void rejectsUnsupportedMinecraftVersions() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> MinecraftVersion.fromIdentifier("1.20.1"));

    assertEquals("unsupported Minecraft version: 1.20.1", error.getMessage());
  }

  @Test
  void rejectsMissingMinecraftVersions() {
    StructureRequirement requirement =
        new StructureRequirement("village-1", StructureType.VILLAGE, new BlockPosition(0, 0), 500);

    NullPointerException error =
        assertThrows(
            NullPointerException.class, () -> new VillageSearchRequest(42, null, requirement));

    assertEquals("minecraftVersion", error.getMessage());
  }

  @Test
  void exposesNearestVillageThroughLocatorContract() {
    StructureRequirement requirement =
        new StructureRequirement("village-1", StructureType.VILLAGE, new BlockPosition(0, 0), 500);

    VillageSearchRequest request =
        new VillageSearchRequest(42, MinecraftVersion.JAVA_1_21, requirement);

    BlockPosition villagePosition = new BlockPosition(128, -64);

    VillageLocator locator = ignoredRequest -> Optional.of(villagePosition);

    assertEquals(Optional.of(villagePosition), locator.findNearest(request));
  }
}
