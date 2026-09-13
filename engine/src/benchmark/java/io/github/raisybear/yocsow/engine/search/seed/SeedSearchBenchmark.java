package io.github.raisybear.yocsow.engine.search.seed;

import io.github.raisybear.yocsow.engine.search.BlockPosition;
import io.github.raisybear.yocsow.engine.search.MinecraftVersion;
import io.github.raisybear.yocsow.engine.search.StructureRequirement;
import io.github.raisybear.yocsow.engine.search.StructureType;
import io.github.raisybear.yocsow.engine.search.structure.StructureLocatorRegistry;
import io.github.raisybear.yocsow.engine.search.structure.cubiomes.CubiomesVillageLocator;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

public final class SeedSearchBenchmark {

  private static final long FIRST_MEASURED_SEED = -5_000_000L;
  private static final int WARMUP_SEED_COUNT = 2_000;
  private static final int RESULT_LIMIT = 20;

  private SeedSearchBenchmark() {}

  public static void main(String[] args) {
    BenchmarkConfiguration configuration = BenchmarkConfiguration.parse(args);
    SeedSearchService service =
        new SeedSearchService(new StructureLocatorRegistry(List.of(new CubiomesVillageLocator())));
    List<StructureRequirement> requirements = configuration.scenario().requirements();
    int warmupSeedCount = Math.min(WARMUP_SEED_COUNT, configuration.seedCount());

    System.out.println("YOCSOW deterministic seed-search benchmark");
    System.out.printf("Java: %s%n", System.getProperty("java.runtime.version"));
    System.out.printf(
        "Operating system: %s (%s)%n",
        System.getProperty("os.name"), System.getProperty("os.arch"));
    System.out.printf("Scenario: %s%n", configuration.scenario().identifier());
    System.out.printf("Requirements: %,d%n", requirements.size());
    System.out.printf("Warmup seeds: %,d%n", warmupSeedCount);
    System.out.printf("Measured seeds per iteration: %,d%n", configuration.seedCount());
    System.out.printf("Iterations: %,d%n", configuration.iterations());
    System.out.printf("Available processors: %,d%n", Runtime.getRuntime().availableProcessors());

    search(service, FIRST_MEASURED_SEED - warmupSeedCount, warmupSeedCount, requirements);

    long[] elapsedNanoseconds = new long[configuration.iterations()];
    long resultFingerprint = 0;

    for (int iteration = 0; iteration < configuration.iterations(); iteration++) {
      long firstSeed = FIRST_MEASURED_SEED + (long) iteration * configuration.seedCount();
      long startedAt = System.nanoTime();
      SeedSearchResult result = search(service, firstSeed, configuration.seedCount(), requirements);
      long elapsed = System.nanoTime() - startedAt;

      elapsedNanoseconds[iteration] = elapsed;
      resultFingerprint = 31 * resultFingerprint + fingerprint(result);

      System.out.printf(
          Locale.ROOT,
          "Iteration %d: %.3f s, %,.0f seeds/s%n",
          iteration + 1,
          seconds(elapsed),
          seedsPerSecond(configuration.seedCount(), elapsed));
    }

    long[] sortedElapsedNanoseconds = elapsedNanoseconds.clone();
    Arrays.sort(sortedElapsedNanoseconds);
    long medianElapsedNanoseconds = sortedElapsedNanoseconds[sortedElapsedNanoseconds.length / 2];

    System.out.printf(
        Locale.ROOT,
        "Median: %.3f s, %,.0f seeds/s%n",
        seconds(medianElapsedNanoseconds),
        seedsPerSecond(configuration.seedCount(), medianElapsedNanoseconds));
    System.out.printf("Result fingerprint: %d%n", resultFingerprint);
    System.out.printf(
        Locale.ROOT,
        "BENCHMARK_RESULT scenario=%s seeds=%d iterations=%d medianSeconds=%.3f "
            + "seedsPerSecond=%.0f fingerprint=%d%n",
        configuration.scenario().identifier(),
        configuration.seedCount(),
        configuration.iterations(),
        seconds(medianElapsedNanoseconds),
        seedsPerSecond(configuration.seedCount(), medianElapsedNanoseconds),
        resultFingerprint);
  }

