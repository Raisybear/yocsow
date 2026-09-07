package io.github.raisybear.yocsow.engine.search.structure;

import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import java.util.Objects;

public record StructureSearchRequest(
    long seed, MinecraftVersion minecraftVersion, StructureRequirement requirement) {

  public StructureSearchRequest {
    minecraftVersion = Objects.requireNonNull(minecraftVersion, "minecraftVersion");

    requirement = Objects.requireNonNull(requirement, "requirement");
  }
}
