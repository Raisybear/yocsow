#!/usr/bin/env bash

set -euo pipefail

failure=0

check_version() {
    local tool="$1"
    local expected="$2"
    local actual="$3"

    if [[ "$actual" == *"$expected"* ]]; then
        printf 'OK   %-8s %s\n' "$tool" "$actual"
    else
        printf 'FAIL %-8s expected %s, got %s\n' "$tool" "$expected" "$actual"
        failure=1
    fi
}

check_version "Java" "21.0.12.1" "$(java --version 2>&1 | head -n 1)"
check_version "Node" "v24.20.0" "$(node --version)"
check_version "npm" "11.19.0" "$(npm --version)"
check_version "Rust" "rustc 1.98.0" "$(rustc --version)"
check_version "Cargo" "cargo 1.98.0" "$(cargo --version)"

exit "$failure"
