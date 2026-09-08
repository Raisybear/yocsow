package io.github.raisybear.yocsow.engine.search.seed;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocatorRegistry;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

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
    List<StructureMatch> matches = new ArrayList<>();

    for (ResolvedRequirement resolved : resolvedRequirements) {
      StructureRequirement requirement = resolved.requirement();

      Optional<BlockPosition> position =
          resolved
              .locator()
              .findNearest(
                  new StructureSearchRequest(seed, request.minecraftVersion(), requirement));

      position.ifPresent(
          actualPosition -> matches.add(StructureMatch.from(requirement, actualPosition)));
    }

    return new SeedSearchCandidate(seed, resolvedRequirements.size(), matches);
  }

  private record ResolvedRequirement(StructureRequirement requirement, StructureLocator locator) {}
}
