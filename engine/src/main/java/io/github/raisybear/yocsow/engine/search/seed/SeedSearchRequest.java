package io.github.raisybear.yocsow.engine.search.seed;

import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

public record SeedSearchRequest(
    long firstSeed,
    int seedCount,
    MinecraftVersion minecraftVersion,
    List<StructureRequirement> requirements,
    int resultLimit) {

  public static final int MAXIMUM_SEEDS_PER_BATCH = 10_000;
  public static final int MAXIMUM_REQUIREMENTS = 32;
  public static final int MAXIMUM_RESULTS = 100;

  public SeedSearchRequest {
    minecraftVersion = Objects.requireNonNull(minecraftVersion, "minecraftVersion");
    Objects.requireNonNull(requirements, "requirements");

    if (seedCount <= 0) {
      throw new IllegalArgumentException("seedCount must be greater than zero");
    }

    if (seedCount > MAXIMUM_SEEDS_PER_BATCH) {
      throw new IllegalArgumentException("seedCount must not exceed " + MAXIMUM_SEEDS_PER_BATCH);
    }

    if (firstSeed > Long.MAX_VALUE - (seedCount - 1L)) {
      throw new IllegalArgumentException("seed batch must not exceed the signed 64-bit range");
    }

    if (requirements.isEmpty()) {
      throw new IllegalArgumentException("requirements must not be empty");
    }

    if (requirements.size() > MAXIMUM_REQUIREMENTS) {
      throw new IllegalArgumentException(
          "requirements must not contain more than " + MAXIMUM_REQUIREMENTS + " entries");
    }

    List<StructureRequirement> copiedRequirements = new ArrayList<>(requirements.size());
    Set<String> requirementIds = new HashSet<>();

    for (StructureRequirement requirement : requirements) {
      StructureRequirement nonNullRequirement = Objects.requireNonNull(requirement, "requirement");

      if (!requirementIds.add(nonNullRequirement.id())) {
        throw new IllegalArgumentException("duplicate requirement id: " + nonNullRequirement.id());
      }

      copiedRequirements.add(nonNullRequirement);
    }

    requirements = List.copyOf(copiedRequirements);

    if (resultLimit <= 0) {
      throw new IllegalArgumentException("resultLimit must be greater than zero");
    }

    if (resultLimit > MAXIMUM_RESULTS) {
      throw new IllegalArgumentException("resultLimit must not exceed " + MAXIMUM_RESULTS);
    }
  }
}
