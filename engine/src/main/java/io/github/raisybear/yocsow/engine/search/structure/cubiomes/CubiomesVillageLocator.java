package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import com.sun.jna.Memory;
import com.sun.jna.Pointer;
import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.Objects;
import java.util.Optional;

public final class CubiomesVillageLocator implements StructureLocator {

  private static final int NATIVE_JAVA_1_21 = 1;
  private static final long RESULT_FOUND_OFFSET = 0;
  private static final long RESULT_X_OFFSET = Integer.BYTES;
  private static final long RESULT_Z_OFFSET = Integer.BYTES * 2L;
  private static final long RESULT_SIZE = Integer.BYTES * 3L;

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
    Objects.requireNonNull(request, "request");

    StructureRequirement requirement = request.requirement();

    if (requirement.structureType() != structureType()) {
      throw new IllegalArgumentException(
          "village locator cannot search for structure type: "
              + requirement.structureType().identifier());
    }

    try (Memory result = new Memory(RESULT_SIZE)) {
      result.clear();

      int status =
          nativeLibrary.findNearestVillage(
              nativeMinecraftVersion(request.minecraftVersion()),
              request.seed(),
              requirement.center().x(),
              requirement.center().z(),
              requirement.radiusBlocks(),
              result);

      requireSuccessfulStatus(status, request.minecraftVersion());

      return readResult(result);
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

  private Optional<BlockPosition> readResult(Pointer result) {
    int found = result.getInt(RESULT_FOUND_OFFSET);

    return switch (found) {
      case 0 -> Optional.empty();
      case 1 ->
          Optional.of(
              new BlockPosition(result.getInt(RESULT_X_OFFSET), result.getInt(RESULT_Z_OFFSET)));
      default ->
          throw new IllegalStateException(
              "native village locator returned invalid found value: " + found);
    };
  }
}
