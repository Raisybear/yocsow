package io.github.raisybear.yocsow.engine.seed;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SeedRangeTest {

  @Test
  void includesBothBoundaries() {
    SeedRange range = new SeedRange(-10, 10);

    assertAll(() -> assertTrue(range.contains(-10)), () -> assertTrue(range.contains(10)));
  }

  @Test
  void excludesValuesOutsideTheRange() {
    SeedRange range = new SeedRange(-10, 10);

    assertAll(() -> assertFalse(range.contains(-11)), () -> assertFalse(range.contains(11)));
  }

  @Test
  void rejectsReversedBoundaries() {
    assertThrows(IllegalArgumentException.class, () -> new SeedRange(10, -10));
  }
}
