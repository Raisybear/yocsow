package io.github.raisybear.yocsow.runner;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

final class EngineProtocol {

  static final int PROTOCOL_VERSION = 1;
  static final String ENGINE_VERSION = "0.1.0-SNAPSHOT";

  private final ObjectMapper objectMapper;
  private boolean initialized;

  EngineProtocol(ObjectMapper objectMapper) {
    this.objectMapper = objectMapper;
  }

  Invocation invoke(String method, JsonNode params) {
    return switch (method) {
      case "engine.initialize" -> initialize(params);
      case "engine.health" -> health(params);
      default -> Invocation.error(-32601, "Method not found");
    };
  }

  private Invocation initialize(JsonNode params) {
    if (params == null || !params.isObject()) {
      return Invocation.error(-32602, "Invalid params");
    }

    JsonNode requestedVersion = params.get("protocolVersion");

    if (requestedVersion == null
        || !requestedVersion.isIntegralNumber()
        || requestedVersion.intValue() != PROTOCOL_VERSION) {
      return Invocation.error(-32602, "Unsupported protocol version");
    }

    initialized = true;

    ObjectNode result = objectMapper.createObjectNode();
    result.put("protocolVersion", PROTOCOL_VERSION);
    result.put("engineVersion", ENGINE_VERSION);
    result.putArray("capabilities").add("engine.health");

    return Invocation.success(result);
  }

  private Invocation health(JsonNode params) {
    if (params != null && ((!params.isObject() && !params.isArray()) || params.size() != 0)) {
      return Invocation.error(-32602, "Invalid params");
    }

    ObjectNode result = objectMapper.createObjectNode();
    result.put("status", "ok");
    result.put("initialized", initialized);
    result.put("protocolVersion", PROTOCOL_VERSION);
    result.put("engineVersion", ENGINE_VERSION);

    return Invocation.success(result);
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
