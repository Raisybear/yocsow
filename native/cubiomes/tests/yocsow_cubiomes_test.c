#include "yocsow_cubiomes.h"

#include <stdint.h>
#include <stdio.h>

static int failures = 0;

static void expect_equal(
    const char *label,
    int64_t expected,
    int64_t actual) {
  if (expected == actual) {
    return;
  }

  fprintf(
      stderr,
      "%s: expected %lld, got %lld\n",
      label,
      (long long)expected,
      (long long)actual);

  failures++;
}

static void expect_true(
    const char *label,
    int condition) {
  if (condition) {
    return;
  }

  fprintf(stderr, "%s: expected true\n", label);
  failures++;
}

static void finds_nearest_confirmed_village(void) {
  struct YocsowVillageResult result;

  int32_t status =
      yocsow_find_nearest_village(
          YOCSOW_MC_JAVA_1_21,
          42,
          0,
          0,
          1000,
          &result);

  expect_equal(
      "successful status",
      YOCSOW_CUBIOMES_OK,
      status);

  expect_equal(
      "village found",
      1,
      result.found);

  expect_equal(
      "village x",
      656,
      result.x);

  expect_equal(
      "village z",
      -304,
      result.z);
}

static void reports_when_radius_contains_no_village(
    void) {
  struct YocsowVillageResult result;

  int32_t status =
      yocsow_find_nearest_village(
          YOCSOW_MC_JAVA_1_21,
          42,
          0,
          0,
          500,
          &result);

  expect_equal(
      "successful empty status",
      YOCSOW_CUBIOMES_OK,
      status);

  expect_equal(
      "no village found",
      0,
      result.found);
}

static void finds_multiple_unique_villages(void) {
  int32_t result_count = 0;
  struct YocsowBlockPosition results[4];

  int32_t status =
      yocsow_find_villages(
          YOCSOW_MC_JAVA_1_21,
          42,
          0,
          0,
          5000,
          4,
          &result_count,
          results);

  expect_equal(
      "multiple village status",
      YOCSOW_CUBIOMES_OK,
      status);

  expect_equal(
      "multiple village count",
      4,
      result_count);

  for (int32_t first = 0;
       first < result_count;
       first++) {
    for (int32_t second = first + 1;
         second < result_count;
         second++) {
      expect_true(
          "villages are unique",
          results[first].x != results[second].x ||
              results[first].z != results[second].z);
    }
  }

  for (int32_t index = 1;
       index < result_count;
       index++) {
    int64_t previous_distance =
        (int64_t)results[index - 1].x *
            results[index - 1].x +
        (int64_t)results[index - 1].z *
            results[index - 1].z;

    int64_t current_distance =
        (int64_t)results[index].x *
            results[index].x +
        (int64_t)results[index].z *
            results[index].z;

    expect_true(
        "villages are sorted by distance",
        previous_distance <= current_distance);
  }
}

static void batch_matches_individual_searches(void) {
  const int32_t seed_count = 3;
  const int32_t search_area_count = 2;
  const int32_t result_capacity = 4;

  const struct YocsowVillageSearchArea search_areas[2] = {
      {0, 0, 500},
      {1000, -1000, 5000}};

  int32_t result_counts[6] = {0};
  struct YocsowBlockPosition results[24] = {{0, 0}};

  int32_t status =
      yocsow_find_villages_batch(
          YOCSOW_MC_JAVA_1_21,
          42,
          seed_count,
          search_areas,
          search_area_count,
          result_capacity,
          6,
          result_counts,
          24,
          results);

  expect_equal(
      "batch village status",
      YOCSOW_CUBIOMES_OK,
      status);

  for (int32_t seed_index = 0;
       seed_index < seed_count;
       seed_index++) {
    for (int32_t search_area_index = 0;
         search_area_index < search_area_count;
         search_area_index++) {
      const struct YocsowVillageSearchArea *search_area =
          &search_areas[search_area_index];

      int32_t expected_count = 0;
      struct YocsowBlockPosition expected_results[4];

      int32_t expected_status =
          yocsow_find_villages(
              YOCSOW_MC_JAVA_1_21,
              42 + seed_index,
              search_area->center_x,
              search_area->center_z,
              search_area->radius_blocks,
              result_capacity,
              &expected_count,
              expected_results);

      expect_equal(
          "individual comparison status",
          YOCSOW_CUBIOMES_OK,
          expected_status);

      int32_t result_count_index =
          seed_index * search_area_count +
          search_area_index;

      expect_equal(
          "batch village count",
          expected_count,
          result_counts[result_count_index]);

      int32_t result_position_index =
          result_count_index * result_capacity;

      for (int32_t result_index = 0;
           result_index < expected_count;
           result_index++) {
        expect_equal(
            "batch village x",
            expected_results[result_index].x,
            results[result_position_index + result_index].x);

        expect_equal(
            "batch village z",
            expected_results[result_index].z,
            results[result_position_index + result_index].z);
      }
    }
  }
}

