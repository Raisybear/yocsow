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
