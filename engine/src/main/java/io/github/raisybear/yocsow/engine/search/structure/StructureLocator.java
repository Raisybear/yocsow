package io.github.raisybear.yocsow.engine.search.structure;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.StructureType;
import java.util.Optional;

public interface StructureLocator {

  StructureType structureType();

  /** Finds the nearest confirmed structure inside the requirement's inclusive block radius. */
  Optional<BlockPosition> findNearest(StructureSearchRequest request);
}
