package io.github.raisybear.yocsow.runner;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchService;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocatorRegistry;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
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
    assertEquals(
        "seed.range.contains", responses.get(1).at("/result/capabilities/1").stringValue());
    assertEquals("seed.search", responses.get(1).at("/result/capabilities/2").stringValue());

    assertEquals(3, responses.get(2).get("id").intValue());
    assertTrue(responses.get(2).at("/result/initialized").booleanValue());
  }

  @Test
  void checksWhetherSeedsAreWithinAnInclusiveRange() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":1,"method":"engine.initialize","params":{"protocolVersion":1}}
        {"jsonrpc":"2.0","id":2,"method":"seed.range.contains","params":{"minimum":-10,"maximum":10,"seed":-10}}
        {"jsonrpc":"2.0","id":3,"method":"seed.range.contains","params":{"minimum":-10,"maximum":10,"seed":0}}
        {"jsonrpc":"2.0","id":4,"method":"seed.range.contains","params":{"minimum":-10,"maximum":10,"seed":10}}
        {"jsonrpc":"2.0","id":5,"method":"seed.range.contains","params":{"minimum":-10,"maximum":10,"seed":11}}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(5, responses.size());
    assertTrue(responses.get(1).at("/result/contains").booleanValue());
    assertTrue(responses.get(2).at("/result/contains").booleanValue());
    assertTrue(responses.get(3).at("/result/contains").booleanValue());
    assertFalse(responses.get(4).at("/result/contains").booleanValue());
  }

  @Test
  void searchesSeedsAndReturnsRankedVillageMatches() throws IOException {
    RecordingVillageLocator locator = new RecordingVillageLocator();

    locator.locate(10, new BlockPosition(900, 0));
    locator.locate(11, new BlockPosition(600, 0));
    locator.locate(11, new BlockPosition(0, 800));
    locator.locate(12, new BlockPosition(100, 0));

    String input =
        """
        {"jsonrpc":"2.0","id":1,"method":"engine.initialize","params":{"protocolVersion":1}}
        {"jsonrpc":"2.0","id":2,"method":"seed.search","params":{"firstSeed":10,"seedCount":3,"minecraftVersion":"1.21","requirements":[{"id":"village-1","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000},{"id":"village-2","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000}],"resultLimit":3}}
        """;

    List<JsonNode> responses = serve(input, serviceUsing(locator));

    assertEquals(2, responses.size());

    JsonNode result = responses.get(1).get("result");

    assertEquals(3, result.get("searchedSeedCount").intValue());
    assertEquals(3, result.get("candidates").size());

    JsonNode first = result.at("/candidates/0");
    JsonNode second = result.at("/candidates/1");
    JsonNode third = result.at("/candidates/2");

    assertEquals(11, first.get("seed").longValue());
    assertEquals(2, first.get("matchedRequirementCount").intValue());
    assertTrue(first.get("matchesAllRequirements").booleanValue());
    assertEquals("village", first.at("/matches/0/structureType").stringValue());
    assertEquals(800, first.at("/matches/0/actualPosition/z").longValue());
    assertEquals(600, first.at("/matches/1/actualPosition/x").longValue());

    assertEquals(12, second.get("seed").longValue());
    assertEquals(0.1, second.get("averageNormalizedDistance").doubleValue(), 0.000_001);

    assertEquals(10, third.get("seed").longValue());
    assertEquals(900, third.at("/matches/0/actualPosition/x").longValue());
  }

  @Test
  void searchesSeedsAndReturnsRuinedPortalMatches() throws IOException {
    RecordingStructureLocator locator = new RecordingStructureLocator(StructureType.RUINED_PORTAL);
    locator.locate(42, new BlockPosition(-608, 944));

    String input =
        """
        {"jsonrpc":"2.0","id":1,"method":"engine.initialize","params":{"protocolVersion":1}}
        {"jsonrpc":"2.0","id":2,"method":"seed.search","params":{"firstSeed":42,"seedCount":1,"minecraftVersion":"1.21","requirements":[{"id":"portal-1","structureType":"ruinedPortal","center":{"x":0,"z":0},"radiusBlocks":2000}],"resultLimit":1}}
        """;

    List<JsonNode> responses = serve(input, serviceUsing(locator));
    JsonNode match = responses.get(1).at("/result/candidates/0/matches/0");

    assertEquals("ruinedPortal", match.get("structureType").stringValue());
    assertEquals(-608, match.at("/actualPosition/x").longValue());
    assertEquals(944, match.at("/actualPosition/z").longValue());
  }

  @Test
  void requiresInitializationBeforeSeedQueries() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":1,"method":"seed.range.contains","params":{"minimum":0,"maximum":10,"seed":5}}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(1, responses.size());
    assertEquals(-32002, responses.getFirst().at("/error/code").intValue());
    assertEquals("Engine not initialized", responses.getFirst().at("/error/message").stringValue());
  }

  @Test
  void requiresInitializationBeforeSeedSearch() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":1,"method":"seed.search","params":{"firstSeed":0,"seedCount":1,"minecraftVersion":"1.21","requirements":[{"id":"village-1","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000}],"resultLimit":1}}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(1, responses.size());
    assertEquals(-32002, responses.getFirst().at("/error/code").intValue());
  }

  @Test
  void rejectsInvalidSeedRangeParameters() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":0,"method":"engine.initialize","params":{"protocolVersion":1}}
        {"jsonrpc":"2.0","id":1,"method":"seed.range.contains"}
        {"jsonrpc":"2.0","id":2,"method":"seed.range.contains","params":{"minimum":0,"maximum":10}}
        {"jsonrpc":"2.0","id":3,"method":"seed.range.contains","params":{"minimum":0,"maximum":10,"seed":"5"}}
        {"jsonrpc":"2.0","id":4,"method":"seed.range.contains","params":{"minimum":0,"maximum":10,"seed":5,"extra":true}}
        {"jsonrpc":"2.0","id":5,"method":"seed.range.contains","params":{"minimum":10,"maximum":0,"seed":5}}
        {"jsonrpc":"2.0","id":6,"method":"seed.range.contains","params":{"minimum":0,"maximum":10,"seed":9223372036854775808}}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(7, responses.size());

    for (int index = 1; index < responses.size(); index++) {
      assertEquals(index, responses.get(index).get("id").intValue());
      assertEquals(-32602, responses.get(index).at("/error/code").intValue());
    }

    assertEquals(
        "minimum must not be greater than maximum",
        responses.get(5).at("/error/message").stringValue());
  }

  @Test
  void rejectsInvalidSeedSearchParameters() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":0,"method":"engine.initialize","params":{"protocolVersion":1}}
        {"jsonrpc":"2.0","id":1,"method":"seed.search"}
        {"jsonrpc":"2.0","id":2,"method":"seed.search","params":{"firstSeed":0,"seedCount":1,"minecraftVersion":"1.21","requirements":[]}}
        {"jsonrpc":"2.0","id":3,"method":"seed.search","params":{"firstSeed":0,"seedCount":"1","minecraftVersion":"1.21","requirements":[{"id":"village-1","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000}],"resultLimit":1}}
        {"jsonrpc":"2.0","id":4,"method":"seed.search","params":{"firstSeed":0,"seedCount":1,"minecraftVersion":"1.20","requirements":[{"id":"village-1","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000}],"resultLimit":1}}
        {"jsonrpc":"2.0","id":5,"method":"seed.search","params":{"firstSeed":0,"seedCount":1,"minecraftVersion":"1.21","requirements":[{"id":"village-1","structureType":"bastion","center":{"x":0,"z":0},"radiusBlocks":1000}],"resultLimit":1}}
        {"jsonrpc":"2.0","id":6,"method":"seed.search","params":{"firstSeed":0,"seedCount":1,"minecraftVersion":"1.21","requirements":[{"id":"village-1","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000}],"resultLimit":1,"extra":true}}
        {"jsonrpc":"2.0","id":7,"method":"seed.search","params":{"firstSeed":0,"seedCount":1,"minecraftVersion":"1.21","requirements":[{"id":"village-1","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000},{"id":"village-1","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000}],"resultLimit":1}}
        {"jsonrpc":"2.0","id":8,"method":"seed.search","params":{"firstSeed":9223372036854775807,"seedCount":2,"minecraftVersion":"1.21","requirements":[{"id":"village-1","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000}],"resultLimit":1}}
        """;

    List<JsonNode> responses = serve(input);

    assertEquals(9, responses.size());

    for (int index = 1; index < responses.size(); index++) {
      assertEquals(index, responses.get(index).get("id").intValue());
      assertEquals(-32602, responses.get(index).at("/error/code").intValue());
    }

    assertEquals(
        "unsupported Minecraft version: 1.20", responses.get(4).at("/error/message").stringValue());
    assertEquals(
        "unsupported structure type: bastion", responses.get(5).at("/error/message").stringValue());
    assertEquals(
        "duplicate requirement id: village-1", responses.get(7).at("/error/message").stringValue());
    assertEquals(
        "seed batch must not exceed the signed 64-bit range",
        responses.get(8).at("/error/message").stringValue());
  }

  @Test
  void returnsEngineFailureWithoutStoppingServer() throws IOException {
    String input =
        """
        {"jsonrpc":"2.0","id":1,"method":"engine.initialize","params":{"protocolVersion":1}}
        {"jsonrpc":"2.0","id":2,"method":"seed.search","params":{"firstSeed":0,"seedCount":1,"minecraftVersion":"1.21","requirements":[{"id":"village-1","structureType":"village","center":{"x":0,"z":0},"radiusBlocks":1000}],"resultLimit":1}}
        {"jsonrpc":"2.0","id":3,"method":"engine.health"}
        """;

    List<JsonNode> responses =
        serve(
            input,
            () -> {
              throw new UnsatisfiedLinkError("missing test library");
            });

    assertEquals(3, responses.size());
    assertEquals(-32000, responses.get(1).at("/error/code").intValue());
    assertEquals("Seed search failed", responses.get(1).at("/error/message").stringValue());
    assertEquals("ok", responses.get(2).at("/result/status").stringValue());
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
    return serve(input, serviceUsing(new RecordingVillageLocator()));
  }

  private List<JsonNode> serve(String input, SeedSearchService seedSearchService)
      throws IOException {
    return serve(input, () -> seedSearchService);
  }

  private List<JsonNode> serve(String input, Supplier<SeedSearchService> seedSearchServiceFactory)
      throws IOException {
    ByteArrayInputStream requestStream =
        new ByteArrayInputStream(input.getBytes(StandardCharsets.UTF_8));
    ByteArrayOutputStream responseStream = new ByteArrayOutputStream();

    new JsonRpcServer(objectMapper, seedSearchServiceFactory).serve(requestStream, responseStream);

    List<JsonNode> responses = new ArrayList<>();

    for (String line : responseStream.toString(StandardCharsets.UTF_8).lines().toList()) {
      if (!line.isBlank()) {
        responses.add(objectMapper.readTree(line));
      }
    }

    return responses;
  }

  private SeedSearchService serviceUsing(StructureLocator locator) {
    return new SeedSearchService(new StructureLocatorRegistry(List.of(locator)));
  }

  private static final class RecordingVillageLocator implements StructureLocator {

    private final Map<SearchKey, List<BlockPosition>> positions = new HashMap<>();

    void locate(long seed, BlockPosition position) {
      positions
          .computeIfAbsent(
              new SearchKey(seed, new BlockPosition(0, 0), 1_000), ignored -> new ArrayList<>())
          .add(position);
    }

    @Override
    public StructureType structureType() {
      return StructureType.VILLAGE;
    }

    @Override
    public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
      return findNearestCandidates(request, 1).stream().findFirst();
    }

    @Override
    public List<BlockPosition> findNearestCandidates(StructureSearchRequest request, int limit) {
      return positions
          .getOrDefault(
              new SearchKey(
                  request.seed(),
                  request.requirement().center(),
                  request.requirement().radiusBlocks()),
              List.of())
          .stream()
          .limit(limit)
          .toList();
    }
  }

  private static final class RecordingStructureLocator implements StructureLocator {

    private final StructureType structureType;
    private final Map<Long, BlockPosition> positions = new HashMap<>();

    private RecordingStructureLocator(StructureType structureType) {
      this.structureType = structureType;
    }

    void locate(long seed, BlockPosition position) {
      positions.put(seed, position);
    }

    @Override
    public StructureType structureType() {
      return structureType;
    }

    @Override
    public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
      return Optional.ofNullable(positions.get(request.seed()));
    }
  }

  private record SearchKey(long seed, BlockPosition center, long radiusBlocks) {}
}
