package io.github.raisybear.yocsow.engine.search;

public enum StructureType {
  VILLAGE("village", true),
  RUINED_PORTAL("ruinedPortal", true),
  TAIGA("taiga", false);

  private final String identifier;
  private final boolean requiresDistinctPosition;

  StructureType(String identifier, boolean requiresDistinctPosition) {
    this.identifier = identifier;
    this.requiresDistinctPosition = requiresDistinctPosition;
  }

  public String identifier() {
    return identifier;
  }

  public boolean requiresDistinctPosition() {
    return requiresDistinctPosition;
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
