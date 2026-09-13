package io.github.raisybear.yocsow.engine.search.seed;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocatorRegistry;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public final class SeedSearchService {

  private static final Comparator<SeedSearchCandidate> BEST_CANDIDATE_FIRST =
      Comparator.comparingInt(SeedSearchCandidate::matchedRequirementCount)
          .reversed()
          .thenComparingDouble(SeedSearchCandidate::averageNormalizedDistance)
          .thenComparingLong(SeedSearchCandidate::seed);

  private final StructureLocatorRegistry locatorRegistry;

  public SeedSearchService(StructureLocatorRegistry locatorRegistry) {
    this.locatorRegistry = Objects.requireNonNull(locatorRegistry, "locatorRegistry");
  }

  public SeedSearchResult search(SeedSearchRequest request) {
    Objects.requireNonNull(request, "request");

    List<ResolvedRequirement> resolvedRequirements = resolveRequirements(request.requirements());

    List<SeedSearchCandidate> candidates = new ArrayList<>();

    for (int offset = 0; offset < request.seedCount(); offset++) {
      long seed = request.firstSeed() + offset;

      SeedSearchCandidate candidate = evaluateSeed(seed, request, resolvedRequirements);

      if (candidate.matchedRequirementCount() > 0) {
        candidates.add(candidate);
      }
    }

    candidates.sort(BEST_CANDIDATE_FIRST);

    List<SeedSearchCandidate> limitedCandidates =
        candidates.stream().limit(request.resultLimit()).toList();

    return new SeedSearchResult(request.seedCount(), limitedCandidates);
  }

  private List<ResolvedRequirement> resolveRequirements(List<StructureRequirement> requirements) {
    return requirements.stream()
        .map(
            requirement ->
                new ResolvedRequirement(
                    requirement, locatorRegistry.require(requirement.structureType())))
        .toList();
  }

  private SeedSearchCandidate evaluateSeed(
      long seed, SeedSearchRequest request, List<ResolvedRequirement> resolvedRequirements) {
    int candidateLimit = resolvedRequirements.size();
    List<RequirementCandidates> requirementCandidates = new ArrayList<>(candidateLimit);
    Map<SearchArea, List<BlockPosition>> candidatesBySearchArea = new HashMap<>();

    for (ResolvedRequirement resolved : resolvedRequirements) {
      StructureRequirement requirement = resolved.requirement();

      List<BlockPosition> positions =
          candidatesBySearchArea.computeIfAbsent(
              SearchArea.from(requirement),
              ignored ->
                  resolved
                      .locator()
                      .findNearestCandidates(
                          new StructureSearchRequest(seed, request.minecraftVersion(), requirement),
                          candidateLimit));

      requirementCandidates.add(
          new RequirementCandidates(requirement, resolved.locator().structureType(), positions));
    }

    List<StructureMatch> matches = assignDistinctStructures(requirementCandidates);

    return new SeedSearchCandidate(seed, resolvedRequirements.size(), matches);
  }

  private List<StructureMatch> assignDistinctStructures(
      List<RequirementCandidates> requirementCandidates) {
    List<Integer> assignmentOrder = new ArrayList<>(requirementCandidates.size());

    for (int index = 0; index < requirementCandidates.size(); index++) {
      assignmentOrder.add(index);
    }

    assignmentOrder.sort(
        Comparator.comparingInt(
                (Integer index) -> requirementCandidates.get(index).positions().size())
            .thenComparingInt(Integer::intValue));

    BlockPosition[] assignments = new BlockPosition[requirementCandidates.size()];
    Map<LocatedStructure, Integer> owners = new HashMap<>();

    for (int requirementIndex : assignmentOrder) {
      assignRequirement(
          requirementIndex, requirementCandidates, assignments, owners, new HashSet<>());
    }

    List<StructureMatch> matches = new ArrayList<>();

    for (int index = 0; index < assignments.length; index++) {
      BlockPosition position = assignments[index];

      if (position != null) {
        matches.add(StructureMatch.from(requirementCandidates.get(index).requirement(), position));
      }
    }

    return matches;
  }

  private boolean assignRequirement(
      int requirementIndex,
      List<RequirementCandidates> requirementCandidates,
      BlockPosition[] assignments,
      Map<LocatedStructure, Integer> owners,
      Set<LocatedStructure> visitedStructures) {
    RequirementCandidates candidates = requirementCandidates.get(requirementIndex);

    for (BlockPosition position : candidates.positions()) {
      LocatedStructure structure = new LocatedStructure(candidates.structureType(), position);

      if (!visitedStructures.add(structure)) {
        continue;
      }

      Integer currentOwner = owners.get(structure);

      if (currentOwner == null
          || assignRequirement(
              currentOwner, requirementCandidates, assignments, owners, visitedStructures)) {
        assignments[requirementIndex] = position;
        owners.put(structure, requirementIndex);
        return true;
      }
    }

    return false;
  }

  private record ResolvedRequirement(StructureRequirement requirement, StructureLocator locator) {}

  private record RequirementCandidates(
      StructureRequirement requirement,
      StructureType structureType,
      List<BlockPosition> positions) {

    private RequirementCandidates {
      positions = List.copyOf(positions);
    }
  }

  private record LocatedStructure(StructureType structureType, BlockPosition position) {}

  private record SearchArea(StructureType structureType, BlockPosition center, long radiusBlocks) {

    private static SearchArea from(StructureRequirement requirement) {
      return new SearchArea(
          requirement.structureType(), requirement.center(), requirement.radiusBlocks());
    }
  }
}
