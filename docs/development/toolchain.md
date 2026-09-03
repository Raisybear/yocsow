# Development toolchain

Last reviewed: 2026-09-03

## Supported environment

The primary Linux development environment is Ubuntu 24.04 LTS running on
WSL2.

Native Windows installers and platform-specific release artifacts are built
and tested separately on Windows.

## Target versions

| Tool | Version | Version source |
|---|---:|---|
| Ubuntu | 24.04 LTS | WSL distribution |
| Java | Eclipse Temurin 21.0.12.1+1 LTS | `.sdkmanrc` and Gradle toolchain |
| Gradle | 9.7.1 | Gradle Wrapper |
| Node.js | 24.20.0 LTS | `.nvmrc` |
| npm | 11.19.0 | Node.js distribution |
| Rust | 1.98.0 | `rust-toolchain.toml` |
| Tauri CLI | 2.11.4 | `package-lock.json` |
| Tauri API | 2.11.1 | `package-lock.json` |
| Tauri Rust crate | 2.11.5 | `Cargo.lock` |
| React | 19.2.8 | `package-lock.json` |
| Vite | 8.2.2 | `package-lock.json` |
| TypeScript | 6.0.3 | `package-lock.json` |
| Vitest | 4.1.11 | `package-lock.json` |

Spring Boot is reserved for possible future service components. It is not
currently part of the build, and no Spring Boot version is pinned yet.

## Versioning rules

- Developers must use the versions declared by the repository.
- Gradle must be executed through the included Gradle Wrapper.
- Java compilation must use the configured Java 21 toolchain.
- Node dependencies must be installed from the committed npm lockfile.
- Rust must use the toolchain declared in `rust-toolchain.toml`.
- Rust dependencies must be resolved from the committed `Cargo.lock`.
- Dependency upgrades require a separate commit and successful verification.
- Generated build directories must not be committed.

## Preparing a working copy

Activate the repository-specific Java and Node.js versions:

```bash
sdk env
nvm install
nvm use
```

Install the locked Node.js dependencies:

```bash
npm ci
```

The Gradle Wrapper and Cargo download their locked dependencies when first
executed.

## Toolchain verification

To verify only the installed development tools and their versions, run:

```bash
./scripts/verify-toolchain.sh
```

## Full project verification

To run frontend linting, frontend tests, frontend compilation, Java checks,
Rust formatting, Rust linting, Rust compilation, and Rust tests, run:

```bash
./scripts/verify.sh
```

This is the standard local verification command before committing or pushing
changes.

## Native desktop development

Start the Tauri desktop application in development mode:

```bash
npm run dev:desktop:native
```

Create an optimized native binary without packaging an installer:

```bash
npm run build:desktop:native -- --no-bundle
```

Platform-specific installers will be produced later through dedicated release
workflows.

## Continuous integration

GitHub Actions installs the required Linux dependencies and executes the same
project verification script:

```bash
./scripts/verify.sh
```

The workflow is defined in `.github/workflows/toolchain.yml`.
