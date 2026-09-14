package io.github.raisybear.yocsow.engine.search.seed;

import java.util.List;

/** Evaluates complete seed-search ranges inside an optimized implementation boundary. */
public interface SeedSearchKernel {

  /**
   * Returns at most the requested result limit in the same best-first order used by {@link
   * SeedSearchService}. Implementations must support concurrent calls.
   */
  List<SeedSearchCandidate> searchSeeds(SeedSearchRequest request);
}
