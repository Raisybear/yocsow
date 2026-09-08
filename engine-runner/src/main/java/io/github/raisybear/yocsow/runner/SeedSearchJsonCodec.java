package io.github.raisybear.yocsow.runner;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchCandidate;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchRequest;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchResult;
import io.github.raisybear.yocsow.engine.search.seed.StructureMatch;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ArrayNode;
import tools.jackson.databind.node.ObjectNode;

final class SeedSearchJsonCodec {

  private static final String INVALID_PARAMS = "Invalid params";

  private final ObjectMapper objectMapper;

  SeedSearchJsonCodec(ObjectMapper objectMapper) {
    this.objectMapper = Objects.requireNonNull(objectMapper, "objectMapper");
  }

  SeedSearchRequest readRequest(JsonNode params) {
    if (params == null || !params.isObject() || params.size() != 5) {
      throw invalidParams();
    }

    Long firstSeed = readLong(params.get("firstSeed"));
    Integer seedCount = readInteger(params.get("seedCount"));
    String minecraftVersion = readString(params.get("minecraftVersion"));
    JsonNode requirementsNode = params.get("requirements");
    Integer resultLimit = readInteger(params.get("resultLimit"));

    if (firstSeed == null
        || seedCount == null
        || minecraftVersion == null
        || requirementsNode == null
        || !requirementsNode.isArray()
        || resultLimit == null) {
      throw invalidParams();
    }

    List<StructureRequirement> requirements = readRequirements(requirementsNode);

    return new SeedSearchRequest(
        firstSeed,
        seedCount,
        MinecraftVersion.fromIdentifier(minecraftVersion),
        requirements,
        resultLimit);
  }

  ObjectNode writeResult(SeedSearchResult searchResult) {
    Objects.requireNonNull(searchResult, "searchResult");

    ObjectNode result = objectMapper.createObjectNode();
    result.put("searchedSeedCount", searchResult.searchedSeedCount());

    ArrayNode candidatesNode = result.putArray("candidates");

    for (SeedSearchCandidate candidate : searchResult.candidates()) {
      candidatesNode.add(writeCandidate(candidate));
    }

    return result;
  }

  private List<StructureRequirement> readRequirements(JsonNode requirementsNode) {
    if (requirementsNode.size() > SeedSearchRequest.MAXIMUM_REQUIREMENTS) {
      throw new IllegalArgumentException(
          "requirements must not contain more than "
              + SeedSearchRequest.MAXIMUM_REQUIREMENTS
              + " entries");
    }

    List<StructureRequirement> requirements = new ArrayList<>(requirementsNode.size());

    for (JsonNode requirementNode : requirementsNode) {
      requirements.add(readRequirement(requirementNode));
    }

    return requirements;
  }

  private StructureRequirement readRequirement(JsonNode requirementNode) {
    if (requirementNode == null || !requirementNode.isObject() || requirementNode.size() != 4) {
      throw invalidParams();
    }

    String id = readString(requirementNode.get("id"));
    String structureType = readString(requirementNode.get("structureType"));
    JsonNode centerNode = requirementNode.get("center");
    Long radiusBlocks = readLong(requirementNode.get("radiusBlocks"));

    if (id == null
        || structureType == null
        || centerNode == null
        || !centerNode.isObject()
        || centerNode.size() != 2
        || radiusBlocks == null) {
      throw invalidParams();
    }

    Long centerX = readLong(centerNode.get("x"));
    Long centerZ = readLong(centerNode.get("z"));

    if (centerX == null || centerZ == null) {
      throw invalidParams();
    }

    return new StructureRequirement(
        id,
        StructureType.fromIdentifier(structureType),
        new BlockPosition(centerX, centerZ),
        radiusBlocks);
  }

  private ObjectNode writeCandidate(SeedSearchCandidate candidate) {
    ObjectNode candidateNode = objectMapper.createObjectNode();

    candidateNode.put("seed", candidate.seed());
    candidateNode.put("totalRequirementCount", candidate.totalRequirementCount());
    candidateNode.put("matchedRequirementCount", candidate.matchedRequirementCount());
    candidateNode.put("matchesAllRequirements", candidate.matchesAllRequirements());
    candidateNode.put("matchRatio", candidate.matchRatio());
    candidateNode.put("averageNormalizedDistance", candidate.averageNormalizedDistance());

    ArrayNode matchesNode = candidateNode.putArray("matches");

    for (StructureMatch match : candidate.matches()) {
      matchesNode.add(writeMatch(match));
    }

    return candidateNode;
  }

  private ObjectNode writeMatch(StructureMatch match) {
    ObjectNode matchNode = objectMapper.createObjectNode();

    matchNode.put("requirementId", match.requirementId());
    matchNode.put("structureType", match.structureType().identifier());

    writePosition(matchNode, "targetCenter", match.targetCenter());

    matchNode.put("radiusBlocks", match.radiusBlocks());

    writePosition(matchNode, "actualPosition", match.actualPosition());

    matchNode.put("distanceBlocks", match.distanceBlocks());
    matchNode.put("normalizedDistance", match.normalizedDistance());

    return matchNode;
  }

  private void writePosition(ObjectNode parent, String fieldName, BlockPosition position) {
    ObjectNode positionNode = parent.putObject(fieldName);
    positionNode.put("x", position.x());
    positionNode.put("z", position.z());
  }

  private String readString(JsonNode value) {
    if (value == null || !value.isString()) {
      return null;
    }

    return value.stringValue();
  }

  private Integer readInteger(JsonNode value) {
    Long longValue = readLong(value);

    if (longValue == null || longValue < Integer.MIN_VALUE || longValue > Integer.MAX_VALUE) {
      return null;
    }

    return longValue.intValue();
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

  private IllegalArgumentException invalidParams() {
    return new IllegalArgumentException(INVALID_PARAMS);
  }
}
