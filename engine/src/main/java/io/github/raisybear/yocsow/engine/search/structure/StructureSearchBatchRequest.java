package io.github.raisybear.yocsow.engine.search.structure;

import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import java.util.List;
import java.util.Objects;

public record StructureSearchBatchRequest(
    long firstSeed,
    int seedCount,
    MinecraftVersion minecraftVersion,
    List<StructureRequirement> requirements) {

  public StructureSearchBatchRequest {
    minecraftVersion = Objects.requireNonNull(minecraftVersion, "minecraftVersion");
    Objects.requireNonNull(requirements, "requirements");

    if (seedCount <= 0) {
      throw new IllegalArgumentException("seedCount must be greater than zero");
    }

    if (firstSeed > Long.MAX_VALUE - (seedCount - 1L)) {
      throw new IllegalArgumentException("seed batch must not exceed the signed 64-bit range");
    }

    if (requirements.isEmpty()) {
      throw new IllegalArgumentException("requirements must not be empty");
    }

    requirements = List.copyOf(requirements);
  }
}