static void rejects_small_batch_buffers_without_writing(
    void) {
  struct YocsowVillageSearchArea search_area = {
      0,
      0,
      1000};

  int32_t result_counts[2] = {123, 456};

  struct YocsowBlockPosition results[2] = {
      {789, 987},
      {654, 456}};

  int32_t status =
      yocsow_find_villages_batch(
          YOCSOW_MC_JAVA_1_21,
          42,
          2,
          &search_area,
          1,
          1,
          1,
          result_counts,
          2,
          results);

  expect_equal(
      "small count buffer status",
      YOCSOW_CUBIOMES_BUFFER_TOO_SMALL,
      status);

  expect_equal(
      "small count buffer leaves counts unchanged",
      123,
      result_counts[0]);

  status =
      yocsow_find_villages_batch(
          YOCSOW_MC_JAVA_1_21,
          42,
          2,
          &search_area,
          1,
          1,
          2,
          result_counts,
          1,
          results);

  expect_equal(
      "small position buffer status",
      YOCSOW_CUBIOMES_BUFFER_TOO_SMALL,
      status);

  expect_equal(
      "small position buffer leaves counts unchanged",
      123,
      result_counts[0]);

  expect_equal(
      "small position buffer leaves positions unchanged",
      789,
      results[0].x);
}

static void rejects_invalid_batch_arguments(void) {
  struct YocsowVillageSearchArea search_area = {
      0,
      0,
      1000};

  int32_t result_counts[2] = {123, 321};

  struct YocsowBlockPosition results[2] = {
      {456, 789},
      {654, 987}};

  int32_t status =
      yocsow_find_villages_batch(
          YOCSOW_MC_JAVA_1_21,
          42,
          0,
          &search_area,
          1,
          1,
          1,
          result_counts,
          1,
          results);

  expect_equal(
      "invalid batch size status",
      YOCSOW_CUBIOMES_INVALID_ARGUMENT,
      status);

  search_area.radius_blocks = 0;

  status =
      yocsow_find_villages_batch(
          YOCSOW_MC_JAVA_1_21,
          42,
          1,
          &search_area,
          1,
          1,
          1,
          result_counts,
          1,
          results);

  expect_equal(
      "invalid batch radius status",
      YOCSOW_CUBIOMES_INVALID_ARGUMENT,
      status);

  expect_equal(
      "invalid batch leaves count unchanged",
      123,
      result_counts[0]);

  search_area.radius_blocks = 1000;

  status =
      yocsow_find_villages_batch(
          YOCSOW_MC_JAVA_1_21,
          INT64_MAX,
          2,
          &search_area,
          1,
          1,
          2,
          result_counts,
          2,
          results);

  expect_equal(
      "overflowing batch status",
      YOCSOW_CUBIOMES_OUT_OF_RANGE,
      status);
}

