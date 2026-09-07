package io.github.raisybear.yocsow.engine.search;

import java.util.Objects;

public record StructureRequirement(
    String id, StructureType structureType, BlockPosition center, long radiusBlocks) {

  public StructureRequirement {
    id = Objects.requireNonNull(id, "id").trim();
    structureType = Objects.requireNonNull(structureType, "structureType");
    center = Objects.requireNonNull(center, "center");

    if (id.isEmpty()) {
      throw new IllegalArgumentException("id must not be blank");
    }

    if (radiusBlocks <= 0) {
      throw new IllegalArgumentException("radiusBlocks must be greater than zero");
    }
  }
}
