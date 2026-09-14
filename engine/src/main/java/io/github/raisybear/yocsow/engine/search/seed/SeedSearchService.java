package io.github.raisybear.yocsow.engine.search.seed;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocatorRegistry;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.io.Serial;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ForkJoinPool;
import java.util.concurrent.ForkJoinWorkerThread;
import java.util.concurrent.RecursiveTask;
import java.util.concurrent.atomic.AtomicInteger;

public final class SeedSearchService {

  private static final int TARGET_TASKS_PER_WORKER = 4;
  private static final AtomicInteger WORKER_SEQUENCE = new AtomicInteger();
  private static final ForkJoinPool DEFAULT_WORKER_POOL = createDefaultWorkerPool();

  private static final Comparator<SeedSearchCandidate> BEST_CANDIDATE_FIRST =
      Comparator.comparingInt(SeedSearchCandidate::matchedRequirementCount)
          .reversed()
          .thenComparingDouble(SeedSearchCandidate::averageNormalizedDistance)
          .thenComparingLong(SeedSearchCandidate::seed);

  private final StructureLocatorRegistry locatorRegistry;
  private final ForkJoinPool workerPool;

  public SeedSearchService(StructureLocatorRegistry locatorRegistry) {
    this(locatorRegistry, DEFAULT_WORKER_POOL);
  }

  SeedSearchService(StructureLocatorRegistry locatorRegistry, ForkJoinPool workerPool) {
    this.locatorRegistry = Objects.requireNonNull(locatorRegistry, "locatorRegistry");
    this.workerPool = Objects.requireNonNull(workerPool, "workerPool");
  }

  public SeedSearchResult search(SeedSearchRequest request) {
    Objects.requireNonNull(request, "request");

    SearchPlan searchPlan = createSearchPlan(request.requirements());

    int taskSize = taskSize(request.seedCount(), workerPool.getParallelism());
    List<SeedSearchCandidate> candidates =
        workerPool.invoke(
            new EvaluateSeedRangeTask(request, searchPlan, 0, request.seedCount(), taskSize));

    candidates.sort(BEST_CANDIDATE_FIRST);

    List<SeedSearchCandidate> limitedCandidates =
        candidates.stream().limit(request.resultLimit()).toList();

    return new SeedSearchResult(request.seedCount(), limitedCandidates);
  }

  private static ForkJoinPool createDefaultWorkerPool() {
    int parallelism = Math.max(1, Runtime.getRuntime().availableProcessors());

    return new ForkJoinPool(
        parallelism,
        pool -> {
          ForkJoinWorkerThread worker =
              ForkJoinPool.defaultForkJoinWorkerThreadFactory.newThread(pool);

          worker.setDaemon(true);
          worker.setName("yocsow-seed-search-" + WORKER_SEQUENCE.incrementAndGet());
          return worker;
        },
        null,
        false);
  }

  private static int taskSize(int seedCount, int parallelism) {
    int targetTaskCount = parallelism * TARGET_TASKS_PER_WORKER;

    return Math.max(1, (seedCount + targetTaskCount - 1) / targetTaskCount);
  }

  private List<SeedSearchCandidate> evaluateSeedRange(
      SeedSearchRequest request, SearchPlan searchPlan, int firstOffset, int endOffset) {
    List<SeedSearchCandidate> candidates = new ArrayList<>(endOffset - firstOffset);

    for (int offset = firstOffset; offset < endOffset; offset++) {
      long seed = request.firstSeed() + offset;
      SeedSearchCandidate candidate = evaluateSeed(seed, request, searchPlan);

      if (candidate.matchedRequirementCount() > 0) {
        candidates.add(candidate);
      }
    }

    return candidates;
  }

  private SearchPlan createSearchPlan(List<StructureRequirement> requirements) {
    List<PlannedRequirement> plannedRequirements = new ArrayList<>(requirements.size());
    List<PlannedSearch> plannedSearches = new ArrayList<>();
    Map<SearchArea, Integer> searchIndexes = new HashMap<>();

    for (StructureRequirement requirement : requirements) {
      StructureLocator locator = locatorRegistry.require(requirement.structureType());
      SearchArea searchArea = SearchArea.from(requirement);
      Integer searchIndex = searchIndexes.get(searchArea);

      if (searchIndex == null) {
        searchIndex = plannedSearches.size();
        searchIndexes.put(searchArea, searchIndex);
        plannedSearches.add(new PlannedSearch(requirement, locator));
      }

      plannedRequirements.add(
          new PlannedRequirement(requirement, requirement.structureType(), searchIndex));
    }

    return new SearchPlan(plannedRequirements, plannedSearches);
  }

  private SeedSearchCandidate evaluateSeed(
      long seed, SeedSearchRequest request, SearchPlan searchPlan) {
    int candidateLimit = searchPlan.requirements().size();
    List<List<BlockPosition>> candidatesBySearch = new ArrayList<>(searchPlan.searches().size());

    for (PlannedSearch search : searchPlan.searches()) {
      List<BlockPosition> positions =
          search
              .locator()
              .findNearestCandidates(
                  new StructureSearchRequest(
                      seed, request.minecraftVersion(), search.representativeRequirement()),
                  candidateLimit);

      candidatesBySearch.add(List.copyOf(positions));
    }

    List<StructureMatch> matches = assignDistinctStructures(searchPlan, candidatesBySearch);

    return new SeedSearchCandidate(seed, searchPlan.requirements().size(), matches);
  }

