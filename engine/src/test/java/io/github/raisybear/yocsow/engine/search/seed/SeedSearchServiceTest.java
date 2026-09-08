package io.github.raisybear.yocsow.engine.search.seed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocatorRegistry;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class SeedSearchServiceTest {

  @Test
  void ranksCandidatesByMatchesAndNormalizedDistance() {
    RecordingVillageLocator locator = new RecordingVillageLocator();

    locator.locate(10, "village-1", new BlockPosition(900, 0));
    locator.locate(11, "village-1", new BlockPosition(600, 0));
    locator.locate(11, "village-2", new BlockPosition(0, 800));
    locator.locate(12, "village-1", new BlockPosition(100, 0));

    SeedSearchService service = serviceUsing(locator);

    SeedSearchResult result =
        service.search(
            new SeedSearchRequest(
                10,
                3,
                MinecraftVersion.JAVA_1_21,
                List.of(requirement("village-1"), requirement("village-2")),
                3));

    assertEquals(3, result.searchedSeedCount());
    assertEquals(3, result.candidates().size());

    SeedSearchCandidate first = result.candidates().get(0);
    SeedSearchCandidate second = result.candidates().get(1);
    SeedSearchCandidate third = result.candidates().get(2);

    assertEquals(11, first.seed());
    assertEquals(2, first.matchedRequirementCount());
    assertTrue(first.matchesAllRequirements());

    assertEquals(12, second.seed());
    assertEquals(1, second.matchedRequirementCount());
    assertEquals(0.1, second.averageNormalizedDistance(), 0.000_001);

    assertEquals(10, third.seed());
    assertEquals(1, third.matchedRequirementCount());
    assertEquals(new BlockPosition(900, 0), third.matches().get(0).actualPosition());
  }

  @Test
  void limitsReturnedCandidates() {
    RecordingVillageLocator locator = new RecordingVillageLocator();

    locator.locate(20, "village-1", new BlockPosition(100, 0));
    locator.locate(21, "village-1", new BlockPosition(200, 0));
    locator.locate(22, "village-1", new BlockPosition(300, 0));

    SeedSearchResult result =
        serviceUsing(locator)
            .search(
                new SeedSearchRequest(
                    20, 3, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 2));

    assertEquals(2, result.candidates().size());
    assertEquals(20, result.candidates().get(0).seed());
    assertEquals(21, result.candidates().get(1).seed());
  }

  @Test
  void returnsNoCandidatesWhenNothingMatches() {
    SeedSearchResult result =
        serviceUsing(new RecordingVillageLocator())
            .search(
                new SeedSearchRequest(
                    30, 5, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 5));

    assertEquals(5, result.searchedSeedCount());
    assertTrue(result.candidates().isEmpty());
  }

  @Test
  void rejectsInvalidSearchLimits() {
    assertThrows(
        IllegalArgumentException.class,
        () ->
            new SeedSearchRequest(
                0, 0, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 1));

    assertThrows(
        IllegalArgumentException.class,
        () ->
            new SeedSearchRequest(
                0,
                SeedSearchRequest.MAXIMUM_SEEDS_PER_BATCH + 1,
                MinecraftVersion.JAVA_1_21,
                List.of(requirement("village-1")),
                1));

    assertThrows(
        IllegalArgumentException.class,
        () -> new SeedSearchRequest(0, 1, MinecraftVersion.JAVA_1_21, List.of(), 1));

    assertThrows(
        IllegalArgumentException.class,
        () ->
            new SeedSearchRequest(
                0, 1, MinecraftVersion.JAVA_1_21, List.of(requirement("village-1")), 0));
  }

  @Test
  void rejectsDuplicateRequirementIdentifiers() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                new SeedSearchRequest(
                    0,
                    1,
                    MinecraftVersion.JAVA_1_21,
                    List.of(requirement("village-1"), requirement("village-1")),
                    1));

    assertEquals("duplicate requirement id: village-1", error.getMessage());
  }

  @Test
  void copiesSearchRequirements() {
    List<StructureRequirement> requirements = new ArrayList<>();

    requirements.add(requirement("village-1"));

    SeedSearchRequest request =
        new SeedSearchRequest(0, 1, MinecraftVersion.JAVA_1_21, requirements, 1);

    requirements.clear();

    assertEquals(1, request.requirements().size());

    assertThrows(UnsupportedOperationException.class, () -> request.requirements().clear());
  }

  private SeedSearchService serviceUsing(StructureLocator locator) {
    return new SeedSearchService(new StructureLocatorRegistry(List.of(locator)));
  }

  private StructureRequirement requirement(String id) {
    return new StructureRequirement(id, StructureType.VILLAGE, new BlockPosition(0, 0), 1_000);
  }

  private static final class RecordingVillageLocator implements StructureLocator {

    private final Map<SearchKey, BlockPosition> positions = new HashMap<>();

    void locate(long seed, String requirementId, BlockPosition position) {
      positions.put(new SearchKey(seed, requirementId), position);
    }

    @Override
    public StructureType structureType() {
      return StructureType.VILLAGE;
    }

    @Override
    public Optional<BlockPosition> findNearest(StructureSearchRequest request) {
      return Optional.ofNullable(
          positions.get(new SearchKey(request.seed(), request.requirement().id())));
    }
  }

  private record SearchKey(long seed, String requirementId) {}
}
