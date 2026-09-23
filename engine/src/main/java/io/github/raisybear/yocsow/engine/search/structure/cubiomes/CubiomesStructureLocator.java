package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import com.sun.jna.Memory;
import com.sun.jna.Pointer;
import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchBatchRequest;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

/** Locates configurable overworld structures through the shared Cubiomes batch boundary. */
public final class CubiomesStructureLocator implements StructureLocator {

  private static final int NATIVE_JAVA_1_21 = 1;
  private static final int NATIVE_RUINED_PORTAL = 2;
  private static final int NATIVE_WOODLAND_MANSION = 3;
  private static final int NATIVE_DESERT_TEMPLE = 4;
  private static final int MAXIMUM_BATCH_SEEDS = 10_000;
  private static final int MAXIMUM_SEARCH_AREAS = 32;
  private static final int MAXIMUM_RESULTS = 64;
  private static final long SEARCH_AREA_CENTER_X_OFFSET = 0;
  private static final long SEARCH_AREA_CENTER_Z_OFFSET = Long.BYTES;
  private static final long SEARCH_AREA_RADIUS_OFFSET = Long.BYTES * 2L;
  private static final long SEARCH_AREA_SIZE = Long.BYTES * 3L;
  private static final long POSITION_X_OFFSET = 0;
  private static final long POSITION_Z_OFFSET = Integer.BYTES;
  private static final long POSITION_SIZE = Integer.BYTES * 2L;

  private final StructureType structureType;
  private final int nativeStructure;
  private final CubiomesStructureNativeLibrary nativeLibrary;

  public static CubiomesStructureLocator ruinedPortal() {
    return new CubiomesStructureLocator(
        StructureType.RUINED_PORTAL, NATIVE_RUINED_PORTAL, CubiomesStructureNativeLibrary.load());
  }

  public static CubiomesStructureLocator woodlandMansion() {
    return new CubiomesStructureLocator(
        StructureType.WOODLAND_MANSION,
        NATIVE_WOODLAND_MANSION,
        CubiomesStructureNativeLibrary.load());
  }

  public static CubiomesStructureLocator desertTemple() {
    return new CubiomesStructureLocator(
        StructureType.DESERT_TEMPLE, NATIVE_DESERT_TEMPLE, CubiomesStructureNativeLibrary.load());
  }

  CubiomesStructureLocator(
      StructureType structureType,
      int nativeStructure,
      CubiomesStructureNativeLibrary nativeLibrary) {
    this.structureType = Objects.requireNonNull(structureType, "structureType");

    if (!structureType.requiresDistinctPosition()) {
      throw new IllegalArgumentException("structure locator requires a distinct-position type");
    }

    if (nativeStructure <= 0) {
      throw new IllegalArgumentException("nativeStructure must be greater than zero");
    }

    this.nativeStructure = nativeStructure;
    this.nativeLibrary = Objects.requireNonNull(nativeLibrary, "nativeLibrary");
  }

  @Override
  public StructureType structureType() {
    return structureType;
  }

