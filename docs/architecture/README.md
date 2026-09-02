# Architecture

## Design principles

YOCSOW follows these initial principles:

- Local-first: core functionality must work without a hosted service.
- Reproducible: builds and generated results should be deterministic where possible.
- Modular: the desktop interface and Minecraft engine remain separate.
- Versioned: project files and component interfaces use explicit format versions.
- Portable: development and builds must work consistently across supported devices.
- Secure by default: secrets and generated worlds are never committed to Git.

## Components

| Component | Technology | Responsibility |
|---|---|---|
| Desktop UI | React and TypeScript | Editor, visualization and user interaction |
| Desktop runtime | Tauri and Rust | Native window, filesystem access and process orchestration |
| Minecraft engine | Java 21 | Seed analysis, constraints, world data and generation logic |
| Community services | Deferred | Optional upload and download features after the local MVP |

## Boundaries

- The desktop UI must not contain Minecraft world-generation logic.
- The Java engine must not depend on a graphical user interface.
- Communication between the desktop runtime and engine must use a documented, versioned contract.
- Generated worlds, caches and exports remain outside version control.
- Online services are optional and must not be required for local projects.

## Architecture decisions

Significant technical decisions will be recorded as Architecture Decision Records under `docs/architecture/decisions`.
