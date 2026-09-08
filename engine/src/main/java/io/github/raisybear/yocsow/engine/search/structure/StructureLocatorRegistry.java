package io.github.raisybear.yocsow.engine.search.structure;

import io.github.raisybear.yocsow.engine.search.StructureType;
import java.util.Collection;
import java.util.EnumMap;
import java.util.Map;
import java.util.Objects;

public final class StructureLocatorRegistry {

  private final Map<StructureType, StructureLocator> locatorsByType;

  public StructureLocatorRegistry(Collection<? extends StructureLocator> locators) {
    Objects.requireNonNull(locators, "locators");

    EnumMap<StructureType, StructureLocator> registeredLocators =
        new EnumMap<>(StructureType.class);

    for (StructureLocator locator : locators) {
      StructureLocator nonNullLocator = Objects.requireNonNull(locator, "locator");

      StructureType structureType =
          Objects.requireNonNull(nonNullLocator.structureType(), "locator.structureType");

      StructureLocator existingLocator =
          registeredLocators.putIfAbsent(structureType, nonNullLocator);

      if (existingLocator != null) {
        throw new IllegalArgumentException(
            "duplicate locator for structure type: " + structureType.identifier());
      }
    }

    locatorsByType = Map.copyOf(registeredLocators);
  }

  public StructureLocator require(StructureType structureType) {
    Objects.requireNonNull(structureType, "structureType");

    StructureLocator locator = locatorsByType.get(structureType);

    if (locator == null) {
      throw new IllegalArgumentException(
          "no locator registered for structure type: " + structureType.identifier());
    }

    return locator;
  }
}
