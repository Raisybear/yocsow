#include "yocsow_cubiomes.h"

#include "finders.h"

#include <math.h>
#include <stdint.h>
#include <string.h>

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

static int cubiomes_biome(int32_t biome) {
  switch (biome) {
    case YOCSOW_BIOME_TAIGA:
      return taiga;
    default:
      return none;
  }
}

static int cubiomes_structure(int32_t structure) {
  switch (structure) {
    case YOCSOW_STRUCTURE_VILLAGE:
      return Village;
    case YOCSOW_STRUCTURE_RUINED_PORTAL:
      return Ruined_Portal;
    case YOCSOW_STRUCTURE_WOODLAND_MANSION:
      return Mansion;
    case YOCSOW_STRUCTURE_DESERT_TEMPLE:
      return Desert_Pyramid;
    default:
      return -1;
  }
}

static int biome_matches_with_generator(
    const Generator *generator,
    int biome,
    int64_t center_x,
    int64_t center_z,
    int32_t radius_blocks) {
  static const int32_t SAMPLE_OFFSETS[9][2] = {
      {0, 0},
      {-1, -1}, {0, -1}, {1, -1},
      {-1, 0},             {1, 0},
      {-1, 1},  {0, 1},   {1, 1}};

  for (int32_t index = 0; index < 9; index++) {
    int32_t x = (int32_t)(center_x +
        (int64_t)SAMPLE_OFFSETS[index][0] * radius_blocks);
    int32_t z = (int32_t)(center_z +
        (int64_t)SAMPLE_OFFSETS[index][1] * radius_blocks);

    if (getBiomeAt(generator, 1, x, 64, z) != biome) {
      return 0;
    }
  }

  return 1;
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

static void find_structures_with_generator(
    int structure_type,
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
              structure_type,
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
              structure_type,
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

struct SeedAssignmentState {
  int32_t requirement_count;
  const int32_t *requirement_search_area_indexes;
  const int32_t *candidate_counts;
  const struct YocsowBlockPosition *candidate_positions;
  int32_t *assignment_found;
  struct YocsowBlockPosition *assignments;
  int32_t visited_count;
  struct YocsowBlockPosition *visited_positions;
};

static int positions_are_equal(
    const struct YocsowBlockPosition *first,
    const struct YocsowBlockPosition *second) {
  return first->x == second->x &&
         first->z == second->z;
}

static int position_was_visited(
    struct SeedAssignmentState *state,
    const struct YocsowBlockPosition *position) {
  for (int32_t index = 0;
       index < state->visited_count;
       index++) {
    if (positions_are_equal(
            &state->visited_positions[index],
            position)) {
      return 1;
    }
  }

  state->visited_positions[state->visited_count] =
      *position;

  state->visited_count++;
  return 0;
}

static int32_t find_position_owner(
    const struct SeedAssignmentState *state,
    const struct YocsowBlockPosition *position) {
  for (int32_t requirement_index = 0;
       requirement_index < state->requirement_count;
       requirement_index++) {
    if (state->assignment_found[requirement_index] &&
        positions_are_equal(
            &state->assignments[requirement_index],
            position)) {
      return requirement_index;
    }
  }

  return -1;
}

static int assign_requirement(
    int32_t requirement_index,
    struct SeedAssignmentState *state) {
  int32_t search_area_index =
      state->requirement_search_area_indexes
          [requirement_index];

  int32_t candidate_count =
      state->candidate_counts[search_area_index];

  const struct YocsowBlockPosition *candidates =
      &state->candidate_positions
          [search_area_index *
           YOCSOW_MAX_VILLAGE_REQUIREMENTS];

  for (int32_t candidate_index = 0;
       candidate_index < candidate_count;
       candidate_index++) {
    const struct YocsowBlockPosition *candidate =
        &candidates[candidate_index];

    if (position_was_visited(state, candidate)) {
      continue;
    }

    int32_t current_owner =
        find_position_owner(state, candidate);

    if (current_owner < 0 ||
        assign_requirement(current_owner, state)) {
      state->assignment_found[requirement_index] = 1;
      state->assignments[requirement_index] =
          *candidate;

      return 1;
    }
  }

  return 0;
}

static void sort_requirement_indexes(
    int32_t requirement_count,
    const int32_t *requirement_search_area_indexes,
    const int32_t *candidate_counts,
    int32_t *requirement_indexes) {
  for (int32_t index = 0;
       index < requirement_count;
       index++) {
    requirement_indexes[index] = index;
  }

  for (int32_t index = 1;
       index < requirement_count;
       index++) {
    int32_t requirement_index =
        requirement_indexes[index];

    int32_t search_area_index =
        requirement_search_area_indexes
            [requirement_index];

    int32_t candidate_count =
        candidate_counts[search_area_index];

    int32_t insertion_index = index;

    while (insertion_index > 0) {
      int32_t previous_requirement_index =
          requirement_indexes
              [insertion_index - 1];

      int32_t previous_search_area_index =
          requirement_search_area_indexes
              [previous_requirement_index];

      int32_t previous_candidate_count =
          candidate_counts
              [previous_search_area_index];

      if (previous_candidate_count <
              candidate_count ||
          (previous_candidate_count ==
               candidate_count &&
           previous_requirement_index <
               requirement_index)) {
        break;
      }

      requirement_indexes[insertion_index] =
          previous_requirement_index;

      insertion_index--;
    }

    requirement_indexes[insertion_index] =
        requirement_index;
  }
}

static double average_normalized_distance(
    int32_t requirement_count,
    const int32_t *requirement_search_area_indexes,
    const struct YocsowVillageSearchArea *search_areas,
    const int32_t *assignment_found,
    const struct YocsowBlockPosition *assignments) {
  double normalized_distance_sum = 0;
  int32_t matched_requirement_count = 0;

  for (int32_t requirement_index = 0;
       requirement_index < requirement_count;
       requirement_index++) {
    if (!assignment_found[requirement_index]) {
      continue;
    }

    int32_t search_area_index =
        requirement_search_area_indexes
            [requirement_index];

    const struct YocsowVillageSearchArea *search_area =
        &search_areas[search_area_index];

    double delta_x =
        (double)assignments[requirement_index].x -
        search_area->center_x;

    double delta_z =
        (double)assignments[requirement_index].z -
        search_area->center_z;

    normalized_distance_sum +=
        hypot(delta_x, delta_z) /
        search_area->radius_blocks;

    matched_requirement_count++;
  }

  return normalized_distance_sum /
         matched_requirement_count;
}

static int seed_candidate_is_better(
    int32_t matched_requirement_count,
    double average_distance,
    int64_t seed,
    const struct YocsowSeedSearchCandidate *existing,
    double existing_average_distance) {
  if (matched_requirement_count !=
      existing->matched_requirement_count) {
    return matched_requirement_count >
           existing->matched_requirement_count;
  }

  if (average_distance !=
      existing_average_distance) {
    return average_distance <
           existing_average_distance;
  }

  return seed < existing->seed;
}

static void insert_seed_candidate(
    int64_t seed,
    int32_t requirement_count,
    int32_t matched_requirement_count,
    double average_distance,
    const int32_t *assignment_found,
    const struct YocsowBlockPosition *assignments,
    int32_t result_capacity,
    int32_t *candidate_count,
    struct YocsowSeedSearchCandidate *candidates,
    double *average_distances,
    struct YocsowSeedSearchMatch *matches) {
  int32_t insertion_index = 0;

  while (insertion_index < *candidate_count &&
         !seed_candidate_is_better(
             matched_requirement_count,
             average_distance,
             seed,
             &candidates[insertion_index],
             average_distances[insertion_index])) {
    insertion_index++;
  }

  if (insertion_index >= result_capacity) {
    return;
  }

  int32_t new_count = *candidate_count;

  if (new_count < result_capacity) {
    new_count++;
  }

  int32_t shifted_candidate_count =
      new_count - insertion_index - 1;

  if (shifted_candidate_count > 0) {
    memmove(
        &candidates[insertion_index + 1],
        &candidates[insertion_index],
        (size_t)shifted_candidate_count *
            sizeof(*candidates));

    memmove(
        &average_distances[insertion_index + 1],
        &average_distances[insertion_index],
        (size_t)shifted_candidate_count *
            sizeof(*average_distances));

    memmove(
        &matches
            [(insertion_index + 1) *
             requirement_count],
        &matches
            [insertion_index *
             requirement_count],
        (size_t)shifted_candidate_count *
            requirement_count *
            sizeof(*matches));
  }

  candidates[insertion_index].seed = seed;

  candidates[insertion_index]
      .matched_requirement_count =
      matched_requirement_count;

  candidates[insertion_index].reserved = 0;

  average_distances[insertion_index] =
      average_distance;

  struct YocsowSeedSearchMatch *candidate_matches =
      &matches[insertion_index * requirement_count];

  for (int32_t requirement_index = 0;
       requirement_index < requirement_count;
       requirement_index++) {
    candidate_matches[requirement_index].found =
        assignment_found[requirement_index];

    if (assignment_found[requirement_index]) {
      candidate_matches[requirement_index].x =
          assignments[requirement_index].x;

      candidate_matches[requirement_index].z =
          assignments[requirement_index].z;
    } else {
      candidate_matches[requirement_index].x = 0;
      candidate_matches[requirement_index].z = 0;
    }
  }

  *candidate_count = new_count;
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

int32_t yocsow_find_structures(
    int32_t minecraft_version,
    int32_t structure,
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

  int structure_type = cubiomes_structure(structure);

  if (structure_type < 0) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
  }

  StructureConfig structure_config;

  if (!getStructureConfig(
          structure_type,
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

  find_structures_with_generator(
      structure_type,
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

int32_t yocsow_find_villages(
    int32_t minecraft_version,
    int64_t seed,
    int64_t center_x,
    int64_t center_z,
    int64_t radius_blocks,
    int32_t result_capacity,
    int32_t *result_count,
    struct YocsowBlockPosition *results) {
  return yocsow_find_structures(
      minecraft_version,
      YOCSOW_STRUCTURE_VILLAGE,
      seed,
      center_x,
      center_z,
      radius_blocks,
      result_capacity,
      result_count,
      results);
}

int32_t yocsow_find_structures_batch(
    int32_t minecraft_version,
    int32_t structure,
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

  int structure_type = cubiomes_structure(structure);

  if (structure_type < 0) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
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
          structure_type,
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

      find_structures_with_generator(
          structure_type,
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
  return yocsow_find_structures_batch(
      minecraft_version,
      YOCSOW_STRUCTURE_VILLAGE,
      first_seed,
      seed_count,
      search_areas,
      search_area_count,
      result_capacity,
      result_count_capacity,
      result_counts,
      result_position_capacity,
      results);
}

int32_t yocsow_matches_biome(
    int32_t minecraft_version,
    int64_t seed,
    int32_t biome,
    int64_t center_x,
    int64_t center_z,
    int32_t radius_blocks,
    int32_t *match) {
  if (match == NULL || radius_blocks <= 0) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
  }

  int mc = cubiomes_version(minecraft_version);

  if (mc == MC_UNDEF) {
    return YOCSOW_CUBIOMES_UNSUPPORTED_VERSION;
  }

  int native_biome = cubiomes_biome(biome);

  if (native_biome == none) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
  }

  if (!search_area_is_valid(center_x, center_z, radius_blocks)) {
    return YOCSOW_CUBIOMES_OUT_OF_RANGE;
  }

  Generator generator;
  setupGenerator(&generator, mc, 0);
  applySeed(&generator, DIM_OVERWORLD, (uint64_t)seed);

  *match = biome_matches_with_generator(
      &generator, native_biome, center_x, center_z, radius_blocks);

  return YOCSOW_CUBIOMES_OK;
}

int32_t yocsow_match_biomes_batch(
    int32_t minecraft_version,
    int64_t first_seed,
    int32_t seed_count,
    const struct YocsowBiomeSearchArea *search_areas,
    int32_t search_area_count,
    int64_t match_capacity,
    int32_t *matches) {
  if (search_areas == NULL || matches == NULL ||
      seed_count <= 0 || seed_count > YOCSOW_MAX_BIOME_BATCH_SEEDS ||
      search_area_count <= 0 ||
      search_area_count > YOCSOW_MAX_BIOME_SEARCH_AREAS ||
      match_capacity < 0) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
  }

  if (first_seed > INT64_MAX - (int64_t)(seed_count - 1)) {
    return YOCSOW_CUBIOMES_OUT_OF_RANGE;
  }

  int64_t required_match_capacity =
      (int64_t)seed_count * search_area_count;

  if (match_capacity < required_match_capacity) {
    return YOCSOW_CUBIOMES_BUFFER_TOO_SMALL;
  }

  int mc = cubiomes_version(minecraft_version);

  if (mc == MC_UNDEF) {
    return YOCSOW_CUBIOMES_UNSUPPORTED_VERSION;
  }

  int native_biomes[YOCSOW_MAX_BIOME_SEARCH_AREAS];

  for (int32_t area_index = 0; area_index < search_area_count; area_index++) {
    const struct YocsowBiomeSearchArea *area = &search_areas[area_index];
    native_biomes[area_index] = cubiomes_biome(area->biome);

    if (native_biomes[area_index] == none || area->radius_blocks <= 0) {
      return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
    }

    if (!search_area_is_valid(
            area->center_x, area->center_z, area->radius_blocks)) {
      return YOCSOW_CUBIOMES_OUT_OF_RANGE;
    }
  }

  Generator generator;
  setupGenerator(&generator, mc, 0);

  for (int32_t seed_index = 0; seed_index < seed_count; seed_index++) {
    uint64_t seed = (uint64_t)first_seed + (uint64_t)seed_index;
    applySeed(&generator, DIM_OVERWORLD, seed);

    for (int32_t area_index = 0; area_index < search_area_count; area_index++) {
      const struct YocsowBiomeSearchArea *area = &search_areas[area_index];
      int64_t match_index = (int64_t)seed_index * search_area_count + area_index;

      matches[match_index] = biome_matches_with_generator(
          &generator,
          native_biomes[area_index],
          area->center_x,
          area->center_z,
          area->radius_blocks);
    }
  }

  return YOCSOW_CUBIOMES_OK;
}

int32_t yocsow_search_village_seeds(
    int32_t minecraft_version,
    int64_t first_seed,
    int32_t seed_count,
    const struct YocsowVillageSearchArea *search_areas,
    int32_t search_area_count,
    const int32_t *requirement_search_area_indexes,
    int32_t requirement_count,
    int32_t result_capacity,
    int32_t candidate_capacity,
    int32_t *candidate_count,
    struct YocsowSeedSearchCandidate *candidates,
    int64_t match_capacity,
    struct YocsowSeedSearchMatch *matches) {
  if (search_areas == NULL ||
      requirement_search_area_indexes == NULL ||
      candidate_count == NULL ||
      candidates == NULL ||
      matches == NULL ||
      seed_count <= 0 ||
      seed_count > YOCSOW_MAX_VILLAGE_BATCH_SEEDS ||
      search_area_count <= 0 ||
      search_area_count >
          YOCSOW_MAX_VILLAGE_SEARCH_AREAS ||
      requirement_count <= 0 ||
      requirement_count >
          YOCSOW_MAX_VILLAGE_REQUIREMENTS ||
      result_capacity <= 0 ||
      result_capacity >
          YOCSOW_MAX_SEED_SEARCH_RESULTS ||
      candidate_capacity < 0 ||
      match_capacity < 0) {
    return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
  }

  if (first_seed >
      INT64_MAX - (int64_t)(seed_count - 1)) {
    return YOCSOW_CUBIOMES_OUT_OF_RANGE;
  }

  int64_t required_match_capacity =
      (int64_t)result_capacity *
      requirement_count;

  if (candidate_capacity < result_capacity ||
      match_capacity < required_match_capacity) {
    return YOCSOW_CUBIOMES_BUFFER_TOO_SMALL;
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

  for (int32_t requirement_index = 0;
       requirement_index < requirement_count;
       requirement_index++) {
    int32_t search_area_index =
        requirement_search_area_indexes
            [requirement_index];

    if (search_area_index < 0 ||
        search_area_index >= search_area_count) {
      return YOCSOW_CUBIOMES_INVALID_ARGUMENT;
    }
  }

  StructureConfig structure_config;

  if (!getStructureConfig(
          Village,
          mc,
          &structure_config)) {
    return YOCSOW_CUBIOMES_UNSUPPORTED_VERSION;
  }

  *candidate_count = 0;

  double average_distances
      [YOCSOW_MAX_SEED_SEARCH_RESULTS];

  Generator generator;
  setupGenerator(&generator, mc, 0);

  for (int32_t seed_index = 0;
       seed_index < seed_count;
       seed_index++) {
    int64_t signed_seed =
        first_seed + seed_index;

    uint64_t seed = (uint64_t)signed_seed;

    applySeed(
        &generator,
        DIM_OVERWORLD,
        seed);

    int32_t candidate_counts
        [YOCSOW_MAX_VILLAGE_SEARCH_AREAS] = {0};

    struct YocsowBlockPosition candidate_positions
        [YOCSOW_MAX_VILLAGE_SEARCH_AREAS]
        [YOCSOW_MAX_VILLAGE_REQUIREMENTS];

    for (int32_t search_area_index = 0;
         search_area_index < search_area_count;
         search_area_index++) {
      const struct YocsowVillageSearchArea *search_area =
          &search_areas[search_area_index];

      find_structures_with_generator(
          Village,
          mc,
          seed,
          &structure_config,
          &generator,
          search_area->center_x,
          search_area->center_z,
          search_area->radius_blocks,
          requirement_count,
          &candidate_counts[search_area_index],
          candidate_positions[search_area_index]);
    }

    int32_t requirement_indexes
        [YOCSOW_MAX_VILLAGE_REQUIREMENTS];

    sort_requirement_indexes(
        requirement_count,
        requirement_search_area_indexes,
        candidate_counts,
        requirement_indexes);

    int32_t assignment_found
        [YOCSOW_MAX_VILLAGE_REQUIREMENTS] = {0};

    struct YocsowBlockPosition assignments
        [YOCSOW_MAX_VILLAGE_REQUIREMENTS];

    struct YocsowBlockPosition visited_positions
        [YOCSOW_MAX_VILLAGE_REQUIREMENTS *
         YOCSOW_MAX_VILLAGE_REQUIREMENTS];

    for (int32_t index = 0;
         index < requirement_count;
         index++) {
      struct SeedAssignmentState assignment_state = {
          requirement_count,
          requirement_search_area_indexes,
          candidate_counts,
          &candidate_positions[0][0],
          assignment_found,
          assignments,
          0,
          visited_positions};

      assign_requirement(
          requirement_indexes[index],
          &assignment_state);
    }

    int32_t matched_requirement_count = 0;

    for (int32_t requirement_index = 0;
         requirement_index < requirement_count;
         requirement_index++) {
      matched_requirement_count +=
          assignment_found[requirement_index];
    }

    if (matched_requirement_count == 0) {
      continue;
    }

    double average_distance =
        average_normalized_distance(
            requirement_count,
            requirement_search_area_indexes,
            search_areas,
            assignment_found,
            assignments);

    insert_seed_candidate(
        signed_seed,
        requirement_count,
        matched_requirement_count,
        average_distance,
        assignment_found,
        assignments,
        result_capacity,
        candidate_count,
        candidates,
        average_distances,
        matches);
  }

  return YOCSOW_CUBIOMES_OK;
}
