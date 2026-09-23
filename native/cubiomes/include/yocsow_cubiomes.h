#ifndef YOCSOW_CUBIOMES_H
#define YOCSOW_CUBIOMES_H

#include <stdint.h>

#if defined(_WIN32)
#if defined(YOCSOW_CUBIOMES_BUILD)
#define YOCSOW_CUBIOMES_API __declspec(dllexport)
#else
#define YOCSOW_CUBIOMES_API __declspec(dllimport)
#endif
#else
#define YOCSOW_CUBIOMES_API \
  __attribute__((visibility("default")))
#endif

#ifdef __cplusplus
extern "C" {
#endif

enum YocsowCubiomesStatus {
  YOCSOW_CUBIOMES_OK = 0,
  YOCSOW_CUBIOMES_INVALID_ARGUMENT = 1,
  YOCSOW_CUBIOMES_UNSUPPORTED_VERSION = 2,
  YOCSOW_CUBIOMES_OUT_OF_RANGE = 3,
  YOCSOW_CUBIOMES_BUFFER_TOO_SMALL = 4
};

enum YocsowMinecraftVersion {
  YOCSOW_MC_JAVA_1_21 = 1
};

enum YocsowBiome {
  YOCSOW_BIOME_TAIGA = 1
};

enum YocsowStructure {
  YOCSOW_STRUCTURE_VILLAGE = 1,
  YOCSOW_STRUCTURE_RUINED_PORTAL = 2,
  YOCSOW_STRUCTURE_WOODLAND_MANSION = 3,
  YOCSOW_STRUCTURE_DESERT_TEMPLE = 4
};

enum YocsowResultLimits {
  YOCSOW_MAX_VILLAGE_RESULTS = 64
};

enum YocsowBatchLimits {
  YOCSOW_MAX_VILLAGE_BATCH_SEEDS = 10000,
  YOCSOW_MAX_VILLAGE_SEARCH_AREAS = 32,
  YOCSOW_MAX_VILLAGE_REQUIREMENTS = 32,
  YOCSOW_MAX_SEED_SEARCH_RESULTS = 100,
  YOCSOW_MAX_BIOME_BATCH_SEEDS = 10000,
  YOCSOW_MAX_BIOME_SEARCH_AREAS = 32
};

struct YocsowBlockPosition {
  int32_t x;
  int32_t z;
};

struct YocsowVillageResult {
  int32_t found;
  int32_t x;
  int32_t z;
};

struct YocsowVillageSearchArea {
  int64_t center_x;
  int64_t center_z;
  int64_t radius_blocks;
};

struct YocsowBiomeSearchArea {
  int32_t biome;
  int32_t radius_blocks;
  int64_t center_x;
  int64_t center_z;
};

struct YocsowSeedSearchCandidate {
  int64_t seed;
  int32_t matched_requirement_count;
  int32_t reserved;
};

struct YocsowSeedSearchMatch {
  int32_t found;
  int32_t x;
  int32_t z;
};

YOCSOW_CUBIOMES_API int32_t
yocsow_find_nearest_village(
    int32_t minecraft_version,
    int64_t seed,
    int64_t center_x,
    int64_t center_z,
    int64_t radius_blocks,
    struct YocsowVillageResult *result);

YOCSOW_CUBIOMES_API int32_t
yocsow_find_structures(
    int32_t minecraft_version,
    int32_t structure,
    int64_t seed,
    int64_t center_x,
    int64_t center_z,
    int64_t radius_blocks,
    int32_t result_capacity,
    int32_t *result_count,
    struct YocsowBlockPosition *results);

YOCSOW_CUBIOMES_API int32_t
yocsow_find_villages(
    int32_t minecraft_version,
    int64_t seed,
    int64_t center_x,
    int64_t center_z,
    int64_t radius_blocks,
    int32_t result_capacity,
    int32_t *result_count,
    struct YocsowBlockPosition *results);

/*
 * Searches consecutive signed 64-bit seeds and multiple areas in one call.
 * Counts use [seed][area] order. Positions use
 * [seed][area][result_capacity] order, with unused slots left unspecified.
 * Buffer capacities are measured in elements, not bytes.
 */
YOCSOW_CUBIOMES_API int32_t
yocsow_find_structures_batch(
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
    struct YocsowBlockPosition *results);

YOCSOW_CUBIOMES_API int32_t
yocsow_find_villages_batch(
    int32_t minecraft_version,
    int64_t first_seed,
    int32_t seed_count,
    const struct YocsowVillageSearchArea *search_areas,
    int32_t search_area_count,
    int32_t result_capacity,
    int64_t result_count_capacity,
    int32_t *result_counts,
    int64_t result_position_capacity,
    struct YocsowBlockPosition *results);

/*
 * Checks whether one biome covers the center and eight perimeter samples.
 * The radius therefore represents the requested minimum extent around the
 * target point. Matches use [seed][area] order.
 */
YOCSOW_CUBIOMES_API int32_t
yocsow_matches_biome(
    int32_t minecraft_version,
    int64_t seed,
    int32_t biome,
    int64_t center_x,
    int64_t center_z,
    int32_t radius_blocks,
    int32_t *match);

YOCSOW_CUBIOMES_API int32_t
yocsow_match_biomes_batch(
    int32_t minecraft_version,
    int64_t first_seed,
    int32_t seed_count,
    const struct YocsowBiomeSearchArea *search_areas,
    int32_t search_area_count,
    int64_t match_capacity,
    int32_t *matches);

/*
 * Evaluates consecutive seeds entirely inside the native Cubiomes boundary.
 * Requirements refer to search areas by zero-based index. Candidates are
 * returned in best-first order: match count, average normalized distance,
 * then signed seed. Matches use [candidate][requirement] order.
 * Buffer capacities are measured in elements, not bytes.
 */
YOCSOW_CUBIOMES_API int32_t
yocsow_search_village_seeds(
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
    struct YocsowSeedSearchMatch *matches);

#ifdef __cplusplus
}
#endif

#endif
