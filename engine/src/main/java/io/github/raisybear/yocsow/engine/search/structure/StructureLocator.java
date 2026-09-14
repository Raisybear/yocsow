package io.github.raisybear.yocsow.engine.search.structure;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.StructureType;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
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

  /**
   * Finds candidates for consecutive seeds and multiple requirements.
   *
   * <p>The returned list uses seed-major order: all requirements for the first seed, followed by
   * all requirements for the next seed. Implementations can override this scalar fallback with a
   * native batch operation.
   */
  default List<List<BlockPosition>> findNearestCandidatesBatch(
      StructureSearchBatchRequest request, int limit) {
    Objects.requireNonNull(request, "request");

    if (limit <= 0) {
      throw new IllegalArgumentException("limit must be greater than zero");
    }

    List<List<BlockPosition>> candidates =
        new ArrayList<>(Math.multiplyExact(request.seedCount(), request.requirements().size()));

    for (int seedOffset = 0; seedOffset < request.seedCount(); seedOffset++) {
      long seed = request.firstSeed() + seedOffset;

      for (var requirement : request.requirements()) {
        candidates.add(
            List.copyOf(
                findNearestCandidates(
                    new StructureSearchRequest(seed, request.minecraftVersion(), requirement),
                    limit)));
      }
    }

    return List.copyOf(candidates);
  }
}
