package io.github.raisybear.yocsow.engine.search.seed;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import java.util.Objects;

public record StructureMatch(
    String requirementId,
    StructureType structureType,
    BlockPosition targetCenter,
    long radiusBlocks,
    BlockPosition actualPosition) {

  public StructureMatch {
    requirementId = Objects.requireNonNull(requirementId, "requirementId").trim();
    structureType = Objects.requireNonNull(structureType, "structureType");
    targetCenter = Objects.requireNonNull(targetCenter, "targetCenter");
    actualPosition = Objects.requireNonNull(actualPosition, "actualPosition");

    if (requirementId.isEmpty()) {
      throw new IllegalArgumentException("requirementId must not be blank");
    }

    if (radiusBlocks <= 0) {
      throw new IllegalArgumentException("radiusBlocks must be greater than zero");
    }

    if (distanceBetween(targetCenter, actualPosition) > radiusBlocks) {
      throw new IllegalArgumentException("actualPosition must be inside the requirement radius");
    }
  }

  public static StructureMatch from(
      StructureRequirement requirement, BlockPosition actualPosition) {
    Objects.requireNonNull(requirement, "requirement");

    return new StructureMatch(
        requirement.id(),
        requirement.structureType(),
        requirement.center(),
        requirement.radiusBlocks(),
        actualPosition);
  }

  public double distanceBlocks() {
    return distanceBetween(targetCenter, actualPosition);
  }

  public double normalizedDistance() {
    return distanceBlocks() / radiusBlocks;
  }

  private static double distanceBetween(BlockPosition first, BlockPosition second) {
    double differenceX = (double) second.x() - first.x();
    double differenceZ = (double) second.z() - first.z();

    return Math.hypot(differenceX, differenceZ);
  }
}
