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
