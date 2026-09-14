package io.github.raisybear.yocsow.engine.search.structure.cubiomes;

import com.sun.jna.Memory;
import com.sun.jna.Pointer;
import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchCandidate;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchKernel;
import io.github.raisybear.yocsow.engine.search.seed.SeedSearchRequest;
import io.github.raisybear.yocsow.engine.search.seed.StructureMatch;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocator;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchBatchRequest;
import io.github.raisybear.yocsow.engine.search.structure.StructureSearchRequest;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

public final class CubiomesVillageLocator implements StructureLocator, SeedSearchKernel {

  private static final int NATIVE_JAVA_1_21 = 1;
  private static final int MAXIMUM_BATCH_SEEDS = 10_000;
  private static final int MAXIMUM_SEARCH_AREAS = 32;
  private static final int MAXIMUM_RESULTS = 64;
  private static final long SEARCH_AREA_CENTER_X_OFFSET = 0;
  private static final long SEARCH_AREA_CENTER_Z_OFFSET = Long.BYTES;
  private static final long SEARCH_AREA_RADIUS_OFFSET = Long.BYTES * 2L;
  private static final long SEARCH_AREA_SIZE = Long.BYTES * 3L;
  private static final long POSITION_X_OFFSET = 0;
  private static final long POSITION_Z_OFFSET = Integer.BYTES;
  private static final long POSITION_SIZE = Integer.BYTES * 2L;
  private static final long SEED_CANDIDATE_SEED_OFFSET = 0;
  private static final long SEED_CANDIDATE_MATCH_COUNT_OFFSET = Long.BYTES;
  private static final long SEED_CANDIDATE_RESERVED_OFFSET = Long.BYTES + Integer.BYTES;
  private static final long SEED_CANDIDATE_SIZE = Long.BYTES + Integer.BYTES * 2L;
  private static final long SEED_MATCH_FOUND_OFFSET = 0;
  private static final long SEED_MATCH_X_OFFSET = Integer.BYTES;
  private static final long SEED_MATCH_Z_OFFSET = Integer.BYTES * 2L;
  private static final long SEED_MATCH_SIZE = Integer.BYTES * 3L;

  private final CubiomesNativeLibrary nativeLibrary;

  public CubiomesVillageLocator() {
    this(CubiomesNativeLibrary.load());
  }

  CubiomesVillageLocator(CubiomesNativeLibrary nativeLibrary) {
    this.nativeLibrary = Objects.requireNonNull(nativeLibrary, "nativeLibrary");
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
    Objects.requireNonNull(request, "request");
    validateLimit(limit);

    StructureRequirement requirement = requireVillageRequirement(request.requirement());

    try (Memory resultCount = new Memory(Integer.BYTES);
        Memory results = new Memory(POSITION_SIZE * limit)) {
      resultCount.clear();
      results.clear();

      int status =
          nativeLibrary.findVillages(
              nativeMinecraftVersion(request.minecraftVersion()),
              request.seed(),
              requirement.center().x(),
              requirement.center().z(),
              requirement.radiusBlocks(),
              limit,
              resultCount,
              results);

      requireSuccessfulStatus(status, request.minecraftVersion());

      return readResults(resultCount, results, limit);
    }
  }

  @Override
  public List<List<BlockPosition>> findNearestCandidatesBatch(
      StructureSearchBatchRequest request, int limit) {
    Objects.requireNonNull(request, "request");
    validateLimit(limit);

    if (request.seedCount() > MAXIMUM_BATCH_SEEDS) {
      throw new IllegalArgumentException(
          "village batch must not contain more than " + MAXIMUM_BATCH_SEEDS + " seeds");
    }

    if (request.requirements().size() > MAXIMUM_SEARCH_AREAS) {
      throw new IllegalArgumentException(
          "village batch must not contain more than " + MAXIMUM_SEARCH_AREAS + " search areas");
    }

    List<StructureRequirement> requirements =
        request.requirements().stream().map(this::requireVillageRequirement).toList();

    int resultCountCapacity = Math.multiplyExact(request.seedCount(), requirements.size());
    long resultPositionCapacity = Math.multiplyExact((long) resultCountCapacity, limit);

    try (Memory searchAreas =
            new Memory(Math.multiplyExact(SEARCH_AREA_SIZE, requirements.size()));
        Memory resultCounts =
            new Memory(Math.multiplyExact((long) Integer.BYTES, resultCountCapacity));
        Memory results = new Memory(Math.multiplyExact(POSITION_SIZE, resultPositionCapacity))) {
      writeSearchAreas(searchAreas, requirements);

      int status =
          nativeLibrary.findVillagesBatch(
              nativeMinecraftVersion(request.minecraftVersion()),
              request.firstSeed(),
              request.seedCount(),
              searchAreas,
              requirements.size(),
              limit,
              resultCountCapacity,
              resultCounts,
              resultPositionCapacity,
              results);

      requireSuccessfulStatus(status, request.minecraftVersion());

      List<List<BlockPosition>> candidates = new ArrayList<>(resultCountCapacity);

      for (int resultIndex = 0; resultIndex < resultCountCapacity; resultIndex++) {
        int count = resultCounts.getInt((long) resultIndex * Integer.BYTES);
        long positionOffset = (long) resultIndex * limit * POSITION_SIZE;

        candidates.add(readResults(count, results, positionOffset, limit));
      }

      return List.copyOf(candidates);
    }
  }

