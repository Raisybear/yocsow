package io.github.raisybear.yocsow.engine.search;

public enum MinecraftVersion {
  JAVA_1_21("1.21");

  private final String identifier;

  MinecraftVersion(String identifier) {
    this.identifier = identifier;
  }

  public String identifier() {
    return identifier;
  }

  public static MinecraftVersion fromIdentifier(String identifier) {
    for (MinecraftVersion minecraftVersion : values()) {
      if (minecraftVersion.identifier.equals(identifier)) {
        return minecraftVersion;
      }
    }

    throw new IllegalArgumentException("unsupported Minecraft version: " + identifier);
  }
}
