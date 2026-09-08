package io.github.raisybear.yocsow.engine.search.structure;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.StructureType;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class StructureLocatorRegistryTest {

  @Test
  void resolvesRegisteredStructureLocators() {
    StructureLocator villageLocator = villageLocatorAt(new BlockPosition(128, -64));

    StructureLocatorRegistry registry = new StructureLocatorRegistry(List.of(villageLocator));

    assertSame(villageLocator, registry.require(StructureType.VILLAGE));
  }

  @Test
  void rejectsDuplicateStructureLocators() {
    StructureLocator firstLocator = villageLocatorAt(new BlockPosition(128, -64));

    StructureLocator secondLocator = villageLocatorAt(new BlockPosition(-256, 320));

    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> new StructureLocatorRegistry(List.of(firstLocator, secondLocator)));

    assertEquals("duplicate locator for structure type: village", error.getMessage());
  }

  @Test
  void rejectsMissingStructureLocators() {
    StructureLocatorRegistry registry = new StructureLocatorRegistry(List.of());

    IllegalArgumentException error =
        assertThrows(IllegalArgumentException.class, () -> registry.require(StructureType.VILLAGE));

    assertEquals("no locator registered for structure type: village", error.getMessage());
  }

  @Test
  void rejectsNullStructureLocators() {
    List<StructureLocator> locators = new ArrayList<>();

    locators.add(null);

    NullPointerException error =
        assertThrows(NullPointerException.class, () -> new StructureLocatorRegistry(locators));

    assertEquals("locator", error.getMessage());
  }

  private StructureLocator villageLocatorAt(BlockPosition position) {
    return new StructureLocator() {
      @Override
      public StructureType structureType() {
        return StructureType.VILLAGE;
      }

      @Override
      public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
        return Optional.of(position);
      }
    };
  }
}