  @Override
  public List<SeedSearchCandidate> searchSeeds(SeedSearchRequest request) {
    Objects.requireNonNull(request, "request");

    List<StructureRequirement> requirements =
        request.requirements().stream().map(this::requireVillageRequirement).toList();

    Map<VillageSearchArea, Integer> searchAreaIndexes = new LinkedHashMap<>();
    int[] requirementSearchAreaIndexes = new int[requirements.size()];

    for (int index = 0; index < requirements.size(); index++) {
      VillageSearchArea searchArea = VillageSearchArea.from(requirements.get(index));
      int searchAreaIndex =
          searchAreaIndexes.computeIfAbsent(searchArea, ignored -> searchAreaIndexes.size());

      requirementSearchAreaIndexes[index] = searchAreaIndex;
    }

    List<VillageSearchArea> searchAreas = List.copyOf(searchAreaIndexes.keySet());
    long matchCapacity = Math.multiplyExact((long) request.resultLimit(), requirements.size());

    try (Memory nativeSearchAreas =
            new Memory(Math.multiplyExact(SEARCH_AREA_SIZE, searchAreas.size()));
        Memory nativeRequirementSearchAreaIndexes =
            new Memory(Math.multiplyExact((long) Integer.BYTES, requirements.size()));
        Memory candidateCount = new Memory(Integer.BYTES);
        Memory candidates =
            new Memory(Math.multiplyExact(SEED_CANDIDATE_SIZE, request.resultLimit()));
        Memory matches = new Memory(Math.multiplyExact(SEED_MATCH_SIZE, matchCapacity))) {
      writeKernelSearchAreas(nativeSearchAreas, searchAreas);
      writeRequirementSearchAreaIndexes(
          nativeRequirementSearchAreaIndexes, requirementSearchAreaIndexes);

      candidateCount.clear();
      candidates.clear();
      matches.clear();

      int status =
          nativeLibrary.searchVillageSeeds(
              nativeMinecraftVersion(request.minecraftVersion()),
              request.firstSeed(),
              request.seedCount(),
              nativeSearchAreas,
              searchAreas.size(),
              nativeRequirementSearchAreaIndexes,
              requirements.size(),
              request.resultLimit(),
              request.resultLimit(),
              candidateCount,
              candidates,
              matchCapacity,
              matches);

      requireSuccessfulStatus(status, request.minecraftVersion());

      return readSeedCandidates(request, candidateCount, candidates, matches);
    }
  }

  private void validateLimit(int limit) {
    if (limit <= 0 || limit > MAXIMUM_RESULTS) {
      throw new IllegalArgumentException(
          "village result limit must be between 1 and " + MAXIMUM_RESULTS);
    }
  }

  private StructureRequirement requireVillageRequirement(StructureRequirement requirement) {
    Objects.requireNonNull(requirement, "requirement");

    if (requirement.structureType() != structureType()) {
      throw new IllegalArgumentException(
          "village locator cannot search for structure type: "
              + requirement.structureType().identifier());
    }

    return requirement;
  }

  private void writeSearchAreas(Pointer searchAreas, List<StructureRequirement> requirements) {
    for (int index = 0; index < requirements.size(); index++) {
      StructureRequirement requirement = requirements.get(index);
      writeSearchArea(
          searchAreas,
          index,
          requirement.center().x(),
          requirement.center().z(),
          requirement.radiusBlocks());
    }
  }

  private void writeKernelSearchAreas(Pointer searchAreas, List<VillageSearchArea> areas) {
    for (int index = 0; index < areas.size(); index++) {
      VillageSearchArea area = areas.get(index);

      writeSearchArea(
          searchAreas, index, area.center().x(), area.center().z(), area.radiusBlocks());
    }
  }

  private void writeSearchArea(
      Pointer searchAreas, int index, long centerX, long centerZ, long radiusBlocks) {
    long offset = index * SEARCH_AREA_SIZE;

    searchAreas.setLong(offset + SEARCH_AREA_CENTER_X_OFFSET, centerX);
    searchAreas.setLong(offset + SEARCH_AREA_CENTER_Z_OFFSET, centerZ);
    searchAreas.setLong(offset + SEARCH_AREA_RADIUS_OFFSET, radiusBlocks);
  }

  private void writeRequirementSearchAreaIndexes(Pointer indexes, int[] searchAreaIndexes) {
    for (int index = 0; index < searchAreaIndexes.length; index++) {
      indexes.setInt((long) index * Integer.BYTES, searchAreaIndexes[index]);
    }
  }

  private int nativeMinecraftVersion(MinecraftVersion minecraftVersion) {
    return switch (minecraftVersion) {
      case JAVA_1_21 -> NATIVE_JAVA_1_21;
    };
  }

