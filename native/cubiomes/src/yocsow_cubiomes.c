#include "yocsow_cubiomes.h"

#include "finders.h"

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

static int64_t distance_squared(
    int64_t center_x,
    int64_t center_z,
    const Pos *position) {
  int64_t delta_x =
      (int64_t)position->x - center_x;

  int64_t delta_z =
      (int64_t)position->z - center_z;

  return delta_x * delta_x +
         delta_z * delta_z;
}

static int candidate_is_better(
    int64_t center_x,
    int64_t center_z,
    const Pos *candidate,
    const struct YocsowBlockPosition *existing) {
  int64_t candidate_distance =
      distance_squared(center_x, center_z, candidate);

  Pos existing_position = {
      existing->x,
      existing->z};

  int64_t existing_distance =
      distance_squared(
          center_x,
          center_z,
          &existing_position);

  if (candidate_distance < existing_distance) {
    return 1;
  }

  if (candidate_distance > existing_distance) {
    return 0;
  }

  return candidate->x < existing->x ||
         (candidate->x == existing->x &&
          candidate->z < existing->z);
}

static void insert_candidate(
    int64_t center_x,
    int64_t center_z,
    const Pos *candidate,
    int32_t result_capacity,
    int32_t *result_count,
    struct YocsowBlockPosition *results) {
  for (int32_t index = 0;
       index < *result_count;
       index++) {
    if (results[index].x == candidate->x &&
        results[index].z == candidate->z) {
      return;
    }
  }

  int32_t insertion_index = 0;

  while (insertion_index < *result_count &&
         !candidate_is_better(
             center_x,
             center_z,
             candidate,
             &results[insertion_index])) {
    insertion_index++;
  }

  if (insertion_index >= result_capacity) {
    return;
  }

  int32_t new_count = *result_count;

  if (new_count < result_capacity) {
    new_count++;
  }

  for (int32_t index = new_count - 1;
       index > insertion_index;
       index--) {
    results[index] = results[index - 1];
  }

  results[insertion_index].x = candidate->x;
  results[insertion_index].z = candidate->z;
  *result_count = new_count;
}

static void find_villages_with_generator(
    int mc,
    uint64_t seed,
    const StructureConfig *structure_config,
    Generator *generator,
    int64_t center_x,
    int64_t center_z,
    int64_t radius_blocks,
    int32_t result_capacity,
    int32_t *result_count,
    struct YocsowBlockPosition *results) {
  int32_t region_size_blocks =
      structure_config->regionSize * 16;

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

  int64_t maximum_distance_squared =
      radius_blocks * radius_blocks;

  *result_count = 0;

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
              seed,
              region_x,
              region_z,
              &candidate)) {
        continue;
      }

      if (distance_squared(
              center_x,
              center_z,
              &candidate) >
          maximum_distance_squared) {
        continue;
      }

      if (*result_count == result_capacity &&
          !candidate_is_better(
              center_x,
              center_z,
              &candidate,
              &results[result_capacity - 1])) {
        continue;
      }

      if (!isViableStructurePos(
              Village,
              generator,
              candidate.x,
              candidate.z,
              0)) {
        continue;
      }

      insert_candidate(
          center_x,
          center_z,
          &candidate,
          result_capacity,
          result_count,
          results);
    }
  }
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

  int32_t result_count = 0;
  struct YocsowBlockPosition position;

  int32_t status =
      yocsow_find_villages(
          minecraft_version,
          seed,
          center_x,
          center_z,
          radius_blocks,
          1,
          &result_count,
          &position);

  if (status != YOCSOW_CUBIOMES_OK ||
      result_count == 0) {
    return status;
  }

  result->found = 1;
  result->x = position.x;
  result->z = position.z;

  return YOCSOW_CUBIOMES_OK;
}