  private static SeedSearchResult search(
      SeedSearchService service,
      long firstSeed,
      int seedCount,
      List<StructureRequirement> requirements) {
    SeedSearchResult result =
        service.search(
            new SeedSearchRequest(
                firstSeed, seedCount, MinecraftVersion.JAVA_1_21, requirements, RESULT_LIMIT));

    if (result.searchedSeedCount() != seedCount) {
      throw new IllegalStateException(
          "benchmark search returned "
              + result.searchedSeedCount()
              + " seeds instead of "
              + seedCount);
    }

    return result;
  }

  private static long fingerprint(SeedSearchResult result) {
    long fingerprint = result.searchedSeedCount();

    for (SeedSearchCandidate candidate : result.candidates()) {
      fingerprint = 31 * fingerprint + candidate.seed();
      fingerprint = 31 * fingerprint + candidate.matchedRequirementCount();

      for (StructureMatch match : candidate.matches()) {
        fingerprint = 31 * fingerprint + match.requirementId().hashCode();
        fingerprint = 31 * fingerprint + match.actualPosition().x();
        fingerprint = 31 * fingerprint + match.actualPosition().z();
      }
    }

    return fingerprint;
  }

  private static double seconds(long nanoseconds) {
    return nanoseconds / 1_000_000_000.0;
  }

  private static double seedsPerSecond(int seedCount, long nanoseconds) {
    return seedCount / seconds(nanoseconds);
  }

  private enum BenchmarkScenario {
    SHARED("shared"),
    DISTINCT("distinct");

    private final String identifier;

    BenchmarkScenario(String identifier) {
      this.identifier = identifier;
    }

    String identifier() {
      return identifier;
    }

    List<StructureRequirement> requirements() {
      return switch (this) {
        case SHARED -> sharedRequirements();
        case DISTINCT -> distinctRequirements();
      };
    }

    static BenchmarkScenario parse(String value) {
      return Arrays.stream(values())
          .filter(scenario -> scenario.identifier.equals(value))
          .findFirst()
          .orElseThrow(
              () ->
                  new IllegalArgumentException(
                      "benchmark scenario must be shared or distinct: " + value));
    }
  }

  private record BenchmarkConfiguration(BenchmarkScenario scenario, int seedCount, int iterations) {

    private static BenchmarkConfiguration parse(String[] args) {
      if (args.length != 3) {
        throw new IllegalArgumentException(
            "expected arguments: <shared|distinct> <seed-count> <iterations>");
      }

      BenchmarkScenario scenario = BenchmarkScenario.parse(args[0]);
      int seedCount = positiveInteger("seed count", args[1]);
      int iterations = positiveInteger("iterations", args[2]);

      if (seedCount > SeedSearchRequest.MAXIMUM_SEEDS_PER_BATCH) {
        throw new IllegalArgumentException(
            "seed count must not exceed " + SeedSearchRequest.MAXIMUM_SEEDS_PER_BATCH);
      }

      return new BenchmarkConfiguration(scenario, seedCount, iterations);
    }

    private static int positiveInteger(String name, String value) {
      try {
        int parsed = Integer.parseInt(value);

        if (parsed <= 0) {
          throw new IllegalArgumentException(name + " must be greater than zero");
        }

        return parsed;
      } catch (NumberFormatException exception) {
        throw new IllegalArgumentException(name + " must be a positive integer", exception);
      }
    }
  }

  private static List<StructureRequirement> sharedRequirements() {
    return List.of(
        village("village-1", 0, 0),
        village("village-2", 0, 0),
        village("village-3", 0, 0),
        village("village-4", 0, 0),
        village("village-5", 0, 0));
  }

  private static List<StructureRequirement> distinctRequirements() {
    return List.of(
        village("village-1", 0, 0),
        village("village-2", 9_000, 0),
        village("village-3", -9_000, 0),
        village("village-4", 0, 9_000),
        village("village-5", 0, -9_000));
  }

  private static StructureRequirement village(String id, long x, long z) {
    return new StructureRequirement(id, StructureType.VILLAGE, new BlockPosition(x, z), 1_000);
  }
}
