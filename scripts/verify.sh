#!/usr/bin/env bash

set -Eeuo pipefail

script_directory="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
  pwd
)"
project_root="$(cd -- "$script_directory/.." && pwd)"

cd "$project_root"

run_step() {
  local label="$1"
  shift

  printf '\n==> %s\n' "$label"
  "$@"
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
