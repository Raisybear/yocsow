package io.github.raisybear.yocsow.engine.search;

public enum StructureType {
  VILLAGE("village");

  private final String identifier;

  StructureType(String identifier) {
    this.identifier = identifier;
  }

  public String identifier() {
    return identifier;
  }

  public static StructureType fromIdentifier(String identifier) {
    for (StructureType structureType : values()) {
      if (structureType.identifier.equals(identifier)) {
        return structureType;
      }
    }

    throw new IllegalArgumentException("unsupported structure type: " + identifier);
  }
}