  private List<StructureMatch> assignDistinctStructures(
      SearchPlan searchPlan, List<List<BlockPosition>> candidatesBySearch) {
    List<Integer> assignmentOrder = new ArrayList<>(searchPlan.requirements().size());

    for (int index = 0; index < searchPlan.requirements().size(); index++) {
      assignmentOrder.add(index);
    }

    assignmentOrder.sort(
        Comparator.comparingInt(
                (Integer index) ->
                    candidatesBySearch
                        .get(searchPlan.requirements().get(index).searchIndex())
                        .size())
            .thenComparingInt(Integer::intValue));

    BlockPosition[] assignments = new BlockPosition[searchPlan.requirements().size()];
    Map<LocatedStructure, Integer> owners = new HashMap<>();

    for (int requirementIndex : assignmentOrder) {
      assignRequirement(
          requirementIndex, searchPlan, candidatesBySearch, assignments, owners, new HashSet<>());
    }

    List<StructureMatch> matches = new ArrayList<>();

    for (int index = 0; index < assignments.length; index++) {
      BlockPosition position = assignments[index];

      if (position != null) {
        matches.add(
            StructureMatch.from(searchPlan.requirements().get(index).requirement(), position));
      }
    }

    return matches;
  }

  private boolean assignRequirement(
      int requirementIndex,
      SearchPlan searchPlan,
      List<List<BlockPosition>> candidatesBySearch,
      BlockPosition[] assignments,
      Map<LocatedStructure, Integer> owners,
      Set<LocatedStructure> visitedStructures) {
    PlannedRequirement requirement = searchPlan.requirements().get(requirementIndex);
    List<BlockPosition> candidates = candidatesBySearch.get(requirement.searchIndex());

    for (BlockPosition position : candidates) {
      LocatedStructure structure = new LocatedStructure(requirement.structureType(), position);

      if (!visitedStructures.add(structure)) {
        continue;
      }

      Integer currentOwner = owners.get(structure);

      if (currentOwner == null
          || assignRequirement(
              currentOwner,
              searchPlan,
              candidatesBySearch,
              assignments,
              owners,
              visitedStructures)) {
        assignments[requirementIndex] = position;
        owners.put(structure, requirementIndex);
        return true;
      }
    }

    return false;
  }

  private record SearchPlan(List<PlannedRequirement> requirements, List<PlannedSearch> searches) {

    private SearchPlan {
      requirements = List.copyOf(requirements);
      searches = List.copyOf(searches);
    }
  }

  private record PlannedRequirement(
      StructureRequirement requirement, StructureType structureType, int searchIndex) {}

  private record PlannedSearch(
      StructureRequirement representativeRequirement, StructureLocator locator) {}

  private record LocatedStructure(StructureType structureType, BlockPosition position) {}

  private record SearchArea(StructureType structureType, BlockPosition center, long radiusBlocks) {

    private static SearchArea from(StructureRequirement requirement) {
      return new SearchArea(
          requirement.structureType(), requirement.center(), requirement.radiusBlocks());
    }
  }

  private final class EvaluateSeedRangeTask extends RecursiveTask<List<SeedSearchCandidate>> {

    @Serial private static final long serialVersionUID = 1L;

    private final SeedSearchRequest request;
    private final SearchPlan searchPlan;
    private final int firstOffset;
    private final int endOffset;
    private final int taskSize;

    private EvaluateSeedRangeTask(
        SeedSearchRequest request,
        SearchPlan searchPlan,
        int firstOffset,
        int endOffset,
        int taskSize) {
      this.request = request;
      this.searchPlan = searchPlan;
      this.firstOffset = firstOffset;
      this.endOffset = endOffset;
      this.taskSize = taskSize;
    }

    @Override
    protected List<SeedSearchCandidate> compute() {
      if (endOffset - firstOffset <= taskSize) {
        return evaluateSeedRange(request, searchPlan, firstOffset, endOffset);
      }

      int middleOffset = firstOffset + (endOffset - firstOffset) / 2;
      EvaluateSeedRangeTask firstTask =
          new EvaluateSeedRangeTask(request, searchPlan, firstOffset, middleOffset, taskSize);
      EvaluateSeedRangeTask secondTask =
          new EvaluateSeedRangeTask(request, searchPlan, middleOffset, endOffset, taskSize);

      firstTask.fork();
      List<SeedSearchCandidate> secondCandidates = secondTask.compute();
      List<SeedSearchCandidate> firstCandidates = firstTask.join();
      List<SeedSearchCandidate> candidates =
          new ArrayList<>(firstCandidates.size() + secondCandidates.size());

      candidates.addAll(firstCandidates);
      candidates.addAll(secondCandidates);
      return candidates;
    }
  }
}
