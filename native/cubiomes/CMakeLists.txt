set(
  CUBIOMES_SOURCE_DIRECTORY
  "${CMAKE_CURRENT_SOURCE_DIR}/../../third_party/cubiomes"
)

set(
  CUBIOMES_SOURCES
  "${CUBIOMES_SOURCE_DIRECTORY}/biomenoise.c"
  "${CUBIOMES_SOURCE_DIRECTORY}/biomes.c"
  "${CUBIOMES_SOURCE_DIRECTORY}/finders.c"
  "${CUBIOMES_SOURCE_DIRECTORY}/generator.c"
  "${CUBIOMES_SOURCE_DIRECTORY}/layers.c"
  "${CUBIOMES_SOURCE_DIRECTORY}/noise.c"
  "${CUBIOMES_SOURCE_DIRECTORY}/util.c"
)

add_library(
  cubiomes_vendor
  OBJECT
  ${CUBIOMES_SOURCES}
)

target_include_directories(
  cubiomes_vendor
  PRIVATE
  "${CUBIOMES_SOURCE_DIRECTORY}"
)

target_compile_features(
  cubiomes_vendor
  PRIVATE
  c_std_11
)

set_target_properties(
  cubiomes_vendor
  PROPERTIES
  POSITION_INDEPENDENT_CODE ON
  C_VISIBILITY_PRESET hidden
)

add_library(
  yocsow_cubiomes
  SHARED
  src/yocsow_cubiomes.c
  $<TARGET_OBJECTS:cubiomes_vendor>
)

target_include_directories(
  yocsow_cubiomes
  PUBLIC
  "${CMAKE_CURRENT_SOURCE_DIR}/include"
  PRIVATE
  "${CUBIOMES_SOURCE_DIRECTORY}"
)

target_compile_features(
  yocsow_cubiomes
  PRIVATE
  c_std_11
)

target_compile_definitions(
  yocsow_cubiomes
  PRIVATE
  YOCSOW_CUBIOMES_BUILD
)

set_target_properties(
  yocsow_cubiomes
  PROPERTIES
  OUTPUT_NAME yocsow_cubiomes
  C_VISIBILITY_PRESET hidden
)

if(MSVC)
  target_compile_options(
    yocsow_cubiomes
    PRIVATE
    /W4
  )
else()
  target_compile_options(
    cubiomes_vendor
    PRIVATE
    -fwrapv
  )

  target_compile_options(
    yocsow_cubiomes
    PRIVATE
    -Wall
    -Wextra
    -Wpedantic
    -fwrapv
  )

  target_link_libraries(
    yocsow_cubiomes
    PRIVATE
    m
  )
endif()

if(BUILD_TESTING)
  add_executable(
    yocsow_cubiomes_test
    tests/yocsow_cubiomes_test.c
  )

  target_link_libraries(
    yocsow_cubiomes_test
    PRIVATE
    yocsow_cubiomes
  )

  target_compile_features(
    yocsow_cubiomes_test
    PRIVATE
    c_std_11
  )

  if(MSVC)
    target_compile_options(
      yocsow_cubiomes_test
      PRIVATE
      /W4
    )
  else()
    target_compile_options(
      yocsow_cubiomes_test
      PRIVATE
      -Wall
      -Wextra
      -Wpedantic
    )
  endif()

  add_test(
    NAME native.cubiomes
    COMMAND yocsow_cubiomes_test
  )
endif()