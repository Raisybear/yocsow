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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ForkJoinPool;
import java.util.stream.LongStream;
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
  void matchesScalarSearchesThroughPackagedNativeBatchLibrary() {
    CubiomesVillageLocator locator = new CubiomesVillageLocator();

    List<StructureRequirement> requirements =
        List.of(
            new StructureRequirement(
                "spawn-village", StructureType.VILLAGE, new BlockPosition(0, 0), 1_000),
            new StructureRequirement(
                "remote-village", StructureType.VILLAGE, new BlockPosition(2_000, -1_000), 2_500));

    StructureSearchBatchRequest request =
        new StructureSearchBatchRequest(42, 3, MinecraftVersion.JAVA_1_21, requirements);

    List<List<BlockPosition>> expected = new ArrayList<>();

    for (long seed = 42; seed < 45; seed++) {
      for (StructureRequirement requirement : requirements) {
        expected.add(
            locator.findNearestCandidates(
                new StructureSearchRequest(seed, MinecraftVersion.JAVA_1_21, requirement), 4));
      }
    }

    assertEquals(expected, locator.findNearestCandidatesBatch(request, 4));
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
  void forwardsBatchedSearchRequestsAndReturnsVillagePositions() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    nativeLibrary.batchPositions =
        List.of(
            List.of(new BlockPosition(10, 20), new BlockPosition(30, 40)),
            List.of(new BlockPosition(50, 60)),
            List.of(),
            List.of(new BlockPosition(70, 80)));

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    List<StructureRequirement> requirements =
        List.of(
            new StructureRequirement(
                "village-1", StructureType.VILLAGE, new BlockPosition(100, -200), 1_000),
            new StructureRequirement(
                "village-2", StructureType.VILLAGE, new BlockPosition(300, -400), 2_000));

    List<List<BlockPosition>> result =
        locator.findNearestCandidatesBatch(
            new StructureSearchBatchRequest(42, 2, MinecraftVersion.JAVA_1_21, requirements), 2);

    assertEquals(nativeLibrary.batchPositions, result);
    assertEquals(1, nativeLibrary.batchMinecraftVersion);
    assertEquals(42, nativeLibrary.batchFirstSeed);
    assertEquals(2, nativeLibrary.batchSeedCount);
    assertEquals(
        List.of(new SearchArea(100, -200, 1_000), new SearchArea(300, -400, 2_000)),
        nativeLibrary.searchAreas);
    assertEquals(2, nativeLibrary.batchResultCapacity);
    assertEquals(4, nativeLibrary.resultCountCapacity);
    assertEquals(8, nativeLibrary.resultPositionCapacity);
  }

  @Test
  void returnsEmptyWhenNoVillageIsInsideTheRadius() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    assertEquals(Optional.empty(), locator.findNearest(villageRequest()));
  }

  @Test
  void supportsConcurrentNativeSearches() {
    CubiomesVillageLocator locator = new CubiomesVillageLocator();
    List<StructureSearchRequest> requests =
        LongStream.range(40, 72).mapToObj(this::villageRequest).toList();
    List<Optional<BlockPosition>> expectedResults =
        requests.stream().map(locator::findNearest).toList();
    ForkJoinPool workerPool = new ForkJoinPool(4);

    try {
      List<CompletableFuture<Optional<BlockPosition>>> searches =
          requests.stream()
              .map(
                  request ->
                      CompletableFuture.supplyAsync(() -> locator.findNearest(request), workerPool))
              .toList();
      List<Optional<BlockPosition>> actualResults =
          searches.stream().map(CompletableFuture::join).toList();

      assertEquals(expectedResults, actualResults);
    } finally {
      workerPool.shutdownNow();
    }
  }

  @Test
  void supportsConcurrentNativeBatchSearches() {
    CubiomesVillageLocator locator = new CubiomesVillageLocator();
    List<StructureSearchBatchRequest> requests =
        LongStream.range(40, 48).mapToObj(this::villageBatchRequest).toList();
    List<List<List<BlockPosition>>> expectedResults =
        requests.stream().map(request -> locator.findNearestCandidatesBatch(request, 2)).toList();
    ForkJoinPool workerPool = new ForkJoinPool(4);

    try {
      List<CompletableFuture<List<List<BlockPosition>>>> searches =
          requests.stream()
              .map(
                  request ->
                      CompletableFuture.supplyAsync(
                          () -> locator.findNearestCandidatesBatch(request, 2), workerPool))
              .toList();

      List<List<List<BlockPosition>>> actualResults =
          searches.stream().map(CompletableFuture::join).toList();

      assertEquals(expectedResults, actualResults);
    } finally {
      workerPool.shutdownNow();
    }
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

  @Test
  void rejectsInvalidNativeBatchResultCounts() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();
    nativeLibrary.batchResultCountOverride = 2;

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    IllegalStateException error =
        assertThrows(
            IllegalStateException.class,
            () ->
                locator.findNearestCandidatesBatch(
                    new StructureSearchBatchRequest(
                        42, 1, MinecraftVersion.JAVA_1_21, List.of(villageRequest().requirement())),
                    1));

    assertEquals("native village locator returned invalid result count: 2", error.getMessage());
  }

  @Test
  void reportsNativeBatchBufferMismatches() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();
    nativeLibrary.status = CubiomesNativeLibrary.STATUS_BUFFER_TOO_SMALL;

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    IllegalStateException error =
        assertThrows(
            IllegalStateException.class,
            () ->
                locator.findNearestCandidatesBatch(
                    new StructureSearchBatchRequest(
                        42, 1, MinecraftVersion.JAVA_1_21, List.of(villageRequest().requirement())),
                    1));

    assertEquals("native village locator rejected result buffer sizes", error.getMessage());
  }

  private StructureSearchRequest villageRequest() {
    return villageRequest(42);
  }

  private StructureSearchRequest villageRequest(long seed) {
    StructureRequirement requirement =
        new StructureRequirement(
            "village-1", StructureType.VILLAGE, new BlockPosition(100, -200), 1_000);

    return new StructureSearchRequest(seed, MinecraftVersion.JAVA_1_21, requirement);
  }

  private StructureSearchBatchRequest villageBatchRequest(long firstSeed) {
    return new StructureSearchBatchRequest(
        firstSeed, 4, MinecraftVersion.JAVA_1_21, List.of(villageRequest(firstSeed).requirement()));
  }

  private static final class RecordingNativeLibrary implements CubiomesNativeLibrary {

    private int status = STATUS_OK;
    private List<BlockPosition> positions = List.of();
    private List<List<BlockPosition>> batchPositions = List.of();
    private Integer resultCountOverride;
    private Integer batchResultCountOverride;
    private int minecraftVersion;
    private long seed;
    private long centerX;
    private long centerZ;
    private long radiusBlocks;
    private int resultCapacity;
    private int batchMinecraftVersion;
    private long batchFirstSeed;
    private int batchSeedCount;
    private List<SearchArea> searchAreas = List.of();
    private int batchResultCapacity;
    private long resultCountCapacity;
    private long resultPositionCapacity;

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
      batchMinecraftVersion = minecraftVersion;
      batchFirstSeed = firstSeed;
      batchSeedCount = seedCount;
      batchResultCapacity = resultCapacity;
      this.resultCountCapacity = resultCountCapacity;
      this.resultPositionCapacity = resultPositionCapacity;

      List<SearchArea> recordedSearchAreas = new ArrayList<>(searchAreaCount);

      for (int index = 0; index < searchAreaCount; index++) {
        long offset = index * Long.BYTES * 3L;

        recordedSearchAreas.add(
            new SearchArea(
                searchAreas.getLong(offset),
                searchAreas.getLong(offset + Long.BYTES),
                searchAreas.getLong(offset + Long.BYTES * 2L)));
      }

      this.searchAreas = List.copyOf(recordedSearchAreas);

      int batchResultCount = seedCount * searchAreaCount;

      for (int batchResultIndex = 0; batchResultIndex < batchResultCount; batchResultIndex++) {
        List<BlockPosition> positions =
            batchResultIndex < batchPositions.size()
                ? batchPositions.get(batchResultIndex)
                : List.of();

        int count = Math.min(positions.size(), resultCapacity);

        resultCounts.setInt(
            (long) batchResultIndex * Integer.BYTES,
            batchResultCountOverride == null ? count : batchResultCountOverride);

        for (int resultIndex = 0; resultIndex < count; resultIndex++) {
          long offset =
              ((long) batchResultIndex * resultCapacity + resultIndex) * Integer.BYTES * 2L;

          BlockPosition position = positions.get(resultIndex);
          results.setInt(offset, Math.toIntExact(position.x()));
          results.setInt(offset + Integer.BYTES, Math.toIntExact(position.z()));
        }
      }

      return status;
    }
  }

  private record SearchArea(long centerX, long centerZ, long radiusBlocks) {}
}
