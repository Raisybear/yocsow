# Development toolchain

Last reviewed: 2026-09-02

## Target versions

| Tool | Version | Version source |
|---|---:|---|
| Ubuntu | 24.04 LTS | WSL distribution |
| Java | Eclipse Temurin 21 LTS | Java toolchain configuration |
| Spring Boot | 4.1.1 | Gradle plugin |
| Gradle | 9.7.1 | Gradle Wrapper |
| Node.js | 24.20.0 LTS | `.nvmrc` |
| Rust | 1.98.0 | `rust-toolchain.toml` |
| Tauri | 2.x | `Cargo.lock` and npm lockfile |
| React | Selected during desktop initialization | npm lockfile |
| Vite | Selected during desktop initialization | npm lockfile |

Spring Boot is reserved for future service components. The initial Java engine will remain independent from Spring Boot.

## Compatibility

- Spring Boot 4.1.1 supports Java 17 through Java 26.
- Spring Boot 4.1.1 supports Gradle 8.14 or later and Gradle 9.x.
- Gradle 9.7.1 can run on Java 21.
- Node.js 24 is an LTS release.
- Rust 1.98.0 is the selected stable Rust toolchain.

## Versioning rules

- Developers must use the versions declared by the repository.
- Gradle must be executed through the included Gradle Wrapper.
- Java compilation must use a Java 21 toolchain.
- Node dependencies must be installed from the committed lockfile.
- Rust dependencies must be resolved from the committed `Cargo.lock`.
- Dependency upgrades require a separate commit and successful automated tests.
