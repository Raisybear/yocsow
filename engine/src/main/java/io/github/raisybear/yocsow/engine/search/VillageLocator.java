package io.github.raisybear.yocsow.engine.search;

import java.util.Optional;

@FunctionalInterface
public interface VillageLocator {

  /** Finds the nearest confirmed village inside the requirement's inclusive block radius. */
  Optional<BlockPosition> findNearest(VillageSearchRequest request);
}
