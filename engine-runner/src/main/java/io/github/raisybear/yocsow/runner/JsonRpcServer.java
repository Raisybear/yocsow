package io.github.raisybear.yocsow.runner;

import io.github.raisybear.yocsow.engine.search.seed.SeedSearchService;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocatorRegistry;
import io.github.raisybear.yocsow.engine.search.structure.cubiomes.CubiomesBiomeLocator;
import io.github.raisybear.yocsow.engine.search.structure.cubiomes.CubiomesStructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.cubiomes.CubiomesVillageLocator;
import java.io.BufferedReader;
import java.io.BufferedWriter;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.io.OutputStreamWriter;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Objects;
import java.util.function.Supplier;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;
import tools.jackson.databind.node.ObjectNode;

final class JsonRpcServer {

  private static final String JSON_RPC_VERSION = "2.0";

  private final ObjectMapper objectMapper;
  private final EngineProtocol protocol;

  JsonRpcServer() {
    this(JsonMapper.builder().build(), JsonRpcServer::createSeedSearchService);
  }

  JsonRpcServer(ObjectMapper objectMapper) {
    this(objectMapper, JsonRpcServer::createSeedSearchService);
  }

  JsonRpcServer(ObjectMapper objectMapper, Supplier<SeedSearchService> seedSearchServiceFactory) {
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
    this.protocol =
        new EngineProtocol(
            objectMapper,
            Objects.requireNonNull(seedSearchServiceFactory, "seedSearchServiceFactory"));
  }

  void serve(InputStream input, OutputStream output) throws IOException {
    BufferedReader reader =
        new BufferedReader(new InputStreamReader(input, StandardCharsets.UTF_8));
    BufferedWriter writer =
        new BufferedWriter(new OutputStreamWriter(output, StandardCharsets.UTF_8));

    String line;

    while ((line = reader.readLine()) != null) {
      ObjectNode response = processLine(line);

      if (response != null) {
        writer.write(objectMapper.writeValueAsString(response));
        writer.newLine();
        writer.flush();
      }
    }
  }

  private ObjectNode processLine(String line) {
    try {
      JsonNode request = objectMapper.readTree(line);

      if (request == null) {
        return error(null, -32700, "Parse error");
      }

      return processRequest(request);
    } catch (JacksonException exception) {
      return error(null, -32700, "Parse error");
    }
  }

  private ObjectNode processRequest(JsonNode request) {
    if (!request.isObject()) {
      return error(null, -32600, "Invalid Request");
    }

    JsonNode id = request.get("id");

    if (!isValidId(id)) {
      return error(null, -32600, "Invalid Request");
    }

    JsonNode version = request.get("jsonrpc");
    JsonNode method = request.get("method");

    if (version == null
        || !version.isString()
        || !JSON_RPC_VERSION.equals(version.stringValue())
        || method == null
        || !method.isString()
        || method.stringValue().isBlank()) {
      return error(id, -32600, "Invalid Request");
    }

    boolean notification = id == null;
    JsonNode params = request.get("params");

    if (params != null && !params.isObject() && !params.isArray()) {
      return notification ? null : error(id, -32602, "Invalid params");
    }

    EngineProtocol.Invocation invocation = protocol.invoke(method.stringValue(), params);

    if (notification) {
      return null;
    }

    if (invocation.error() != null) {
      return error(id, invocation.error().code(), invocation.error().message());
    }

    return success(id, invocation.result());
  }

  private boolean isValidId(JsonNode id) {
    return id == null || id.isNull() || id.isString() || id.isNumber();
  }

  private ObjectNode success(JsonNode id, JsonNode result) {
    ObjectNode response = objectMapper.createObjectNode();
    response.put("jsonrpc", JSON_RPC_VERSION);
    response.set("result", result);
    setResponseId(response, id);
    return response;
  }

  private ObjectNode error(JsonNode id, int code, String message) {
    ObjectNode error = objectMapper.createObjectNode();
    error.put("code", code);
    error.put("message", message);

    ObjectNode response = objectMapper.createObjectNode();
    response.put("jsonrpc", JSON_RPC_VERSION);
    response.set("error", error);
    setResponseId(response, id);
    return response;
  }

  private void setResponseId(ObjectNode response, JsonNode id) {
    if (id == null || id.isNull()) {
      response.putNull("id");
    } else {
      response.set("id", id);
    }
  }

  private static SeedSearchService createSeedSearchService() {
    return new SeedSearchService(
        new StructureLocatorRegistry(
            List.of(
                new CubiomesVillageLocator(),
                CubiomesStructureLocator.ruinedPortal(),
                CubiomesBiomeLocator.taiga())));
  }
}