static void biome_batch_matches_scalar_results(void) {
  const int32_t seed_count = 8;
  const int32_t area_count = 2;
  const struct YocsowBiomeSearchArea areas[2] = {
      {YOCSOW_BIOME_TAIGA, 16, 0, 0},
      {YOCSOW_BIOME_TAIGA, 64, 512, -512}};
  int32_t matches[16] = {0};

  int32_t status = yocsow_match_biomes_batch(
      YOCSOW_MC_JAVA_1_21,
      -4,
      seed_count,
      areas,
      area_count,
      16,
      matches);

  expect_equal("biome batch status", YOCSOW_CUBIOMES_OK, status);

  for (int32_t seed_index = 0; seed_index < seed_count; seed_index++) {
    for (int32_t area_index = 0; area_index < area_count; area_index++) {
      int32_t expected_match = 0;
      const struct YocsowBiomeSearchArea *area = &areas[area_index];
      int32_t scalar_status = yocsow_matches_biome(
          YOCSOW_MC_JAVA_1_21,
          -4 + seed_index,
          area->biome,
          area->center_x,
          area->center_z,
          area->radius_blocks,
          &expected_match);

      expect_equal("scalar biome status", YOCSOW_CUBIOMES_OK, scalar_status);
      expect_equal(
          "biome batch match",
          expected_match,
          matches[seed_index * area_count + area_index]);
    }
  }
}

static void rejects_invalid_biome_batch_arguments(void) {
  struct YocsowBiomeSearchArea area = {
      999,
      64,
      0,
      0};
  int32_t match = 123;

  int32_t status = yocsow_match_biomes_batch(
      YOCSOW_MC_JAVA_1_21, 42, 1, &area, 1, 1, &match);

  expect_equal(
      "unsupported biome status",
      YOCSOW_CUBIOMES_INVALID_ARGUMENT,
      status);
  expect_equal("invalid biome leaves match unchanged", 123, match);

  area.biome = YOCSOW_BIOME_TAIGA;
  status = yocsow_match_biomes_batch(
      YOCSOW_MC_JAVA_1_21, 42, 1, &area, 1, 0, &match);

  expect_equal(
      "small biome buffer status",
      YOCSOW_CUBIOMES_BUFFER_TOO_SMALL,
      status);
  expect_equal("small biome buffer leaves match unchanged", 123, match);
}

struct ExpectedSeedCandidate {
  int64_t seed;
  int64_t distance_squared;
  struct YocsowBlockPosition position;
};

static int expected_seed_candidate_is_better(
    const struct ExpectedSeedCandidate *candidate,
    const struct ExpectedSeedCandidate *existing) {
  if (candidate->distance_squared !=
      existing->distance_squared) {
    return candidate->distance_squared <
           existing->distance_squared;
  }

  return candidate->seed < existing->seed;
}

static void insert_expected_seed_candidate(
    const struct ExpectedSeedCandidate *candidate,
    int32_t capacity,
    int32_t *count,
    struct ExpectedSeedCandidate *candidates) {
  int32_t insertion_index = 0;

  while (insertion_index < *count &&
         !expected_seed_candidate_is_better(
             candidate,
             &candidates[insertion_index])) {
    insertion_index++;
  }

  if (insertion_index >= capacity) {
    return;
  }

  int32_t new_count = *count;

  if (new_count < capacity) {
    new_count++;
  }

  for (int32_t index = new_count - 1;
       index > insertion_index;
       index--) {
    candidates[index] = candidates[index - 1];
  }

  candidates[insertion_index] = *candidate;
  *count = new_count;
}

