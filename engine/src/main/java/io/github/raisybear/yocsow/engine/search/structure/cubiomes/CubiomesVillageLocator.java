package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import com.sun.jna.Memory;
import com.sun.jna.Pointer;
import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class CubiomesVillageLocator implements StructureLocator {

  private static final int NATIVE_JAVA_1_21 = 1;
  private static final int MAXIMUM_RESULTS = 64;
  private static final long POSITION_X_OFFSET = 0;
  private static final long POSITION_Z_OFFSET = Integer.BYTES;
  private static final long POSITION_SIZE = Integer.BYTES * 2L;

  private final CubiomesNativeLibrary nativeLibrary;

  public CubiomesVillageLocator() {
    this(CubiomesNativeLibrary.load());
  }

  CubiomesVillageLocator(CubiomesNativeLibrary nativeLibrary) {
    this.nativeLibrary = Objects.requireNonNull(nativeLibrary, "nativeLibrary");
  }

  @Override
  public StructureType structureType() {
    return StructureType.VILLAGE;
  }

  @Override
  public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
    return findNearestCandidates(request, 1).stream().findFirst();
  }

  @Override
  public List<BlockPosition> findNearestCandidates(StructureSearchRequest request, int limit) {
    Objects.requireNonNull(request, "request");

    if (limit <= 0 || limit > MAXIMUM_RESULTS) {
      throw new IllegalArgumentException(
          "village result limit must be between 1 and " + MAXIMUM_RESULTS);
    }

    StructureRequirement requirement = request.requirement();

    if (requirement.structureType() != structureType()) {
      throw new IllegalArgumentException(
          "village locator cannot search for structure type: "
              + requirement.structureType().identifier());
    }

    try (Memory resultCount = new Memory(Integer.BYTES);
        Memory results = new Memory(POSITION_SIZE * limit)) {
      resultCount.clear();
      results.clear();

      int status =
          nativeLibrary.findVillages(
              nativeMinecraftVersion(request.minecraftVersion()),
              request.seed(),
              requirement.center().x(),
              requirement.center().z(),
              requirement.radiusBlocks(),
              limit,
              resultCount,
              results);

      requireSuccessfulStatus(status, request.minecraftVersion());

      return readResults(resultCount, results, limit);
    }
  }

  private int nativeMinecraftVersion(MinecraftVersion minecraftVersion) {
    return switch (minecraftVersion) {
      case JAVA_1_21 -> NATIVE_JAVA_1_21;
    };
  }

  private void requireSuccessfulStatus(int status, MinecraftVersion minecraftVersion) {
    switch (status) {
      case CubiomesNativeLibrary.STATUS_OK -> {
        return;
      }
      case CubiomesNativeLibrary.STATUS_INVALID_ARGUMENT ->
          throw new IllegalArgumentException("native village locator rejected invalid arguments");
      case CubiomesNativeLibrary.STATUS_UNSUPPORTED_VERSION ->
          throw new IllegalArgumentException(
              "unsupported Minecraft version: " + minecraftVersion.identifier());
      case CubiomesNativeLibrary.STATUS_OUT_OF_RANGE ->
          throw new IllegalArgumentException(
              "village search area exceeds supported Minecraft coordinates");
      default ->
          throw new IllegalStateException("native village locator failed with status: " + status);
    }
  }

  private List<BlockPosition> readResults(Pointer resultCount, Pointer results, int limit) {
    int count = resultCount.getInt(0);

    if (count < 0 || count > limit) {
      throw new IllegalStateException(
          "native village locator returned invalid result count: " + count);
    }

    List<BlockPosition> positions = new ArrayList<>(count);

    for (int index = 0; index < count; index++) {
      long offset = POSITION_SIZE * index;

      positions.add(
          new BlockPosition(
              results.getInt(offset + POSITION_X_OFFSET),
              results.getInt(offset + POSITION_Z_OFFSET)));
    }

    return List.copyOf(positions);
  }
}
