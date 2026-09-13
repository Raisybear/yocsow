package io.github.raisybear.yocsow.engine.search.structure;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.StructureType;
import java.util.List;
import java.util.Optional;

/**
 * Locates one structure type for immutable search requests.
 *
 * <p>Implementations must support concurrent calls. Seed searches share each registered locator
 * across a bounded pool of seed worker threads.
 */
public interface StructureLocator {

  StructureType structureType();

  /** Finds the nearest confirmed structure inside the requirement's inclusive block radius. */
  Optional<BlockPosition> findNearest(StructureSearchRequest request);

  /**
   * Finds up to {@code limit} distinct confirmed structures ordered from nearest to farthest.
   *
   * <p>Locators that only support one result can use this default implementation.
   */
  default List<BlockPosition> findNearestCandidates(StructureSearchRequest request, int limit) {
    if (limit <= 0) {
      throw new IllegalArgumentException("limit must be greater than zero");
    }

    return findNearest(request).stream().toList();
  }
}