static void seed_search_matches_scalar_results(void) {
  const int64_t first_seed = -32;
  const int32_t seed_count = 64;
  const int32_t result_capacity = 5;

  const struct YocsowVillageSearchArea search_area = {
      0,
      0,
      1000};

  const int32_t requirement_search_area_index = 0;

  int32_t expected_count = 0;

  struct ExpectedSeedCandidate
      expected_candidates[5];

  for (int32_t seed_index = 0;
       seed_index < seed_count;
       seed_index++) {
    int32_t village_count = 0;
    struct YocsowBlockPosition village;

    int32_t status =
        yocsow_find_villages(
            YOCSOW_MC_JAVA_1_21,
            first_seed + seed_index,
            search_area.center_x,
            search_area.center_z,
            search_area.radius_blocks,
            1,
            &village_count,
            &village);

    expect_equal(
        "scalar seed search status",
        YOCSOW_CUBIOMES_OK,
        status);

    if (village_count == 0) {
      continue;
    }

    struct ExpectedSeedCandidate candidate = {
        first_seed + seed_index,
        (int64_t)village.x * village.x +
            (int64_t)village.z * village.z,
        village};

    insert_expected_seed_candidate(
        &candidate,
        result_capacity,
        &expected_count,
        expected_candidates);
  }

  int32_t candidate_count = 0;

  struct YocsowSeedSearchCandidate candidates[5];
  struct YocsowSeedSearchMatch matches[5];

  int32_t status =
      yocsow_search_village_seeds(
          YOCSOW_MC_JAVA_1_21,
          first_seed,
          seed_count,
          &search_area,
          1,
          &requirement_search_area_index,
          1,
          result_capacity,
          5,
          &candidate_count,
          candidates,
          5,
          matches);

  expect_equal(
      "native seed search status",
      YOCSOW_CUBIOMES_OK,
      status);

  expect_equal(
      "native seed search candidate count",
      expected_count,
      candidate_count);

  for (int32_t index = 0;
       index < expected_count;
       index++) {
    expect_equal(
        "native seed search seed",
        expected_candidates[index].seed,
        candidates[index].seed);

    expect_equal(
        "native seed search match count",
        1,
        candidates[index]
            .matched_requirement_count);

    expect_equal(
        "native seed search match found",
        1,
        matches[index].found);

    expect_equal(
        "native seed search match x",
        expected_candidates[index].position.x,
        matches[index].x);

    expect_equal(
        "native seed search match z",
        expected_candidates[index].position.z,
        matches[index].z);
  }
}

static void seed_search_assigns_distinct_villages(void) {
  const struct YocsowVillageSearchArea search_area = {
      0,
      0,
      5000};

  const int32_t requirement_search_area_indexes[2] = {
      0,
      0};

  int32_t expected_count = 0;
  struct YocsowBlockPosition expected_villages[2];

  int32_t status =
      yocsow_find_villages(
          YOCSOW_MC_JAVA_1_21,
          42,
          search_area.center_x,
          search_area.center_z,
          search_area.radius_blocks,
          2,
          &expected_count,
          expected_villages);

  expect_equal(
      "distinct village reference status",
      YOCSOW_CUBIOMES_OK,
      status);

  expect_equal(
      "distinct village reference count",
      2,
      expected_count);

  int32_t candidate_count = 0;
  struct YocsowSeedSearchCandidate candidate;
  struct YocsowSeedSearchMatch matches[2];

  status =
      yocsow_search_village_seeds(
          YOCSOW_MC_JAVA_1_21,
          42,
          1,
          &search_area,
          1,
          requirement_search_area_indexes,
          2,
          1,
          1,
          &candidate_count,
          &candidate,
          2,
          matches);

  expect_equal(
      "distinct village seed search status",
      YOCSOW_CUBIOMES_OK,
      status);

  expect_equal(
      "distinct village candidate count",
      1,
      candidate_count);

  expect_equal(
      "distinct village match count",
      2,
      candidate.matched_requirement_count);

  expect_true(
      "seed search village assignments differ",
      matches[0].x != matches[1].x ||
          matches[0].z != matches[1].z);

  expect_equal(
      "reassigned first village x",
      expected_villages[1].x,
      matches[0].x);

  expect_equal(
      "reassigned first village z",
      expected_villages[1].z,
      matches[0].z);

  expect_equal(
      "assigned second village x",
      expected_villages[0].x,
      matches[1].x);

  expect_equal(
      "assigned second village z",
      expected_villages[0].z,
      matches[1].z);
}

static void rejects_invalid_seed_search_buffers(void) {
  const struct YocsowVillageSearchArea search_area = {
      0,
      0,
      1000};

  const int32_t requirement_search_area_indexes[2] = {
      0,
      0};

  int32_t candidate_count = 123;

  struct YocsowSeedSearchCandidate candidate = {
      456,
      789,
      0};

  struct YocsowSeedSearchMatch matches[2] = {
      {1, 234, 567},
      {1, 345, 678}};

  int32_t status =
      yocsow_search_village_seeds(
          YOCSOW_MC_JAVA_1_21,
          42,
          1,
          &search_area,
          1,
          requirement_search_area_indexes,
          2,
          1,
          0,
          &candidate_count,
          &candidate,
          2,
          matches);

  expect_equal(
      "small candidate buffer status",
      YOCSOW_CUBIOMES_BUFFER_TOO_SMALL,
      status);

  expect_equal(
      "small candidate buffer leaves count unchanged",
      123,
      candidate_count);

  status =
      yocsow_search_village_seeds(
          YOCSOW_MC_JAVA_1_21,
          42,
          1,
          &search_area,
          1,
          requirement_search_area_indexes,
          2,
          1,
          1,
          &candidate_count,
          &candidate,
          1,
          matches);

  expect_equal(
      "small match buffer status",
      YOCSOW_CUBIOMES_BUFFER_TOO_SMALL,
      status);

  expect_equal(
      "small match buffer leaves candidate unchanged",
      456,
      candidate.seed);

  expect_equal(
      "small match buffer leaves match unchanged",
      234,
      matches[0].x);
}

