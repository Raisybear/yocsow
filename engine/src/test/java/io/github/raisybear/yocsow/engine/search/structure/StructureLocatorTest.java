package io.github.raisybear.yocsow.engine.search.structure;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import java.util.ArrayList;
import java.util.List;
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
  void createsImmutableStructureSearchBatchRequests() {
    List<StructureRequirement> requirements = new ArrayList<>();
    requirements.add(villageRequirement());

    StructureSearchBatchRequest request =
        new StructureSearchBatchRequest(42, 3, MinecraftVersion.JAVA_1_21, requirements);

    requirements.clear();

    assertEquals(42, request.firstSeed());
    assertEquals(3, request.seedCount());
    assertEquals(MinecraftVersion.JAVA_1_21, request.minecraftVersion());
    assertEquals(List.of(villageRequirement()), request.requirements());
    assertThrows(UnsupportedOperationException.class, () -> request.requirements().clear());
  }

  @Test
  void rejectsInvalidStructureSearchBatches() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new StructureSearchBatchRequest(
                42, 0, MinecraftVersion.JAVA_1_21, List.of(villageRequirement())));

    assertThrows(
        IllegalArgumentException.class,
        () ->
            new StructureSearchBatchRequest(
                Long.MAX_VALUE, 2, MinecraftVersion.JAVA_1_21, List.of(villageRequirement())));

    assertThrows(
        IllegalArgumentException.class,
        () -> new StructureSearchBatchRequest(42, 1, MinecraftVersion.JAVA_1_21, List.of()));
  }

  @Test
  void resolvesMinecraftVersionsByStableIdentifier() {
    assertEquals(MinecraftVersion.JAVA_1_21, MinecraftVersion.fromIdentifier("1.21"));
    assertEquals("1.20.6", MinecraftVersion.fromIdentifier("1.20.6").identifier());
  }

  @Test
  void rejectsInvalidMinecraftReleaseIdentifiers() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> MinecraftVersion.fromIdentifier("1.20.6-fabric"));

    assertEquals("invalid Minecraft Java release: 1.20.6-fabric", error.getMessage());
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

  @Test
  void fallsBackToSeedMajorScalarBatchSearches() {
    StructureRequirement firstRequirement = villageRequirement();
    StructureRequirement secondRequirement =
        new StructureRequirement(
            "village-2", StructureType.VILLAGE, new BlockPosition(300, -400), 1_000);

    StructureLocator locator =
        new StructureLocator() {
          @Override
          public StructureType structureType() {
            return StructureType.VILLAGE;
          }

          @Override
          public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
            return Optional.of(
                new BlockPosition(request.seed(), request.requirement().center().x()));
          }
        };

    List<List<BlockPosition>> candidates =
        locator.findNearestCandidatesBatch(
            new StructureSearchBatchRequest(
                42, 2, MinecraftVersion.JAVA_1_21, List.of(firstRequirement, secondRequirement)),
            1);

    assertEquals(
        List.of(
            List.of(new BlockPosition(42, 100)),
            List.of(new BlockPosition(42, 300)),
            List.of(new BlockPosition(43, 100)),
            List.of(new BlockPosition(43, 300))),
        candidates);
  }

  private StructureRequirement villageRequirement() {
    return new StructureRequirement(
        "village-1", StructureType.VILLAGE, new BlockPosition(100, -200), 1_000);
  }
}
