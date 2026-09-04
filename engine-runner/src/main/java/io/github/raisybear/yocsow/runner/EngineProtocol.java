package io.github.raisybear.yocsow.runner;

import io.github.raisybear.yocsow.engine.seed.SeedRange;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

final class EngineProtocol {

  static final int PROTOCOL_VERSION = 1;
  static final String ENGINE_VERSION = "0.1.0-SNAPSHOT";

  private static final int INVALID_PARAMS = -32602;
  private static final int ENGINE_NOT_INITIALIZED = -32002;

  private final ObjectMapper objectMapper;
  private boolean initialized;

  EngineProtocol(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  Invocation invoke(String method, JsonNode params) {
    return switch (method) {
      case "engine.initialize" -> initialize(params);
      case "engine.health" -> health(params);
      case "seed.range.contains" -> seedRangeContains(params);
      default -> Invocation.error(-32601, "Method not found");
    };
  }

  private Invocation initialize(JsonNode params) {
    if (params == null || !params.isObject()) {
      return Invocation.error(INVALID_PARAMS, "Invalid params");
    }

    JsonNode requestedVersion = params.get("protocolVersion");

    if (requestedVersion == null
        || !requestedVersion.isIntegralNumber()
        || requestedVersion.intValue() != PROTOCOL_VERSION) {
      return Invocation.error(INVALID_PARAMS, "Unsupported protocol version");
    }

    initialized = true;

    ObjectNode result = objectMapper.createObjectNode();
    result.put("protocolVersion", PROTOCOL_VERSION);
    result.put("engineVersion", ENGINE_VERSION);
    result.putArray("capabilities").add("engine.health").add("seed.range.contains");

    return Invocation.success(result);
  }

  private Invocation health(JsonNode params) {
    if (params != null && ((!params.isObject() && !params.isArray()) || params.size() != 0)) {
      return Invocation.error(INVALID_PARAMS, "Invalid params");
    }

    ObjectNode result = objectMapper.createObjectNode();
    result.put("status", "ok");
    result.put("initialized", initialized);
    result.put("protocolVersion", PROTOCOL_VERSION);
    result.put("engineVersion", ENGINE_VERSION);

    return Invocation.success(result);
  }

  private Invocation seedRangeContains(JsonNode params) {
    if (!initialized) {
      return Invocation.error(ENGINE_NOT_INITIALIZED, "Engine not initialized");
    }

    if (params == null || !params.isObject() || params.size() != 3) {
      return Invocation.error(INVALID_PARAMS, "Invalid params");
    }

    Long minimum = readLong(params.get("minimum"));
    Long maximum = readLong(params.get("maximum"));
    Long seed = readLong(params.get("seed"));

    if (minimum == null || maximum == null || seed == null) {
      return Invocation.error(INVALID_PARAMS, "Invalid params");
    }

    SeedRange range;

    try {
      range = new SeedRange(minimum, maximum);
    } catch (IllegalArgumentException exception) {
      return Invocation.error(INVALID_PARAMS, exception.getMessage());
    }

    ObjectNode result = objectMapper.createObjectNode();
    result.put("contains", range.contains(seed));

    return Invocation.success(result);
  }

  private Long readLong(JsonNode value) {
    if (value == null || !value.isIntegralNumber()) {
      return null;
    }

    try {
      return Long.valueOf(value.toString());
    } catch (NumberFormatException exception) {
      return null;
    }
  }

  record Invocation(JsonNode result, ProtocolError error) {

    static Invocation success(JsonNode result) {
      return new Invocation(result, null);
    }

    static Invocation error(int code, String message) {
      return new Invocation(null, new ProtocolError(code, message));
    }
  }

  record ProtocolError(int code, String message) {}
}