static void rejects_unsupported_versions(void) {
  struct YocsowVillageResult result;

  int32_t status =
      yocsow_find_nearest_village(
          999,
          42,
          0,
          0,
          1000,
          &result);

  expect_equal(
      "unsupported version status",
      YOCSOW_CUBIOMES_UNSUPPORTED_VERSION,
      status);
}

static void finds_ruined_portals_through_generic_structure_search(void) {
  int32_t result_count = 0;
  struct YocsowBlockPosition results[4];

  int32_t status =
      yocsow_find_structures(
          YOCSOW_MC_JAVA_1_21,
          YOCSOW_STRUCTURE_RUINED_PORTAL,
          42,
          0,
          0,
          5000,
          4,
          &result_count,
          results);

  expect_equal(
      "ruined portal status",
      YOCSOW_CUBIOMES_OK,
      status);
  expect_true(
      "ruined portal found",
      result_count > 0);

  for (int32_t index = 0; index < result_count; index++) {
    int64_t distance_squared =
        (int64_t)results[index].x * results[index].x +
        (int64_t)results[index].z * results[index].z;

    expect_true(
        "ruined portal inside radius",
        distance_squared <= 5000LL * 5000LL);
  }
}

static void rejects_unknown_generic_structure_types(void) {
  int32_t result_count = 123;
  struct YocsowBlockPosition result = {456, 789};

  int32_t status =
      yocsow_find_structures(
          YOCSOW_MC_JAVA_1_21,
          999,
          42,
          0,
          0,
          1000,
          1,
          &result_count,
          &result);

  expect_equal(
      "unknown structure status",
      YOCSOW_CUBIOMES_INVALID_ARGUMENT,
      status);
  expect_equal(
      "unknown structure clears count",
      0,
      result_count);
}

static void rejects_invalid_radii(void) {
  struct YocsowVillageResult result;

  int32_t status =
      yocsow_find_nearest_village(
          YOCSOW_MC_JAVA_1_21,
          42,
          0,
          0,
          0,
          &result);

  expect_equal(
      "invalid radius status",
      YOCSOW_CUBIOMES_INVALID_ARGUMENT,
      status);
}

static void rejects_searches_outside_world_border(
    void) {
  struct YocsowVillageResult result;

  int32_t status =
      yocsow_find_nearest_village(
          YOCSOW_MC_JAVA_1_21,
          42,
          30000000,
          0,
          1,
          &result);

  expect_equal(
      "out-of-range status",
      YOCSOW_CUBIOMES_OUT_OF_RANGE,
      status);
}

int main(void) {
  finds_nearest_confirmed_village();
  reports_when_radius_contains_no_village();
  finds_multiple_unique_villages();
  batch_matches_individual_searches();
  rejects_small_batch_buffers_without_writing();
  rejects_invalid_batch_arguments();
  biome_batch_matches_scalar_results();
  rejects_invalid_biome_batch_arguments();
  seed_search_matches_scalar_results();
  seed_search_assigns_distinct_villages();
  rejects_invalid_seed_search_buffers();
  finds_ruined_portals_through_generic_structure_search();
  rejects_unknown_generic_structure_types();
  rejects_unsupported_versions();
  rejects_invalid_radii();
  rejects_searches_outside_world_border();

  if (failures != 0) {
    fprintf(
        stderr,
        "%d native Cubiomes test(s) failed\n",
        failures);

    return 1;
  }

  puts("All native Cubiomes tests passed.");
  return 0;
}
