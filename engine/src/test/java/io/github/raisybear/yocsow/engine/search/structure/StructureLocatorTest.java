package io.github.raisybear.yocsow.engine.search.structure;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class StructureLocatorTest {

  @Test
  void createsVersionedStructureSearchRequests() {
    StructureRequirement requirement = villageRequirement();

    StructureSearchRequest request =
        new StructureSearchRequest(42, MinecraftVersion.JAVA_1_21, requirement);

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
    NullPointerException error =
        assertThrows(
            NullPointerException.class,
            () -> new StructureSearchRequest(42, null, villageRequirement()));

    assertEquals("minecraftVersion", error.getMessage());
  }

  @Test
  void rejectsMissingRequirements() {
    NullPointerException error =
        assertThrows(
            NullPointerException.class,
            () -> new StructureSearchRequest(42, MinecraftVersion.JAVA_1_21, null));

    assertEquals("requirement", error.getMessage());
  }

  @Test
  void exposesStructureTypeAndNearestLocation() {
    BlockPosition villagePosition = new BlockPosition(128, -64);

    StructureLocator locator =
        new StructureLocator() {
          @Override
          public StructureType structureType() {
            return StructureType.VILLAGE;
          }

          @Override
          public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
            return Optional.of(villagePosition);
          }
        };

    assertEquals(StructureType.VILLAGE, locator.structureType());

    assertEquals(
        Optional.of(villagePosition),
        locator.findNearest(
            new StructureSearchRequest(42, MinecraftVersion.JAVA_1_21, villageRequirement())));
  }

  private StructureRequirement villageRequirement() {
    return new StructureRequirement(
        "village-1", StructureType.VILLAGE, new BlockPosition(100, -200), 1_000);
  }
}
