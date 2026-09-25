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

/** Native Cubiomes-backed locator for point-and-extent biome requirements. */
public final class CubiomesBiomeLocator implements StructureLocator {

  private static final int NATIVE_JAVA_1_21 = 1;
  private static final int NATIVE_TAIGA = 1;
  private static final int MAXIMUM_BATCH_SEEDS = 10_000;
  private static final int MAXIMUM_SEARCH_AREAS = 32;
  private static final long AREA_BIOME_OFFSET = 0;
  private static final long AREA_RADIUS_OFFSET = Integer.BYTES;
  private static final long AREA_CENTER_X_OFFSET = Integer.BYTES * 2L;
  private static final long AREA_CENTER_Z_OFFSET = Integer.BYTES * 2L + Long.BYTES;
  private static final long AREA_SIZE = Integer.BYTES * 2L + Long.BYTES * 2L;

  private final StructureType structureType;
  private final int nativeBiome;
  private final CubiomesNativeLibrary nativeLibrary;

  public static CubiomesBiomeLocator taiga() {
    return new CubiomesBiomeLocator(
        StructureType.TAIGA, NATIVE_TAIGA, CubiomesNativeLibrary.load());
  }

  CubiomesBiomeLocator(
      StructureType structureType, int nativeBiome, CubiomesNativeLibrary nativeLibrary) {
    this.structureType = Objects.requireNonNull(structureType, "structureType");
    this.nativeBiome = nativeBiome;
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

    return findNearestCandidatesBatch(
            new StructureSearchBatchRequest(
                request.seed(), 1, request.minecraftVersion(), List.of(request.requirement())),
            limit)
        .getFirst();
  }

  @Override
  public List<List<BlockPosition>> findNearestCandidatesBatch(
      StructureSearchBatchRequest request, int limit) {
    Objects.requireNonNull(request, "request");

    if (limit <= 0) {
      throw new IllegalArgumentException("biome result limit must be greater than zero");
    }

    if (request.seedCount() > MAXIMUM_BATCH_SEEDS) {
      throw new IllegalArgumentException(
          "biome batch must not contain more than " + MAXIMUM_BATCH_SEEDS + " seeds");
    }

    if (request.requirements().size() > MAXIMUM_SEARCH_AREAS) {
      throw new IllegalArgumentException(
          "biome batch must not contain more than " + MAXIMUM_SEARCH_AREAS + " search areas");
    }

    List<StructureRequirement> requirements =
        request.requirements().stream().map(this::requireBiomeRequirement).toList();
    int resultCount = Math.multiplyExact(request.seedCount(), requirements.size());

    try (Memory searchAreas = new Memory(Math.multiplyExact(AREA_SIZE, requirements.size()));
        Memory matches = new Memory(Math.multiplyExact((long) Integer.BYTES, resultCount))) {
      writeSearchAreas(searchAreas, requirements);
      matches.clear();

      int status =
          nativeLibrary.matchBiomesBatch(
              nativeMinecraftVersion(request.minecraftVersion()),
              request.firstSeed(),
              request.seedCount(),
              searchAreas,
              requirements.size(),
              resultCount,
              matches);

      requireSuccessfulStatus(status, request.minecraftVersion());

      List<List<BlockPosition>> results = new ArrayList<>(resultCount);

      for (int index = 0; index < resultCount; index++) {
        int found = matches.getInt((long) index * Integer.BYTES);

        if (found != 0 && found != 1) {
          throw new IllegalStateException(
              "native biome locator returned invalid match flag: " + found);
        }

        StructureRequirement requirement = requirements.get(index % requirements.size());
        results.add(found == 1 ? List.of(requirement.center()) : List.of());
      }

      return List.copyOf(results);
    }
  }

  private StructureRequirement requireBiomeRequirement(StructureRequirement requirement) {
    Objects.requireNonNull(requirement, "requirement");

    if (requirement.structureType() != structureType) {
      throw new IllegalArgumentException(
          "biome locator cannot search for target type: "
              + requirement.structureType().identifier());
    }

    if (requirement.radiusBlocks() > Integer.MAX_VALUE) {
      throw new IllegalArgumentException("biome radius exceeds the native range");
    }

    return requirement;
  }

  private void writeSearchAreas(Pointer searchAreas, List<StructureRequirement> requirements) {
    for (int index = 0; index < requirements.size(); index++) {
      StructureRequirement requirement = requirements.get(index);
      long offset = index * AREA_SIZE;

      searchAreas.setInt(offset + AREA_BIOME_OFFSET, nativeBiome);
      searchAreas.setInt(offset + AREA_RADIUS_OFFSET, (int) requirement.radiusBlocks());
      searchAreas.setLong(offset + AREA_CENTER_X_OFFSET, requirement.center().x());
      searchAreas.setLong(offset + AREA_CENTER_Z_OFFSET, requirement.center().z());
    }
  }

  private int nativeMinecraftVersion(MinecraftVersion minecraftVersion) {
    if (MinecraftVersion.JAVA_1_21.equals(minecraftVersion)) {
      return NATIVE_JAVA_1_21;
    }

    throw new IllegalArgumentException(
        "unsupported Minecraft version: " + minecraftVersion.identifier());
  }

  private void requireSuccessfulStatus(int status, MinecraftVersion minecraftVersion) {
    switch (status) {
      case CubiomesNativeLibrary.STATUS_OK -> {
        return;
      }
      case CubiomesNativeLibrary.STATUS_INVALID_ARGUMENT ->
          throw new IllegalArgumentException("native biome locator rejected invalid arguments");
      case CubiomesNativeLibrary.STATUS_UNSUPPORTED_VERSION ->
          throw new IllegalArgumentException(
              "unsupported Minecraft version: " + minecraftVersion.identifier());
      case CubiomesNativeLibrary.STATUS_OUT_OF_RANGE ->
          throw new IllegalArgumentException(
              "biome search area exceeds supported Minecraft coordinates");
      case CubiomesNativeLibrary.STATUS_BUFFER_TOO_SMALL ->
          throw new IllegalStateException("native biome locator rejected result buffer sizes");
      default ->
          throw new IllegalStateException("native biome locator failed with status: " + status);
    }
  }
}
