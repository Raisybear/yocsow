package io.github.raisybear.yocsow.runner;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

class JsonRpcServerTest {

  private final ObjectMapper objectMapper = JsonMapper.builder().build();

  @Test
  void reportsHealthBeforeAndAfterInitialization() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":1,"method":"engine.health"}
        {"jsonrpc":"2.0","id":2,"method":"engine.initialize","params":{"protocolVersion":1}}
        {"jsonrpc":"2.0","id":3,"method":"engine.health"}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(3, responses.size());

    assertEquals(1, responses.get(0).get("id").intValue());
    assertEquals("ok", responses.get(0).at("/result/status").stringValue());
    assertFalse(responses.get(0).at("/result/initialized").booleanValue());

    assertEquals(2, responses.get(1).get("id").intValue());
    assertEquals(1, responses.get(1).at("/result/protocolVersion").intValue());
    assertEquals("0.1.0-SNAPSHOT", responses.get(1).at("/result/engineVersion").stringValue());
    assertEquals("engine.health", responses.get(1).at("/result/capabilities/0").stringValue());

    assertEquals(3, responses.get(2).get("id").intValue());
    assertTrue(responses.get(2).at("/result/initialized").booleanValue());
  }

  @Test
  void rejectsUnsupportedProtocolVersions() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":1,"method":"engine.initialize","params":{"protocolVersion":2}}
        {"jsonrpc":"2.0","id":2,"method":"engine.health"}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(2, responses.size());
    assertEquals(-32602, responses.get(0).at("/error/code").intValue());
    assertEquals(
        "Unsupported protocol version", responses.get(0).at("/error/message").stringValue());
    assertFalse(responses.get(1).at("/result/initialized").booleanValue());
  }

  @Test
  void returnsStandardJsonRpcErrors() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":1,"method":"engine.unknown"}
        {"invalid"
        []
        {"jsonrpc":"2.0","id":2,"method":"engine.health","params":"invalid"}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(4, responses.size());

    assertEquals(-32601, responses.get(0).at("/error/code").intValue());
    assertEquals(1, responses.get(0).get("id").intValue());

    assertEquals(-32700, responses.get(1).at("/error/code").intValue());
    assertTrue(responses.get(1).get("id").isNull());

    assertEquals(-32600, responses.get(2).at("/error/code").intValue());
    assertTrue(responses.get(2).get("id").isNull());

    assertEquals(-32602, responses.get(3).at("/error/code").intValue());
    assertEquals(2, responses.get(3).get("id").intValue());
  }

  @Test
  void executesNotificationsWithoutReturningAResponse() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","method":"engine.initialize","params":{"protocolVersion":1}}
        {"jsonrpc":"2.0","id":9,"method":"engine.health"}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(1, responses.size());
    assertEquals(9, responses.getFirst().get("id").intValue());
    assertTrue(responses.getFirst().at("/result/initialized").booleanValue());
  }

  @Test
  void preservesStringRequestIdentifiers() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":"health-check","method":"engine.health"}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(1, responses.size());
    assertEquals("health-check", responses.getFirst().get("id").stringValue());
  }

  private List<JsonNode> serve(String input) throws IOException {
    ByteArrayInputStream requestStream =
        new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8));
    ByteArrayOutputStream responseStream = new ByteArrayOutputStream();

    new JsonRpcServer().serve(requestStream, responseStream);

    List<JsonNode> responses = new ArrayList<>();

    for (String line : responseStream.toString(StandardCharsets.UTF_8).lines().toList()) {
      if (!line.isBlank()) {
        responses.add(objectMapper.readTree(line));
      }
    }

    return responses;
  }
}
