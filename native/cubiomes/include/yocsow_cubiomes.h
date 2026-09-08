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
  YOCSOW_CUBIOMES_OUT_OF_RANGE = 3
};

enum YocsowMinecraftVersion {
  YOCSOW_MC_JAVA_1_21 = 1
};

struct YocsowVillageResult {
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

#ifdef __cplusplus
}
#endif

#endif