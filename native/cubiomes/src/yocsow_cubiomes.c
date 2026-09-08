#include "yocsow_cubiomes.h"

#include "finders.h"

#include <limits.h>
#include <stdint.h>

#define YOCSOW_MAX_BLOCK_COORDINATE 30000000

static int cubiomes_version(
    int32_t minecraft_version) {
  switch (minecraft_version) {
    case YOCSOW_MC_JAVA_1_21:
      return MC_1_21_1;
    default:
      return MC_UNDEF;
  }
}

static int32_t floor_divide(
    int64_t value,
    int32_t divisor) {
  int64_t quotient = value / divisor;
  int64_t remainder = value % divisor;

  if (remainder < 0) {
    quotient--;
  }

  return (int32_t)quotient;
}

static int search_area_is_valid(
    int64_t center_x,
    int64_t center_z,
    int64_t radius_blocks) {
  if (radius_blocks <= 0 ||
      radius_blocks > YOCSOW_MAX_BLOCK_COORDINATE) {
    return 0;
  }

  if (center_x < -YOCSOW_MAX_BLOCK_COORDINATE ||
      center_x > YOCSOW_MAX_BLOCK_COORDINATE ||
      center_z < -YOCSOW_MAX_BLOCK_COORDINATE ||
      center_z > YOCSOW_MAX_BLOCK_COORDINATE) {
    return 0;
  }

  return center_x - radius_blocks >=
             -YOCSOW_MAX_BLOCK_COORDINATE &&
         center_x + radius_blocks <=
             YOCSOW_MAX_BLOCK_COORDINATE &&
         center_z - radius_blocks >=
             -YOCSOW_MAX_BLOCK_COORDINATE &&
         center_z + radius_blocks <=
             YOCSOW_MAX_BLOCK_COORDINATE;
}

static int candidate_is_better(
    int found,
    int64_t distance_squared,
    int64_t best_distance_squared,
    const Pos *candidate,
    const struct YocsowVillageResult *result) {
  if (!found ||
      distance_squared < best_distance_squared) {
    return 1;
  }

  if (distance_squared > best_distance_squared) {
    return 0;
  }

  return candidate->x < result->x ||
         (candidate->x == result->x &&
          candidate->z < result->z);
}

int32_t yocsow_find_nearest_village(
    int32_t minecraft_version,
    int64_t seed,
    int64_t center_x,
    int64_t center_z,
    int64_t radius_blocks,
    struct YocsowVillageResult *result) {
  if (result == NULL) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
  }

  result->found = 0;
  result->x = 0;
  result->z = 0;

  int mc = cubiomes_version(minecraft_version);

  if (mc == MC_UNDEF) {
    return YOCSOW_CUBIOMES_UNSUPPORTED_VERSION;
  }

  if (radius_blocks <= 0) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
  }

  if (!search_area_is_valid(
          center_x,
          center_z,
          radius_blocks)) {
    return YOCSOW_CUBIOMES_OUT_OF_RANGE;
  }

  StructureConfig structure_config;

  if (!getStructureConfig(
          Village,
          mc,
          &structure_config)) {
    return YOCSOW_CUBIOMES_UNSUPPORTED_VERSION;
  }

  int32_t region_size_blocks =
      structure_config.regionSize * 16;

  int32_t minimum_region_x =
      floor_divide(
          center_x - radius_blocks,
          region_size_blocks);

  int32_t maximum_region_x =
      floor_divide(
          center_x + radius_blocks,
          region_size_blocks);

  int32_t minimum_region_z =
      floor_divide(
          center_z - radius_blocks,
          region_size_blocks);

  int32_t maximum_region_z =
      floor_divide(
          center_z + radius_blocks,
          region_size_blocks);

  Generator generator;
  setupGenerator(&generator, mc, 0);

  applySeed(
      &generator,
      DIM_OVERWORLD,
      (uint64_t)seed);

  int64_t maximum_distance_squared =
      radius_blocks * radius_blocks;

  int64_t best_distance_squared =
      INT64_MAX;

  for (int32_t region_x = minimum_region_x;
       region_x <= maximum_region_x;
       region_x++) {
    for (int32_t region_z = minimum_region_z;
         region_z <= maximum_region_z;
         region_z++) {
      Pos candidate;

      if (!getStructurePos(
              Village,
              mc,
              (uint64_t)seed,
              region_x,
              region_z,
              &candidate)) {
        continue;
      }

      int64_t delta_x =
          (int64_t)candidate.x - center_x;

      int64_t delta_z =
          (int64_t)candidate.z - center_z;

      int64_t distance_squared =
          delta_x * delta_x +
          delta_z * delta_z;

      if (distance_squared >
              maximum_distance_squared ||
          !candidate_is_better(
              result->found,
              distance_squared,
              best_distance_squared,
              &candidate,
              result)) {
        continue;
      }

      if (!isViableStructurePos(
              Village,
              &generator,
              candidate.x,
              candidate.z,
              0)) {
        continue;
      }

      result->found = 1;
      result->x = candidate.x;
      result->z = candidate.z;
      best_distance_squared = distance_squared;
    }
  }

  return YOCSOW_CUBIOMES_OK;
}