int32_t yocsow_find_villages(
    int32_t minecraft_version,
    int64_t seed,
    int64_t center_x,
    int64_t center_z,
    int64_t radius_blocks,
    int32_t result_capacity,
    int32_t *result_count,
    struct YocsowBlockPosition *results) {
  if (result_count == NULL ||
      results == NULL ||
      result_capacity <= 0 ||
      result_capacity > YOCSOW_MAX_VILLAGE_RESULTS) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
  }

  *result_count = 0;

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

  Generator generator;
  setupGenerator(&generator, mc, 0);

  applySeed(
      &generator,
      DIM_OVERWORLD,
      (uint64_t)seed);

  find_villages_with_generator(
      mc,
      (uint64_t)seed,
      &structure_config,
      &generator,
      center_x,
      center_z,
      radius_blocks,
      result_capacity,
      result_count,
      results);

  return YOCSOW_CUBIOMES_OK;
}

int32_t yocsow_find_villages_batch(
    int32_t minecraft_version,
    int64_t first_seed,
    int32_t seed_count,
    const struct YocsowVillageSearchArea *search_areas,
    int32_t search_area_count,
    int32_t result_capacity,
    int64_t result_count_capacity,
    int32_t *result_counts,
    int64_t result_position_capacity,
    struct YocsowBlockPosition *results) {
  if (search_areas == NULL ||
      result_counts == NULL ||
      results == NULL ||
      seed_count <= 0 ||
      seed_count > YOCSOW_MAX_VILLAGE_BATCH_SEEDS ||
      search_area_count <= 0 ||
      search_area_count >
          YOCSOW_MAX_VILLAGE_SEARCH_AREAS ||
      result_capacity <= 0 ||
      result_capacity > YOCSOW_MAX_VILLAGE_RESULTS ||
      result_count_capacity < 0 ||
      result_position_capacity < 0) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
  }

  if (first_seed >
      INT64_MAX - (int64_t)(seed_count - 1)) {
    return YOCSOW_CUBIOMES_OUT_OF_RANGE;
  }

  int mc = cubiomes_version(minecraft_version);

  if (mc == MC_UNDEF) {
    return YOCSOW_CUBIOMES_UNSUPPORTED_VERSION;
  }

  for (int32_t search_area_index = 0;
       search_area_index < search_area_count;
       search_area_index++) {
    const struct YocsowVillageSearchArea *search_area =
        &search_areas[search_area_index];

    if (search_area->radius_blocks <= 0) {
      return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
    }

    if (!search_area_is_valid(
            search_area->center_x,
            search_area->center_z,
            search_area->radius_blocks)) {
      return YOCSOW_CUBIOMES_OUT_OF_RANGE;
    }
  }

  int64_t required_result_counts =
      (int64_t)seed_count * search_area_count;

  int64_t required_result_positions =
      required_result_counts * result_capacity;

  if (result_count_capacity < required_result_counts ||
      result_position_capacity <
          required_result_positions) {
    return YOCSOW_CUBIOMES_BUFFER_TOO_SMALL;
  }

  StructureConfig structure_config;

  if (!getStructureConfig(
          Village,
          mc,
          &structure_config)) {
    return YOCSOW_CUBIOMES_UNSUPPORTED_VERSION;
  }

  Generator generator;
  setupGenerator(&generator, mc, 0);

  for (int32_t seed_index = 0;
       seed_index < seed_count;
       seed_index++) {
    uint64_t seed =
        (uint64_t)first_seed +
        (uint64_t)seed_index;

    applySeed(
        &generator,
        DIM_OVERWORLD,
        seed);

    for (int32_t search_area_index = 0;
         search_area_index < search_area_count;
         search_area_index++) {
      int64_t result_count_index =
          (int64_t)seed_index * search_area_count +
          search_area_index;

      int64_t result_position_index =
          result_count_index * result_capacity;

      const struct YocsowVillageSearchArea *search_area =
          &search_areas[search_area_index];

      find_villages_with_generator(
          mc,
          seed,
          &structure_config,
          &generator,
          search_area->center_x,
          search_area->center_z,
          search_area->radius_blocks,
          result_capacity,
          &result_counts[result_count_index],
          &results[result_position_index]);
    }
  }

  return YOCSOW_CUBIOMES_OK;
}
