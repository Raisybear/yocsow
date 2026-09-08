package io.github.raisybear.yocsow.engine.search.seed;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record SeedSearchCandidate(
    long seed, int totalRequirementCount, List<StructureMatch> matches) {

  public SeedSearchCandidate {
    Objects.requireNonNull(matches, "matches");

    if (totalRequirementCount <= 0) {
      throw new IllegalArgumentException("totalRequirementCount must be greater than zero");
    }

    if (matches.size() > totalRequirementCount) {
      throw new IllegalArgumentException("matches must not exceed totalRequirementCount");
    }

    List<StructureMatch> copiedMatches = new ArrayList<>(matches.size());
    Set<String> requirementIds = new HashSet<>();

    for (StructureMatch match : matches) {
      StructureMatch nonNullMatch = Objects.requireNonNull(match, "match");

      if (!requirementIds.add(nonNullMatch.requirementId())) {
        throw new IllegalArgumentException(
            "duplicate matched requirement id: " + nonNullMatch.requirementId());
      }

      copiedMatches.add(nonNullMatch);
    }

    matches = List.copyOf(copiedMatches);
  }

  public int matchedRequirementCount() {
    return matches.size();
  }

  public boolean matchesAllRequirements() {
    return matchedRequirementCount() == totalRequirementCount;
  }

  public double matchRatio() {
    return (double) matchedRequirementCount() / totalRequirementCount;
  }

  public double averageNormalizedDistance() {
    return matches.stream()
        .mapToDouble(StructureMatch::normalizedDistance)
        .average()
        .orElse(Double.POSITIVE_INFINITY);
  }
}
