package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import com.sun.jna.FunctionMapper;
import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Pointer;
import java.util.Map;

interface CubiomesStructureNativeLibrary extends Library {

  int STATUS_OK = 0;
  int STATUS_INVALID_ARGUMENT = 1;
  int STATUS_UNSUPPORTED_VERSION = 2;
  int STATUS_OUT_OF_RANGE = 3;
  int STATUS_BUFFER_TOO_SMALL = 4;

  static CubiomesStructureNativeLibrary load() {
    FunctionMapper functionMapper =
        (nativeLibrary, method) ->
            switch (method.getName()) {
              case "findStructures" -> "yocsow_find_structures";
              case "findStructuresBatch" -> "yocsow_find_structures_batch";
              default -> method.getName();
            };

    return Native.load(
        "yocsow_cubiomes",
        CubiomesStructureNativeLibrary.class,
        Map.of(Library.OPTION_FUNCTION_MAPPER, functionMapper));
  }

  int findStructures(
      int minecraftVersion,
      int structure,
      long seed,
      long centerX,
      long centerZ,
      long radiusBlocks,
      int resultCapacity,
      Pointer resultCount,
      Pointer results);

  int findStructuresBatch(
      int minecraftVersion,
      int structure,
      long firstSeed,
      int seedCount,
      Pointer searchAreas,
      int searchAreaCount,
      int resultCapacity,
      long resultCountCapacity,
      Pointer resultCounts,
      long resultPositionCapacity,
      Pointer results);
}
