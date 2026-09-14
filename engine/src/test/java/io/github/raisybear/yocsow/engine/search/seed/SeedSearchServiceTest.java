package io.github.raisybear.yocsow.engine.search.seed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocatorRegistry;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchBatchRequest;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

class SeedSearchServiceTest {

  @Test
  void ranksCandidatesByMatchesAndNormalizedDistance() {
    RecordingVillageLocator locator = new RecordingVillageLocator();

    locator.locate(10, new BlockPosition(900, 0));
    locator.locate(11, new BlockPosition(600, 0));
    locator.locate(11, new BlockPosition(0, 800));
    locator.locate(12, new BlockPosition(100, 0));

    SeedSearchService service = serviceUsing(locator);

    SeedSearchResult result =
        service.search(
            new SeedSearchRequest(
                10,
                3,
                MinecraftVersion.JAVA_1_21,
                List.of(requirement("village-1"), requirement("village-2")),
                3));

    assertEquals(3, result.searchedSeedCount());
    assertEquals(3, result.candidates().size());

    SeedSearchCandidate first = result.candidates().get(0);
    SeedSearchCandidate second = result.candidates().get(1);
    SeedSearchCandidate third = result.candidates().get(2);

    assertEquals(11, first.seed());
    assertEquals(2, first.matchedRequirementCount());
    assertTrue(first.matchesAllRequirements());

    assertEquals(12, second.seed());
    assertEquals(1, second.matchedRequirementCount());
    assertEquals(0.1, second.averageNormalizedDistance(), 0.000_001);

    assertEquals(10, third.seed());
    assertEquals(1, third.matchedRequirementCount());
    assertEquals(new BlockPosition(900, 0), third.matches().get(0).actualPosition());
    assertEquals(3, locator.candidateSearchCount());
  }

  @Test
  void limitsReturnedCandidates() {
    RecordingVillageLocator locator = new RecordingVillageLocator();

    locator.locate(20, new BlockPosition(100, 0));
    locator.locate(21, new BlockPosition(200, 0));
    locator.locate(22, new BlockPosition(300, 0));

    SeedSearchResult result =
        serviceUsing(locator)
            .search(
                new SeedSearchRequest(
                    20, 3, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 2));

    assertEquals(2, result.candidates().size());
    assertEquals(20, result.candidates().get(0).seed());
    assertEquals(21, result.candidates().get(1).seed());
  }

  @Test
  void returnsNoCandidatesWhenNothingMatches() {
    SeedSearchResult result =
        serviceUsing(new RecordingVillageLocator())
            .search(
                new SeedSearchRequest(
                    30, 5, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 5));

    assertEquals(5, result.searchedSeedCount());
    assertTrue(result.candidates().isEmpty());
  }

  @Test
  void evaluatesSeedsAcrossABoundedWorkerPool() {
    ForkJoinPool workerPool = new ForkJoinPool(2);
    ConcurrencyTrackingVillageLocator locator = new ConcurrencyTrackingVillageLocator();

    try {
      SeedSearchResult result =
          new SeedSearchService(new StructureLocatorRegistry(List.of(locator)), workerPool)
              .search(
                  new SeedSearchRequest(
                      0, 64, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 5));

      assertEquals(64, result.searchedSeedCount());
      assertEquals(2, locator.maximumConcurrentCalls());
    } finally {
      workerPool.shutdownNow();
    }
  }

  @Test
  void batchesSeedRangesWithinWorkerTasks() {
    ForkJoinPool workerPool = new ForkJoinPool(1);
    RecordingVillageLocator locator = new RecordingVillageLocator();

    try {
      new SeedSearchService(new StructureLocatorRegistry(List.of(locator)), workerPool)
          .search(
              new SeedSearchRequest(
                  0, 8, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 5));

      assertEquals(4, locator.batchSearchCount());
      assertEquals(2, locator.largestBatchSeedCount());
      assertEquals(8, locator.candidateSearchCount());
    } finally {
      workerPool.shutdownNow();
    }
  }

