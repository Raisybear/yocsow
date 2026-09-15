package io.github.raisybear.yocsow.engine.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class StructureRequirementTest {

  @Test
  void createsVillageRequirementAroundCoordinates() {
    BlockPosition center = new BlockPosition(120, -340);

    StructureRequirement requirement =
        new StructureRequirement("village-1", StructureType.VILLAGE, center, 1_000);

    assertEquals("village-1", requirement.id());
    assertEquals(StructureType.VILLAGE, requirement.structureType());
    assertEquals(center, requirement.center());
    assertEquals(1_000, requirement.radiusBlocks());
  }

  @Test
  void trimsRequirementIdentifiers() {
    StructureRequirement requirement =
        new StructureRequirement(
            "  village-1  ", StructureType.VILLAGE, new BlockPosition(0, 0), 500);

    assertEquals("village-1", requirement.id());
  }

  @Test
  void rejectsBlankRequirementIdentifiers() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new StructureRequirement(
                    "   ", StructureType.VILLAGE, new BlockPosition(0, 0), 500));

    assertEquals("id must not be blank", error.getMessage());
  }

  @Test
  void rejectsNonPositiveRadii() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new StructureRequirement(
                    "village-1", StructureType.VILLAGE, new BlockPosition(0, 0), 0));

    assertEquals("radiusBlocks must be greater than zero", error.getMessage());
  }

  @Test
  void resolvesStructureTypesByStableIdentifier() {
    assertEquals(StructureType.VILLAGE, StructureType.fromIdentifier("village"));
    assertEquals(StructureType.TAIGA, StructureType.fromIdentifier("taiga"));
    assertTrue(StructureType.VILLAGE.requiresDistinctPosition());
    assertFalse(StructureType.TAIGA.requiresDistinctPosition());
  }

  @Test
  void rejectsUnsupportedStructureTypes() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class, () -> StructureType.fromIdentifier("desert-temple"));

    assertEquals("unsupported structure type: desert-temple", error.getMessage());
  }
}
