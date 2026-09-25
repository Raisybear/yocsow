package io.github.raisybear.yocsow.engine.search;

import java.util.Objects;
import java.util.regex.Pattern;

public record MinecraftVersion(String identifier) {

  private static final Pattern RELEASE_IDENTIFIER = Pattern.compile("\\d+(?:\\.\\d+)+");

  public static final MinecraftVersion JAVA_1_21 = new MinecraftVersion("1.21");

  public MinecraftVersion {
    Objects.requireNonNull(identifier, "identifier");

    if (!RELEASE_IDENTIFIER.matcher(identifier).matches()) {
      throw new IllegalArgumentException("invalid Minecraft Java release: " + identifier);
    }
  }

  public static MinecraftVersion fromIdentifier(String identifier) {
    return new MinecraftVersion(identifier);
  }
}
