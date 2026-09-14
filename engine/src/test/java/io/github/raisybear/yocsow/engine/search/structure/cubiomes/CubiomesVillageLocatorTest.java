package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.jna.Pointer;
import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchCandidate;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchRequest;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchResult;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchService;
import io.github.raisybear.yocsow.engine.search.seed.StructureMatch;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocatorRegistry;
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
  void matchesJavaSeedSearchThroughPackagedNativeKernel() {
    CubiomesVillageLocator locator = new CubiomesVillageLocator();
    BlockPosition spawn = new BlockPosition(0, 0);

    SeedSearchRequest request =
        new SeedSearchRequest(
            0,
            128,
            MinecraftVersion.JAVA_1_21,
            List.of(
                new StructureRequirement("spawn-village-1", StructureType.VILLAGE, spawn, 1_000),
                new StructureRequirement("spawn-village-2", StructureType.VILLAGE, spawn, 1_000),
                new StructureRequirement(
                    "overlapping-village", StructureType.VILLAGE, new BlockPosition(500, 0), 1_000),
                new StructureRequirement(
                    "remote-village",
                    StructureType.VILLAGE,
                    new BlockPosition(4_000, -2_000),
                    1_500)),
            20);

    StructureLocator referenceLocator =
        new StructureLocator() {
          @Override
          public StructureType structureType() {
            return StructureType.VILLAGE;
          }

          @Override
          public Optional<BlockPosition> findNearest(StructureSearchRequest scalarRequest) {
            return locator.findNearest(scalarRequest);
          }

          @Override
          public List<List<BlockPosition>> findNearestCandidatesBatch(
              StructureSearchBatchRequest batchRequest, int limit) {
            return locator.findNearestCandidatesBatch(batchRequest, limit);
          }
        };

    SeedSearchResult expected =
        new SeedSearchService(new StructureLocatorRegistry(List.of(referenceLocator)))
            .search(request);

    assertEquals(expected.candidates(), locator.searchSeeds(request));
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
  void forwardsSeedSearchRequestsAndReturnsCandidates() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();
    nativeLibrary.seedSearchCandidates =
        List.of(
            new RecordedSeedCandidate(
                43,
                List.of(
                    Optional.of(new BlockPosition(10, 20)),
                    Optional.of(new BlockPosition(30, 40)),
                    Optional.empty())));

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);
    List<StructureRequirement> requirements =
        List.of(
            new StructureRequirement(
                "village-1", StructureType.VILLAGE, new BlockPosition(100, -200), 1_000),
            new StructureRequirement(
                "village-2", StructureType.VILLAGE, new BlockPosition(100, -200), 1_000),
            new StructureRequirement(
                "village-3", StructureType.VILLAGE, new BlockPosition(300, -400), 2_000));

    SeedSearchRequest request =
        new SeedSearchRequest(42, 2, MinecraftVersion.JAVA_1_21, requirements, 5);

    assertEquals(
        List.of(
            new SeedSearchCandidate(
                43,
                3,
                List.of(
                    StructureMatch.from(requirements.get(0), new BlockPosition(10, 20)),
                    StructureMatch.from(requirements.get(1), new BlockPosition(30, 40))))),
        locator.searchSeeds(request));

    assertEquals(1, nativeLibrary.seedSearchMinecraftVersion);
    assertEquals(42, nativeLibrary.seedSearchFirstSeed);
    assertEquals(2, nativeLibrary.seedSearchSeedCount);
    assertEquals(
        List.of(new SearchArea(100, -200, 1_000), new SearchArea(300, -400, 2_000)),
        nativeLibrary.seedSearchAreas);
    assertEquals(List.of(0, 0, 1), nativeLibrary.requirementSearchAreaIndexes);
    assertEquals(3, nativeLibrary.seedSearchRequirementCount);
    assertEquals(5, nativeLibrary.seedSearchResultCapacity);
    assertEquals(5, nativeLibrary.seedSearchCandidateCapacity);
    assertEquals(15, nativeLibrary.seedSearchMatchCapacity);
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

  @Test
  void rejectsInvalidNativeSeedCandidateCounts() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();
    nativeLibrary.seedSearchCandidateCountOverride = 2;

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    IllegalStateException error =
        assertThrows(
            IllegalStateException.class,
            () ->
                locator.searchSeeds(
                    new SeedSearchRequest(
                        42,
                        1,
                        MinecraftVersion.JAVA_1_21,
                        List.of(villageRequest().requirement()),
                        1)));

    assertEquals(
        "native village seed search returned invalid candidate count: 2", error.getMessage());
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
    private List<RecordedSeedCandidate> seedSearchCandidates = List.of();
    private int seedSearchMinecraftVersion;
    private long seedSearchFirstSeed;
    private int seedSearchSeedCount;
    private List<SearchArea> seedSearchAreas = List.of();
    private List<Integer> requirementSearchAreaIndexes = List.of();
    private int seedSearchRequirementCount;
    private int seedSearchResultCapacity;
    private int seedSearchCandidateCapacity;
    private long seedSearchMatchCapacity;
    private Integer seedSearchCandidateCountOverride;

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
      seedSearchMinecraftVersion = minecraftVersion;
      seedSearchFirstSeed = firstSeed;
      seedSearchSeedCount = seedCount;
      seedSearchRequirementCount = requirementCount;
      seedSearchResultCapacity = resultCapacity;
      seedSearchCandidateCapacity = candidateCapacity;
      seedSearchMatchCapacity = matchCapacity;

      List<SearchArea> recordedSearchAreas = new ArrayList<>(searchAreaCount);

      for (int index = 0; index < searchAreaCount; index++) {
        long offset = index * Long.BYTES * 3L;

        recordedSearchAreas.add(
            new SearchArea(
                searchAreas.getLong(offset),
                searchAreas.getLong(offset + Long.BYTES),
                searchAreas.getLong(offset + Long.BYTES * 2L)));
      }

      seedSearchAreas = List.copyOf(recordedSearchAreas);

      List<Integer> recordedRequirementIndexes = new ArrayList<>(requirementCount);

      for (int index = 0; index < requirementCount; index++) {
        recordedRequirementIndexes.add(
            requirementSearchAreaIndexes.getInt((long) index * Integer.BYTES));
      }

      this.requirementSearchAreaIndexes = List.copyOf(recordedRequirementIndexes);

      int count = Math.min(seedSearchCandidates.size(), resultCapacity);
      candidateCount.setInt(
          0, seedSearchCandidateCountOverride == null ? count : seedSearchCandidateCountOverride);

      for (int candidateIndex = 0; candidateIndex < count; candidateIndex++) {
        RecordedSeedCandidate candidate = seedSearchCandidates.get(candidateIndex);
        long candidateOffset = candidateIndex * (Long.BYTES + Integer.BYTES * 2L);
        int matchedRequirementCount =
            (int) candidate.matches().stream().filter(Optional::isPresent).count();

        candidates.setLong(candidateOffset, candidate.seed());
        candidates.setInt(candidateOffset + Long.BYTES, matchedRequirementCount);
        candidates.setInt(candidateOffset + Long.BYTES + Integer.BYTES, 0);

        for (int requirementIndex = 0;
            requirementIndex < candidate.matches().size();
            requirementIndex++) {
          Optional<BlockPosition> position = candidate.matches().get(requirementIndex);
          long matchIndex = (long) candidateIndex * requirementCount + requirementIndex;
          long matchOffset = matchIndex * Integer.BYTES * 3L;

          matches.setInt(matchOffset, position.isPresent() ? 1 : 0);

          if (position.isPresent()) {
            matches.setInt(
                matchOffset + Integer.BYTES, Math.toIntExact(position.orElseThrow().x()));
            matches.setInt(
                matchOffset + Integer.BYTES * 2L, Math.toIntExact(position.orElseThrow().z()));
          }
        }
      }

      return status;
    }
  }

  private record SearchArea(long centerX, long centerZ, long radiusBlocks) {}

  private record RecordedSeedCandidate(long seed, List<Optional<BlockPosition>> matches) {}
}
