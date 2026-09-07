package io.github.raisybear.yocsow.engine.search;

import java.util.Objects;

public record VillageSearchRequest(
    long seed, MinecraftVersion minecraftVersion, StructureRequirement requirement) {

  public VillageSearchRequest {
    minecraftVersion = Objects.requireNonNull(minecraftVersion, "minecraftVersion");

    requirement = Objects.requireNonNull(requirement, "requirement");

    if (requirement.structureType() != StructureType.VILLAGE) {
      throw new IllegalArgumentException("requirement must target a village");
    }
  }
}
