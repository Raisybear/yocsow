#!/usr/bin/env bash

set -Eeuo pipefail

script_directory="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
  pwd
)"
project_root="$(cd -- "$script_directory/.." && pwd)"
native_build_directory="$project_root/build/native"
verification_log_directory="$project_root/build/verification-logs"
verification_verbose="${YOCSOW_VERIFY_VERBOSE:-0}"
step_number=0

cd "$project_root"
mkdir -p "$verification_log_directory"

run_step() {
  local label="$1"
  shift

  step_number=$((step_number + 1))

  local log_file
  local status

  printf -v log_file \
    '%s/%02d.log' \
    "$verification_log_directory" \
    "$step_number"

  if [[ "$verification_verbose" == "1" ]]; then
    printf '\n==> %s\n' "$label"

    if "$@" 2>&1 | tee "$log_file"; then
      return
    else
      status=$?
    fi

    printf '\nFAIL %s\n' "$label" >&2
    return "$status"
  fi

  if "$@" >"$log_file" 2>&1; then
    printf 'OK   %s\n' "$label"
    return
  else
    status=$?
  fi

  printf 'FAIL %s\n\n' "$label" >&2
  sed -n '1,$p' "$log_file" >&2
  printf '\nFull log: %s\n' "$log_file" >&2

  return "$status"
}

run_step \
  "Verify toolchain versions" \
  ./scripts/verify-toolchain.sh

run_step \
  "Check working-tree whitespace" \
  git diff --check

run_step \
  "Check staged whitespace" \
  git diff --cached --check

run_step \
  "Test development check selection" \
  npm run test:checks

run_step \
  "Configure native components" \
  cmake \
    --fresh \
    -S native \
    -B "$native_build_directory" \
    -G Ninja \
    -DCMAKE_BUILD_TYPE=Release \
    -DBUILD_TESTING=ON

run_step \
  "Build native components" \
  cmake \
    --build "$native_build_directory" \
    --config Release

run_step \
  "Test native components" \
  ctest \
    --test-dir "$native_build_directory" \
    --build-config Release \
    --output-on-failure

run_step \
  "Lint desktop frontend" \
  npm run lint:desktop

run_step \
  "Test desktop frontend" \
  npm run test:desktop

run_step \
  "Build desktop frontend" \
  npm run build:desktop

run_step \
  "Build and test Java modules" \
  ./gradlew build

run_step \
  "Check Tauri Rust formatting" \
  cargo fmt \
    --manifest-path apps/desktop/src-tauri/Cargo.toml \
    -- \
    --check

run_step \
  "Check Tauri application" \
  cargo check \
    --manifest-path apps/desktop/src-tauri/Cargo.toml \
    --locked

run_step \
  "Lint Tauri Rust" \
  cargo clippy \
    --manifest-path apps/desktop/src-tauri/Cargo.toml \
    --all-targets \
    --locked \
    -- \
    -D warnings

run_step \
  "Test Tauri Rust" \
  cargo test \
    --manifest-path apps/desktop/src-tauri/Cargo.toml \
    --locked

printf '\nAll YOCSOW project checks passed.\n'
printf 'Full logs: %s\n' "$verification_log_directory"