  @Override
  public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
    return findNearestCandidates(request, 1).stream().findFirst();
  }

  @Override
  public List<BlockPosition> findNearestCandidates(StructureSearchRequest request, int limit) {
    Objects.requireNonNull(request, "request");
    validateLimit(limit);
    StructureRequirement requirement = requireSupportedRequirement(request.requirement());

    try (Memory resultCount = new Memory(Integer.BYTES);
        Memory results = new Memory(POSITION_SIZE * limit)) {
      resultCount.clear();
      results.clear();

      int status =
          nativeLibrary.findStructures(
              nativeMinecraftVersion(request.minecraftVersion()),
              nativeStructure,
              request.seed(),
              requirement.center().x(),
              requirement.center().z(),
              requirement.radiusBlocks(),
              limit,
              resultCount,
              results);

      requireSuccessfulStatus(status, request.minecraftVersion());
      return readResults(resultCount.getInt(0), results, 0, limit);
    }
  }

  @Override
  public List<List<BlockPosition>> findNearestCandidatesBatch(
      StructureSearchBatchRequest request, int limit) {
    Objects.requireNonNull(request, "request");
    validateLimit(limit);

    if (request.seedCount() > MAXIMUM_BATCH_SEEDS) {
      throw new IllegalArgumentException(
          structureName() + " batch must not contain more than " + MAXIMUM_BATCH_SEEDS + " seeds");
    }

    if (request.requirements().size() > MAXIMUM_SEARCH_AREAS) {
      throw new IllegalArgumentException(
          structureName()
              + " batch must not contain more than "
              + MAXIMUM_SEARCH_AREAS
              + " search areas");
    }

    List<StructureRequirement> requirements =
        request.requirements().stream().map(this::requireSupportedRequirement).toList();
    int resultCountCapacity = Math.multiplyExact(request.seedCount(), requirements.size());
    long resultPositionCapacity = Math.multiplyExact((long) resultCountCapacity, limit);

    try (Memory searchAreas =
            new Memory(Math.multiplyExact(SEARCH_AREA_SIZE, requirements.size()));
        Memory resultCounts =
            new Memory(Math.multiplyExact((long) Integer.BYTES, resultCountCapacity));
        Memory results = new Memory(Math.multiplyExact(POSITION_SIZE, resultPositionCapacity))) {
      writeSearchAreas(searchAreas, requirements);

      int status =
          nativeLibrary.findStructuresBatch(
              nativeMinecraftVersion(request.minecraftVersion()),
              nativeStructure,
              request.firstSeed(),
              request.seedCount(),
              searchAreas,
              requirements.size(),
              limit,
              resultCountCapacity,
              resultCounts,
              resultPositionCapacity,
              results);

      requireSuccessfulStatus(status, request.minecraftVersion());
      List<List<BlockPosition>> candidates = new ArrayList<>(resultCountCapacity);

      for (int resultIndex = 0; resultIndex < resultCountCapacity; resultIndex++) {
        int count = resultCounts.getInt((long) resultIndex * Integer.BYTES);
        long positionOffset = (long) resultIndex * limit * POSITION_SIZE;
        candidates.add(readResults(count, results, positionOffset, limit));
      }

      return List.copyOf(candidates);
    }
  }

  private void validateLimit(int limit) {
    if (limit <= 0 || limit > MAXIMUM_RESULTS) {
      throw new IllegalArgumentException(
          structureName() + " result limit must be between 1 and " + MAXIMUM_RESULTS);
    }
  }

  private StructureRequirement requireSupportedRequirement(StructureRequirement requirement) {
    Objects.requireNonNull(requirement, "requirement");

    if (requirement.structureType() != structureType) {
      throw new IllegalArgumentException(
          structureName()
              + " locator cannot search for structure type: "
              + requirement.structureType().identifier());
    }

    return requirement;
  }

  private void writeSearchAreas(Pointer searchAreas, List<StructureRequirement> requirements) {
    for (int index = 0; index < requirements.size(); index++) {
      StructureRequirement requirement = requirements.get(index);
      long offset = index * SEARCH_AREA_SIZE;

      searchAreas.setLong(offset + SEARCH_AREA_CENTER_X_OFFSET, requirement.center().x());
      searchAreas.setLong(offset + SEARCH_AREA_CENTER_Z_OFFSET, requirement.center().z());
      searchAreas.setLong(offset + SEARCH_AREA_RADIUS_OFFSET, requirement.radiusBlocks());
    }
  }

  private int nativeMinecraftVersion(MinecraftVersion minecraftVersion) {
    return switch (minecraftVersion) {
      case JAVA_1_21 -> NATIVE_JAVA_1_21;
    };
  }

  private void requireSuccessfulStatus(int status, MinecraftVersion minecraftVersion) {
    switch (status) {
      case CubiomesStructureNativeLibrary.STATUS_OK -> {
        return;
      }
      case CubiomesStructureNativeLibrary.STATUS_INVALID_ARGUMENT ->
          throw new IllegalArgumentException(
              "native " + structureName() + " locator rejected invalid arguments");
      case CubiomesStructureNativeLibrary.STATUS_UNSUPPORTED_VERSION ->
          throw new IllegalArgumentException(
              "unsupported Minecraft version: " + minecraftVersion.identifier());
      case CubiomesStructureNativeLibrary.STATUS_OUT_OF_RANGE ->
          throw new IllegalArgumentException(
              structureName() + " search area exceeds supported Minecraft coordinates");
      case CubiomesStructureNativeLibrary.STATUS_BUFFER_TOO_SMALL ->
          throw new IllegalStateException(
              "native " + structureName() + " locator rejected result buffer sizes");
      default ->
          throw new IllegalStateException(
              "native " + structureName() + " locator failed with status: " + status);
    }
  }

  private List<BlockPosition> readResults(
      int count, Pointer results, long positionOffset, int limit) {
    if (count < 0 || count > limit) {
      throw new IllegalStateException(
          "native " + structureName() + " locator returned invalid result count: " + count);
    }

    List<BlockPosition> positions = new ArrayList<>(count);

    for (int index = 0; index < count; index++) {
      long offset = positionOffset + POSITION_SIZE * index;
      positions.add(
          new BlockPosition(
              results.getInt(offset + POSITION_X_OFFSET),
              results.getInt(offset + POSITION_Z_OFFSET)));
    }

    return List.copyOf(positions);
  }

  private String structureName() {
    return structureType.identifier();
  }
}
