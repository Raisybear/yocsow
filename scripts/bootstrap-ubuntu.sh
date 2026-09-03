#!/usr/bin/env bash

set -Ee -o pipefail

script_directory="$(
  cd -- "$(dirname -- "${BASH_SOURCE[0]}")"
  pwd
)"
project_root="$(cd -- "$script_directory/.." && pwd)"

cd "$project_root"

fail() {
  printf 'ERROR: %s\n' "$1" >&2
  exit 1
}

printf 'Preparing the YOCSOW Ubuntu development environment.\n'

command -v git >/dev/null 2>&1 ||
  fail "Git is not installed."

command -v dpkg-query >/dev/null 2>&1 ||
  fail "This bootstrap script requires Ubuntu or another Debian-based system."

required_packages=(
  build-essential
  libayatana-appindicator3-dev
  librsvg2-dev
  libssl-dev
  libwebkit2gtk-4.1-dev
  libxdo-dev
)

missing_packages=()

for package in "${required_packages[@]}"; do
  if ! dpkg-query -W -f='${Status}\n' "$package" 2>/dev/null |
    grep -qx 'install ok installed'
  then
    missing_packages+=("$package")
  fi
done

if ((${#missing_packages[@]} > 0)); then
  printf '\nMissing Ubuntu packages:\n' >&2
  printf '  %s\n' "${missing_packages[@]}" >&2

  printf '\nInstall them with:\n\n' >&2
  printf 'sudo apt update\n' >&2
  printf 'sudo apt install -y' >&2
  printf ' %q' "${missing_packages[@]}" >&2
  printf '\n' >&2

  exit 1
fi

sdkman_init="$HOME/.sdkman/bin/sdkman-init.sh"

[[ -r "$sdkman_init" ]] ||
  fail "SDKMAN is not installed. See https://sdkman.io/install"

# shellcheck source=/dev/null
source "$sdkman_init"

command -v sdk >/dev/null 2>&1 ||
  fail "SDKMAN could not be loaded."

export NVM_DIR="${NVM_DIR:-"$HOME/.nvm"}"

[[ -r "$NVM_DIR/nvm.sh" ]] ||
  fail "NVM is not installed. See https://github.com/nvm-sh/nvm"

# shellcheck source=/dev/null
source "$NVM_DIR/nvm.sh"

command -v nvm >/dev/null 2>&1 ||
  fail "NVM could not be loaded."

command -v rustup >/dev/null 2>&1 ||
  fail "rustup is not installed. See https://rustup.rs"

printf '\n==> Install and activate Java\n'
sdk env install
sdk env

printf '\n==> Install and activate Node.js\n'
nvm install
nvm use

printf '\n==> Install and activate Rust\n'
rustc --version
cargo --version

printf '\n==> Install locked Node.js dependencies\n'
npm ci

printf '\n==> Prepare the Gradle Wrapper\n'
./gradlew --version

printf '\n==> Download locked Rust dependencies\n'
cargo fetch \
  --manifest-path apps/desktop/src-tauri/Cargo.toml \
  --locked

printf '\n==> Verify the complete project\n'
./scripts/verify.sh

printf '\nYOCSOW Ubuntu bootstrap completed successfully.\n'