  @Test
  void evaluatesWorkerRangesThroughSeedSearchKernel() {
    ForkJoinPool workerPool = new ForkJoinPool(1);
    RecordingSeedSearchKernel locator = new RecordingSeedSearchKernel();

    try {
      SeedSearchResult result =
          new SeedSearchService(new StructureLocatorRegistry(List.of(locator)), workerPool)
              .search(
                  new SeedSearchRequest(
                      0, 8, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 5));

      assertEquals(4, locator.kernelSearchCount());
      assertEquals(2, locator.largestKernelSeedCount());
      assertEquals(0, locator.fallbackSearchCount());
      assertEquals(
          List.of(0L, 2L, 4L, 6L),
          result.candidates().stream().map(SeedSearchCandidate::seed).toList());
    } finally {
      workerPool.shutdownNow();
    }
  }

  @Test
  void rejectsIncompleteLocatorBatchResults() {
    StructureLocator locator =
        new StructureLocator() {
          @Override
          public StructureType structureType() {
            return StructureType.VILLAGE;
          }

          @Override
          public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
            return Optional.empty();
          }

          @Override
          public List<List<BlockPosition>> findNearestCandidatesBatch(
              StructureSearchBatchRequest request, int limit) {
            return List.of();
          }
        };

    IllegalStateException error =
        assertThrows(
            IllegalStateException.class,
            () ->
                serviceUsing(locator)
                    .search(
                        new SeedSearchRequest(
                            42,
                            1,
                            MinecraftVersion.JAVA_1_21,
                            List.of(requirement("village-1")),
                            1)));

