package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.sun.jna.Pointer;
import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class CubiomesVillageLocatorTest {

  @Test
  void exposesVillageStructureType() {
    CubiomesVillageLocator locator = new CubiomesVillageLocator(new RecordingNativeLibrary());

    assertEquals(StructureType.VILLAGE, locator.structureType());
  }

  @Test
  void forwardsSearchRequestsAndReturnsVillagePositions() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    nativeLibrary.found = 1;
    nativeLibrary.resultX = 656;
    nativeLibrary.resultZ = -304;

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    Optional<BlockPosition> result = locator.findNearest(villageRequest());

    assertEquals(Optional.of(new BlockPosition(656, -304)), result);
    assertEquals(1, nativeLibrary.minecraftVersion);
    assertEquals(42, nativeLibrary.seed);
    assertEquals(100, nativeLibrary.centerX);
    assertEquals(-200, nativeLibrary.centerZ);
    assertEquals(1_000, nativeLibrary.radiusBlocks);
  }

  @Test
  void returnsEmptyWhenNoVillageIsInsideTheRadius() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    assertEquals(Optional.empty(), locator.findNearest(villageRequest()));
  }

  @Test
  void reportsSearchAreasOutsideMinecraftCoordinates() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    nativeLibrary.status = CubiomesNativeLibrary.STATUS_OUT_OF_RANGE;

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    IllegalArgumentException error =
        assertThrows(IllegalArgumentException.class, () -> locator.findNearest(villageRequest()));

    assertEquals("village search area exceeds supported Minecraft coordinates", error.getMessage());
  }

  @Test
  void rejectsInvalidNativeResultFlags() {
    RecordingNativeLibrary nativeLibrary = new RecordingNativeLibrary();

    nativeLibrary.found = 2;

    CubiomesVillageLocator locator = new CubiomesVillageLocator(nativeLibrary);

    IllegalStateException error =
        assertThrows(IllegalStateException.class, () -> locator.findNearest(villageRequest()));

    assertEquals("native village locator returned invalid found value: 2", error.getMessage());
  }

  private StructureSearchRequest villageRequest() {
    StructureRequirement requirement =
        new StructureRequirement(
            "village-1", StructureType.VILLAGE, new BlockPosition(100, -200), 1_000);

    return new StructureSearchRequest(42, MinecraftVersion.JAVA_1_21, requirement);
  }

  private static final class RecordingNativeLibrary implements CubiomesNativeLibrary {

    private int status = STATUS_OK;
    private int found;
    private int resultX;
    private int resultZ;
    private int minecraftVersion;
    private long seed;
    private long centerX;
    private long centerZ;
    private long radiusBlocks;

    @Override
    public int findNearestVillage(
        int minecraftVersion,
        long seed,
        long centerX,
        long centerZ,
        long radiusBlocks,
        Pointer result) {
      this.minecraftVersion = minecraftVersion;
      this.seed = seed;
      this.centerX = centerX;
      this.centerZ = centerZ;
      this.radiusBlocks = radiusBlocks;

      result.setInt(0, found);
      result.setInt(Integer.BYTES, resultX);
      result.setInt(Integer.BYTES * 2L, resultZ);

      return status;
    }
  }
}
