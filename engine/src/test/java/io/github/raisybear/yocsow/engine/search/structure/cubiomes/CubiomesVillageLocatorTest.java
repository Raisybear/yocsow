package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.jna.Pointer;
import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CubiomesVillageLocatorTest {

  @Test
  void exposesVillageStructureType() {
    CubiomesVillageLocator locator = new CubiomesVillageLocator(new RecordingNativeLibrary());

    assertEquals(StructureType.VILLAGE, locator.structureType());
  }

  @Test
  void locatesKnownVillageThroughPackagedNativeLibrary() {
    CubiomesVillageLocator locator = new CubiomesVillageLocator();

    StructureRequirement requirement =
        new StructureRequirement(
            "village-native-test", StructureType.VILLAGE, new BlockPosition(0, 0), 1_000);

    StructureSearchRequest request =
        new StructureSearchRequest(42, MinecraftVersion.JAVA_1_21, requirement);

    assertEquals(Optional.of(new BlockPosition(656, -304)), locator.findNearest(request));
  }

  @Test
  void forwardsSearchRequestsAndReturnsVillagePositions() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    nativeLibrary.positions = List.of(new BlockPosition(656, -304), new BlockPosition(-752, 416));

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    List<BlockPosition> result = locator.findNearestCandidates(villageRequest(), 2);

    assertEquals(nativeLibrary.positions, result);
    assertEquals(1, nativeLibrary.minecraftVersion);
    assertEquals(42, nativeLibrary.seed);
    assertEquals(100, nativeLibrary.centerX);
    assertEquals(-200, nativeLibrary.centerZ);
    assertEquals(1_000, nativeLibrary.radiusBlocks);
    assertEquals(2, nativeLibrary.resultCapacity);
  }

  @Test
  void returnsEmptyWhenNoVillageIsInsideTheRadius() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    assertEquals(Optional.empty(), locator.findNearest(villageRequest()));
  }

  @Test
  void reportsSearchAreasOutsideMinecraftCoordinates() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    nativeLibrary.status = CubiomesNativeLibrary.STATUS_OUT_OF_RANGE;

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    IllegalArgumentException error =
        assertThrows(IllegalArgumentException.class, () -> locator.findNearest(villageRequest()));

    assertEquals("village search area exceeds supported Minecraft coordinates", error.getMessage());
  }

  @Test
  void rejectsInvalidNativeResultFlags() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    nativeLibrary.resultCountOverride = 2;

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    IllegalStateException error =
        assertThrows(
            IllegalStateException.class, () -> locator.findNearestCandidates(villageRequest(), 1));

    assertEquals("native village locator returned invalid result count: 2", error.getMessage());
  }

  private StructureSearchRequest villageRequest() {
    StructureRequirement requirement =
        new StructureRequirement(
            "village-1", StructureType.VILLAGE, new BlockPosition(100, -200), 1_000);

    return new StructureSearchRequest(42, MinecraftVersion.JAVA_1_21, requirement);
  }

  private static final class RecordingNativeLibrary implements CubiomesNativeLibrary {

    private int status = STATUS_OK;
    private List<BlockPosition> positions = List.of();
    private Integer resultCountOverride;
    private int minecraftVersion;
    private long seed;
    private long centerX;
    private long centerZ;
    private long radiusBlocks;
    private int resultCapacity;

    @Override
    public int findVillages(
        int minecraftVersion,
        long seed,
        long centerX,
        long centerZ,
        long radiusBlocks,
        int resultCapacity,
        Pointer resultCount,
        Pointer results) {
      this.minecraftVersion = minecraftVersion;
      this.seed = seed;
      this.centerX = centerX;
      this.centerZ = centerZ;
      this.radiusBlocks = radiusBlocks;
      this.resultCapacity = resultCapacity;

      int count = Math.min(positions.size(), resultCapacity);
      resultCount.setInt(0, resultCountOverride == null ? count : resultCountOverride);

      for (int index = 0; index < count; index++) {
        long offset = Integer.BYTES * 2L * index;
        BlockPosition position = positions.get(index);

        results.setInt(offset, Math.toIntExact(position.x()));
        results.setInt(offset + Integer.BYTES, Math.toIntExact(position.z()));
      }

      return status;
    }
  }
}