    assertTrue(
        error.getMessage().contains("structure locator returned 0 batch results instead of 1"));
  }

  @Test
  void resolvesSharedSearchMetadataBeforeEvaluatingSeeds() {
    RecordingVillageLocator locator = new RecordingVillageLocator();

    serviceUsing(locator)
        .search(
            new SeedSearchRequest(
                0,
                8,
                MinecraftVersion.JAVA_1_21,
                List.of(requirement("village-1"), requirement("village-2")),
                5));

    assertEquals(1, locator.structureTypeQueryCount());
    assertEquals(8, locator.candidateSearchCount());
  }

  @Test
  void mapsRequirementsToTheirPrecomputedSearchAreas() {
    RecordingVillageLocator locator = new RecordingVillageLocator();
    BlockPosition spawn = new BlockPosition(0, 0);
    BlockPosition remoteCenter = new BlockPosition(9_000, 0);

    locator.locate(42, spawn, new BlockPosition(100, 0));
    locator.locate(42, remoteCenter, new BlockPosition(9_100, 0));

    SeedSearchResult result =
        serviceUsing(locator)
            .search(
                new SeedSearchRequest(
                    42,
                    1,
                    MinecraftVersion.JAVA_1_21,
                    List.of(
                        requirement("spawn-village", spawn),
                        requirement("remote-village", remoteCenter)),
                    1));

    SeedSearchCandidate candidate = result.candidates().getFirst();

    assertEquals(2, locator.candidateSearchCount());
    assertEquals(
        List.of("spawn-village", "remote-village"),
        candidate.matches().stream().map(StructureMatch::requirementId).toList());
    assertTrue(candidate.matchesAllRequirements());
  }

  @Test
  void assignsDistinctVillagesToRequirementsWithTheSameSearchArea() {
    RecordingVillageLocator locator = new RecordingVillageLocator();
    List<BlockPosition> villages =
        List.of(
            new BlockPosition(100, 0),
            new BlockPosition(-200, 0),
            new BlockPosition(0, 300),
            new BlockPosition(0, -400));

    for (BlockPosition village : villages) {
      locator.locate(42, village);
    }

    SeedSearchResult result =
        serviceUsing(locator)
            .search(
                new SeedSearchRequest(
                    42,
                    1,
                    MinecraftVersion.JAVA_1_21,
                    List.of(
                        requirement("village-1"),
                        requirement("village-2"),
                        requirement("village-3"),
                        requirement("village-4")),
                    1));

    SeedSearchCandidate candidate = result.candidates().getFirst();
    List<BlockPosition> matchedVillages =
        candidate.matches().stream().map(StructureMatch::actualPosition).toList();

    assertEquals(4, candidate.matchedRequirementCount());
    assertTrue(candidate.matchesAllRequirements());
    assertEquals(4, new HashSet<>(matchedVillages).size());
    assertEquals(new HashSet<>(villages), new HashSet<>(matchedVillages));
    assertEquals(1, locator.candidateSearchCount());
  }

  @Test
  void rejectsInvalidSearchLimits() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new SeedSearchRequest(
                0, 0, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 1));

    assertThrows(
        IllegalArgumentException.class,
        () ->
            new SeedSearchRequest(
                0,
                SeedSearchRequest.MAXIMUM_SEEDS_PER_BATCH + 1,
                MinecraftVersion.JAVA_1_21,
                List.of(requirement("village-1")),
                1));

    assertThrows(
        IllegalArgumentException.class,
        () -> new SeedSearchRequest(0, 1, MinecraftVersion.JAVA_1_21, List.of(), 1));

    assertThrows(
        IllegalArgumentException.class,
        () ->
            new SeedSearchRequest(
                0, 1, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 0));
  }

  @Test
  void rejectsDuplicateRequirementIdentifiers() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new SeedSearchRequest(
                    0,
                    1,
                    MinecraftVersion.JAVA_1_21,
                    List.of(requirement("village-1"), requirement("village-1")),
                    1));

    assertEquals("duplicate requirement id: village-1", error.getMessage());
  }

  @Test
  void copiesSearchRequirements() {
    List<StructureRequirement> requirements = new ArrayList<>();

    requirements.add(requirement("village-1"));

    SeedSearchRequest request =
        new SeedSearchRequest(0, 1, MinecraftVersion.JAVA_1_21, requirements, 1);

    requirements.clear();

    assertEquals(1, request.requirements().size());

    assertThrows(UnsupportedOperationException.class, () -> request.requirements().clear());
  }

  private SeedSearchService serviceUsing(StructureLocator locator) {
    return new SeedSearchService(new StructureLocatorRegistry(List.of(locator)));
  }

  private StructureRequirement requirement(String id) {
    return requirement(id, new BlockPosition(0, 0));
  }

  private StructureRequirement requirement(String id, BlockPosition center) {
    return new StructureRequirement(id, StructureType.VILLAGE, center, 1_000);
  }

  private static final class RecordingVillageLocator implements StructureLocator {

    private final Map<SearchKey, List<BlockPosition>> positions = new HashMap<>();
    private final AtomicInteger candidateSearchCount = new AtomicInteger();
    private final AtomicInteger batchSearchCount = new AtomicInteger();
    private final AtomicInteger largestBatchSeedCount = new AtomicInteger();
    private final AtomicInteger structureTypeQueryCount = new AtomicInteger();

    void locate(long seed, BlockPosition position) {
      locate(seed, new BlockPosition(0, 0), position);
    }

    void locate(long seed, BlockPosition center, BlockPosition position) {
      positions
          .computeIfAbsent(new SearchKey(seed, center, 1_000), ignored -> new ArrayList<>())
          .add(position);
    }

    int candidateSearchCount() {
      return candidateSearchCount.get();
    }

    int structureTypeQueryCount() {
      return structureTypeQueryCount.get();
    }

    int batchSearchCount() {
      return batchSearchCount.get();
    }

    int largestBatchSeedCount() {
      return largestBatchSeedCount.get();
    }

    @Override
    public StructureType structureType() {
      structureTypeQueryCount.incrementAndGet();
      return StructureType.VILLAGE;
    }

    @Override
    public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
      return findNearestCandidates(request, 1).stream().findFirst();
    }

    @Override
    public List<BlockPosition> findNearestCandidates(StructureSearchRequest request, int limit) {
      candidateSearchCount.incrementAndGet();

      return positions
          .getOrDefault(
              new SearchKey(
                  request.seed(),
                  request.requirement().center(),
                  request.requirement().radiusBlocks()),
              List.of())
          .stream()
          .limit(limit)
          .toList();
    }

    @Override
    public List<List<BlockPosition>> findNearestCandidatesBatch(
        StructureSearchBatchRequest request, int limit) {
      batchSearchCount.incrementAndGet();
      largestBatchSeedCount.accumulateAndGet(request.seedCount(), Math::max);

      List<List<BlockPosition>> candidates =
          new ArrayList<>(request.seedCount() * request.requirements().size());

      for (int seedOffset = 0; seedOffset < request.seedCount(); seedOffset++) {
        long seed = request.firstSeed() + seedOffset;

        for (StructureRequirement requirement : request.requirements()) {
          candidateSearchCount.incrementAndGet();

          candidates.add(
              positions
                  .getOrDefault(
                      new SearchKey(seed, requirement.center(), requirement.radiusBlocks()),
                      List.of())
                  .stream()
                  .limit(limit)
                  .toList());
        }
      }

      return List.copyOf(candidates);
    }
  }

  private static final class ConcurrencyTrackingVillageLocator implements StructureLocator {

    private final AtomicInteger startedCalls = new AtomicInteger();
    private final AtomicInteger activeCalls = new AtomicInteger();
    private final AtomicInteger maximumConcurrentCalls = new AtomicInteger();
    private final CountDownLatch firstTwoCallsStarted = new CountDownLatch(2);

    int maximumConcurrentCalls() {
      return maximumConcurrentCalls.get();
    }

    @Override
    public StructureType structureType() {
      return StructureType.VILLAGE;
    }

    @Override
    public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
      int startedCall = startedCalls.incrementAndGet();
      int concurrentCalls = activeCalls.incrementAndGet();

      maximumConcurrentCalls.accumulateAndGet(concurrentCalls, Math::max);

      try {
        if (startedCall <= 2) {
          firstTwoCallsStarted.countDown();

          if (!firstTwoCallsStarted.await(5, TimeUnit.SECONDS)) {
            throw new AssertionError("seed workers did not execute concurrently");
          }
        }

        return Optional.of(new BlockPosition(0, 0));
      } catch (InterruptedException exception) {
        Thread.currentThread().interrupt();
        throw new AssertionError("seed worker was interrupted", exception);
      } finally {
        activeCalls.decrementAndGet();
      }
    }
  }

  private static final class RecordingSeedSearchKernel
      implements StructureLocator, SeedSearchKernel {

    private final AtomicInteger kernelSearchCount = new AtomicInteger();
    private final AtomicInteger largestKernelSeedCount = new AtomicInteger();
    private final AtomicInteger fallbackSearchCount = new AtomicInteger();

    int kernelSearchCount() {
      return kernelSearchCount.get();
    }

    int largestKernelSeedCount() {
      return largestKernelSeedCount.get();
    }

    int fallbackSearchCount() {
      return fallbackSearchCount.get();
    }

    @Override
    public StructureType structureType() {
      return StructureType.VILLAGE;
    }

    @Override
    public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
      fallbackSearchCount.incrementAndGet();
      return Optional.empty();
    }

    @Override
    public List<SeedSearchCandidate> searchSeeds(SeedSearchRequest request) {
      kernelSearchCount.incrementAndGet();
      largestKernelSeedCount.accumulateAndGet(request.seedCount(), Math::max);

      StructureRequirement requirement = request.requirements().getFirst();
      StructureMatch match = StructureMatch.from(requirement, requirement.center());

      return List.of(
          new SeedSearchCandidate(
              request.firstSeed(), request.requirements().size(), List.of(match)));
    }
  }

  private record SearchKey(long seed, BlockPosition center, long radiusBlocks) {}
}
