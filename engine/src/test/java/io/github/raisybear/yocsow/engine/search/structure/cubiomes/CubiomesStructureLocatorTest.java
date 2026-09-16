package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.jna.Pointer;
import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchBatchRequest;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.List;
import org.junit.jupiter.api.Test;

final class CubiomesStructureLocatorTest {

  @Test
  void locatesRuinedPortalsThroughTheGenericNativeBoundary() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();
    nativeLibrary.positions = List.of(new BlockPosition(-608, 944), new BlockPosition(-112, 384));
    CubiomesStructureLocator locator =
        new CubiomesStructureLocator(StructureType.RUINED_PORTAL, 2, nativeLibrary);
    StructureSearchRequest request =
        new StructureSearchRequest(
            42, MinecraftVersion.JAVA_1_21, requirement("portal-1", -800, 1200, 640));

    assertEquals(nativeLibrary.positions, locator.findNearestCandidates(request, 2));
    assertEquals(StructureType.RUINED_PORTAL, locator.structureType());
    assertEquals(1, nativeLibrary.minecraftVersion);
    assertEquals(2, nativeLibrary.structure);
    assertEquals(42, nativeLibrary.seed);
    assertEquals(-800, nativeLibrary.centerX);
    assertEquals(1200, nativeLibrary.centerZ);
    assertEquals(640, nativeLibrary.radiusBlocks);
  }

  @Test
  void batchesSeedsAndPortalSearchAreas() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();
    nativeLibrary.batchPositions =
        List.of(
            List.of(new BlockPosition(16, 32)),
            List.of(),
            List.of(new BlockPosition(48, 64)),
            List.of(new BlockPosition(80, 96)));
    CubiomesStructureLocator locator =
        new CubiomesStructureLocator(StructureType.RUINED_PORTAL, 2, nativeLibrary);
    StructureSearchBatchRequest request =
        new StructureSearchBatchRequest(
            100,
            2,
            MinecraftVersion.JAVA_1_21,
            List.of(
                requirement("portal-1", 0, 0, 1000), requirement("portal-2", 2000, -1000, 500)));

    assertEquals(nativeLibrary.batchPositions, locator.findNearestCandidatesBatch(request, 1));
    assertEquals(2, nativeLibrary.structure);
    assertEquals(100, nativeLibrary.firstSeed);
    assertEquals(2, nativeLibrary.seedCount);
    assertEquals(
        List.of(new SearchArea(0, 0, 1000), new SearchArea(2000, -1000, 500)),
        nativeLibrary.searchAreas);
  }

  @Test
  void rejectsRequirementsForAnotherStructureType() {
    CubiomesStructureLocator locator =
        new CubiomesStructureLocator(StructureType.RUINED_PORTAL, 2, new RecordingNativeLibrary());
    StructureSearchRequest request =
        new StructureSearchRequest(
            42,
            MinecraftVersion.JAVA_1_21,
            new StructureRequirement(
                "village-1", StructureType.VILLAGE, new BlockPosition(0, 0), 1000));

    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> locator.findNearestCandidates(request, 1));

    assertEquals(
        "ruinedPortal locator cannot search for structure type: village", error.getMessage());
  }

  private static StructureRequirement requirement(String id, long x, long z, long radiusBlocks) {
    return new StructureRequirement(
        id, StructureType.RUINED_PORTAL, new BlockPosition(x, z), radiusBlocks);
  }

  private static final class RecordingNativeLibrary implements CubiomesStructureNativeLibrary {

    private List<BlockPosition> positions = List.of();
    private List<List<BlockPosition>> batchPositions = List.of();
    private int minecraftVersion;
    private int structure;
    private long seed;
    private long centerX;
    private long centerZ;
    private long radiusBlocks;
    private long firstSeed;
    private int seedCount;
    private List<SearchArea> searchAreas = List.of();

    @Override
    public int findStructures(
        int minecraftVersion,
        int structure,
        long seed,
        long centerX,
        long centerZ,
        long radiusBlocks,
        int resultCapacity,
        Pointer resultCount,
        Pointer results) {
      this.minecraftVersion = minecraftVersion;
      this.structure = structure;
      this.seed = seed;
      this.centerX = centerX;
      this.centerZ = centerZ;
      this.radiusBlocks = radiusBlocks;

      int count = Math.min(positions.size(), resultCapacity);
      resultCount.setInt(0, count);
      writePositions(results, positions, count, 0, resultCapacity);
      return STATUS_OK;
    }

    @Override
    public int findStructuresBatch(
        int minecraftVersion,
        int structure,
        long firstSeed,
        int seedCount,
        Pointer searchAreas,
        int searchAreaCount,
        int resultCapacity,
        long resultCountCapacity,
        Pointer resultCounts,
        long resultPositionCapacity,
        Pointer results) {
      this.minecraftVersion = minecraftVersion;
      this.structure = structure;
      this.firstSeed = firstSeed;
      this.seedCount = seedCount;

      java.util.ArrayList<SearchArea> recordedAreas = new java.util.ArrayList<>();

      for (int index = 0; index < searchAreaCount; index++) {
        long offset = index * Long.BYTES * 3L;
        recordedAreas.add(
            new SearchArea(
                searchAreas.getLong(offset),
                searchAreas.getLong(offset + Long.BYTES),
                searchAreas.getLong(offset + Long.BYTES * 2L)));
      }

      this.searchAreas = List.copyOf(recordedAreas);
      int batchCount = seedCount * searchAreaCount;

      for (int index = 0; index < batchCount; index++) {
        List<BlockPosition> returned =
            index < batchPositions.size() ? batchPositions.get(index) : List.of();
        int count = Math.min(returned.size(), resultCapacity);
        resultCounts.setInt((long) index * Integer.BYTES, count);
        writePositions(results, returned, count, index, resultCapacity);
      }

      return STATUS_OK;
    }

    private static void writePositions(
        Pointer results,
        List<BlockPosition> positions,
        int count,
        int batchIndex,
        int resultCapacity) {
      for (int index = 0; index < count; index++) {
        long offset = ((long) batchIndex * resultCapacity + index) * Integer.BYTES * 2L;
        BlockPosition position = positions.get(index);
        results.setInt(offset, Math.toIntExact(position.x()));
        results.setInt(offset + Integer.BYTES, Math.toIntExact(position.z()));
      }
    }
  }

  private record SearchArea(long centerX, long centerZ, long radiusBlocks) {}
}