  private void requireSuccessfulStatus(int status, MinecraftVersion minecraftVersion) {
    switch (status) {
      case CubiomesNativeLibrary.STATUS_OK -> {
        return;
      }
      case CubiomesNativeLibrary.STATUS_INVALID_ARGUMENT ->
          throw new IllegalArgumentException("native village locator rejected invalid arguments");
      case CubiomesNativeLibrary.STATUS_UNSUPPORTED_VERSION ->
          throw new IllegalArgumentException(
              "unsupported Minecraft version: " + minecraftVersion.identifier());
      case CubiomesNativeLibrary.STATUS_OUT_OF_RANGE ->
          throw new IllegalArgumentException(
              "village search area exceeds supported Minecraft coordinates");
      case CubiomesNativeLibrary.STATUS_BUFFER_TOO_SMALL ->
          throw new IllegalStateException("native village locator rejected result buffer sizes");
      default ->
          throw new IllegalStateException("native village locator failed with status: " + status);
    }
  }

  private List<BlockPosition> readResults(Pointer resultCount, Pointer results, int limit) {
    return readResults(resultCount.getInt(0), results, 0, limit);
  }

  private List<BlockPosition> readResults(
      int count, Pointer results, long positionOffset, int limit) {
    if (count < 0 || count > limit) {
      throw new IllegalStateException(
          "native village locator returned invalid result count: " + count);
    }

    List<BlockPosition> positions = new ArrayList<>(count);

    for (int index = 0; index < count; index++) {
      long offset = positionOffset + POSITION_SIZE * index;

      positions.add(
          new BlockPosition(
              results.getInt(offset + POSITION_X_OFFSET),
              results.getInt(offset + POSITION_Z_OFFSET)));
    }

    return List.copyOf(positions);
  }

  private List<SeedSearchCandidate> readSeedCandidates(
      SeedSearchRequest request, Pointer candidateCount, Pointer candidates, Pointer matches) {
    int count = candidateCount.getInt(0);

    if (count < 0 || count > request.resultLimit()) {
      throw new IllegalStateException(
          "native village seed search returned invalid candidate count: " + count);
    }

    List<SeedSearchCandidate> results = new ArrayList<>(count);
    Set<Long> returnedSeeds = new HashSet<>();
    long lastSeed = request.firstSeed() + request.seedCount() - 1L;

    for (int candidateIndex = 0; candidateIndex < count; candidateIndex++) {
      long candidateOffset = candidateIndex * SEED_CANDIDATE_SIZE;
      long seed = candidates.getLong(candidateOffset + SEED_CANDIDATE_SEED_OFFSET);
      int matchedRequirementCount =
          candidates.getInt(candidateOffset + SEED_CANDIDATE_MATCH_COUNT_OFFSET);
      int reserved = candidates.getInt(candidateOffset + SEED_CANDIDATE_RESERVED_OFFSET);

      if (seed < request.firstSeed() || seed > lastSeed || !returnedSeeds.add(seed)) {
        throw new IllegalStateException(
            "native village seed search returned invalid candidate seed: " + seed);
      }

      if (matchedRequirementCount <= 0 || matchedRequirementCount > request.requirements().size()) {
        throw new IllegalStateException(
            "native village seed search returned invalid match count: " + matchedRequirementCount);
      }

      if (reserved != 0) {
        throw new IllegalStateException(
            "native village seed search returned non-zero reserved candidate data");
      }

      List<StructureMatch> candidateMatches = readSeedMatches(request, candidateIndex, matches);

      if (candidateMatches.size() != matchedRequirementCount) {
        throw new IllegalStateException(
            "native village seed search returned "
                + candidateMatches.size()
                + " matches instead of "
                + matchedRequirementCount);
      }

      results.add(new SeedSearchCandidate(seed, request.requirements().size(), candidateMatches));
    }

    return List.copyOf(results);
  }

  private List<StructureMatch> readSeedMatches(
      SeedSearchRequest request, int candidateIndex, Pointer matches) {
    List<StructureMatch> results = new ArrayList<>();

    for (int requirementIndex = 0;
        requirementIndex < request.requirements().size();
        requirementIndex++) {
      long matchIndex = (long) candidateIndex * request.requirements().size() + requirementIndex;
      long matchOffset = matchIndex * SEED_MATCH_SIZE;
      int found = matches.getInt(matchOffset + SEED_MATCH_FOUND_OFFSET);

      if (found == 0) {
        continue;
      }

      if (found != 1) {
        throw new IllegalStateException(
            "native village seed search returned invalid match flag: " + found);
      }

      BlockPosition position =
          new BlockPosition(
              matches.getInt(matchOffset + SEED_MATCH_X_OFFSET),
              matches.getInt(matchOffset + SEED_MATCH_Z_OFFSET));

      results.add(StructureMatch.from(request.requirements().get(requirementIndex), position));
    }

    return List.copyOf(results);
  }

  private record VillageSearchArea(BlockPosition center, long radiusBlocks) {

    private static VillageSearchArea from(StructureRequirement requirement) {
      return new VillageSearchArea(requirement.center(), requirement.radiusBlocks());
    }
  }
}
