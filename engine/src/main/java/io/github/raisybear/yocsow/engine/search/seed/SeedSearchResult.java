package io.github.raisybear.yocsow.engine.search.seed;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;

public record SeedSearchResult(int searchedSeedCount, List<SeedSearchCandidate> candidates) {

  public SeedSearchResult {
    Objects.requireNonNull(candidates, "candidates");

    if (searchedSeedCount < 0) {
      throw new IllegalArgumentException("searchedSeedCount must not be negative");
    }

    List<SeedSearchCandidate> copiedCandidates = new ArrayList<>(candidates.size());

    for (SeedSearchCandidate candidate : candidates) {
      copiedCandidates.add(Objects.requireNonNull(candidate, "candidate"));
    }

    candidates = List.copyOf(copiedCandidates);
  }
}
