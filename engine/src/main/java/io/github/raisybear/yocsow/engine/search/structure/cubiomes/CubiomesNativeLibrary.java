package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import com.sun.jna.FunctionMapper;
import com.sun.jna.Library;
import com.sun.jna.Native;
import com.sun.jna.Pointer;
import java.util.Map;

interface CubiomesNativeLibrary extends Library {

  int STATUS_OK = 0;
  int STATUS_INVALID_ARGUMENT = 1;
  int STATUS_UNSUPPORTED_VERSION = 2;
  int STATUS_OUT_OF_RANGE = 3;

  static CubiomesNativeLibrary load() {
    FunctionMapper functionMapper =
        (nativeLibrary, method) ->
            switch (method.getName()) {
              case "findNearestVillage" -> "yocsow_find_nearest_village";
              default -> method.getName();
            };

    return Native.load(
        "yocsow_cubiomes",
        CubiomesNativeLibrary.class,
        Map.of(Library.OPTION_FUNCTION_MAPPER, functionMapper));
  }

  int findNearestVillage(
      int minecraftVersion,
      long seed,
      long centerX,
      long centerZ,
      long radiusBlocks,
      Pointer result);
}
