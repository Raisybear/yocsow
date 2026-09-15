package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.jna.Pointer;
import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchBatchRequest;
import java.util.List;
import org.junit.jupiter.api.Test;

final class CubiomesBiomeLocatorTest {

  @Test
  void writesBiomeAreasAndReadsSeedMajorMatches() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();
    nativeLibrary.returnedMatches = List.of(1, 0, 0, 1);
    CubiomesBiomeLocator locator = new CubiomesBiomeLocator(StructureType.TAIGA, 1, nativeLibrary);
    List<StructureRequirement> requirements =
        List.of(requirement("taiga-1", 100, -200, 64), requirement("taiga-2", 300, -400, 128));

    List<List<BlockPosition>> results =
        locator.findNearestCandidatesBatch(
            new StructureSearchBatchRequest(-5, 2, MinecraftVersion.JAVA_1_21, requirements), 2);

    assertEquals(StructureType.TAIGA, locator.structureType());
    assertEquals(1, nativeLibrary.minecraftVersion);
    assertEquals(-5, nativeLibrary.firstSeed);
    assertEquals(2, nativeLibrary.seedCount);
    assertEquals(
        List.of(new RecordedArea(1, 64, 100, -200), new RecordedArea(1, 128, 300, -400)),
        nativeLibrary.areas);
    assertEquals(
        List.of(
            List.of(new BlockPosition(100, -200)),
            List.of(),
            List.of(),
            List.of(new BlockPosition(300, -400))),
        results);
  }

  @Test
  void rejectsInvalidNativeMatchFlags() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();
    nativeLibrary.returnedMatches = List.of(2);
    CubiomesBiomeLocator locator = new CubiomesBiomeLocator(StructureType.TAIGA, 1, nativeLibrary);

    IllegalStateException error =
        assertThrows(
            IllegalStateException.class,
            () ->
                locator.findNearestCandidatesBatch(
                    new StructureSearchBatchRequest(
                        42,
                        1,
                        MinecraftVersion.JAVA_1_21,
                        List.of(requirement("taiga-1", 0, 0, 64))),
                    1));

    assertEquals("native biome locator returned invalid match flag: 2", error.getMessage());
  }

  private static StructureRequirement requirement(String id, long x, long z, long radiusBlocks) {
    return new StructureRequirement(id, StructureType.TAIGA, new BlockPosition(x, z), radiusBlocks);
  }

  private static final class RecordingNativeLibrary implements CubiomesNativeLibrary {
    private List<Integer> returnedMatches = List.of();
    private int minecraftVersion;
    private long firstSeed;
    private int seedCount;
    private List<RecordedArea> areas = List.of();

    @Override
    public int matchBiomesBatch(
        int minecraftVersion,
        long firstSeed,
        int seedCount,
        Pointer searchAreas,
        int searchAreaCount,
        long matchCapacity,
        Pointer matches) {
      this.minecraftVersion = minecraftVersion;
      this.firstSeed = firstSeed;
      this.seedCount = seedCount;

      java.util.ArrayList<RecordedArea> recordedAreas = new java.util.ArrayList<>();

      for (int index = 0; index < searchAreaCount; index++) {
        long offset = index * 24L;
        recordedAreas.add(
            new RecordedArea(
                searchAreas.getInt(offset),
                searchAreas.getInt(offset + 4),
                searchAreas.getLong(offset + 8),
                searchAreas.getLong(offset + 16)));
      }

      areas = List.copyOf(recordedAreas);

      for (int index = 0; index < returnedMatches.size(); index++) {
        matches.setInt((long) index * Integer.BYTES, returnedMatches.get(index));
      }

      return STATUS_OK;
    }

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
      throw new UnsupportedOperationException();
    }

    @Override
    public int findVillagesBatch(
        int minecraftVersion,
        long firstSeed,
        int seedCount,
        Pointer searchAreas,
        int searchAreaCount,
        int resultCapacity,
        long resultCountCapacity,
        Pointer resultCounts,
        long resultPositionCapacity,
        Pointer results) {
      throw new UnsupportedOperationException();
    }

    @Override
    public int searchVillageSeeds(
        int minecraftVersion,
        long firstSeed,
        int seedCount,
        Pointer searchAreas,
        int searchAreaCount,
        Pointer requirementSearchAreaIndexes,
        int requirementCount,
        int resultCapacity,
        int candidateCapacity,
        Pointer candidateCount,
        Pointer candidates,
        long matchCapacity,
        Pointer matches) {
      throw new UnsupportedOperationException();
    }
  }

  private record RecordedArea(int biome, int radiusBlocks, long centerX, long centerZ) {}
}
