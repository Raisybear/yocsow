# YOCSOW

YOCSOW is a local-first desktop application for Minecraft: Java Edition. It aims to help users analyze seeds, define world constraints, arrange structures in a visual 2D/3D editor, and export playable custom worlds.

> Status: Pre-alpha. The architecture and development environment are currently being established.

## Project goals

- Analyze Minecraft seeds and world-generation data.
- Search for seeds using biome and structure constraints.
- Save editable projects in a versioned, text-based format.
- Arrange supported structures in a visual editor.
- Generate and export playable Minecraft worlds.
- Add optional community world sharing at a later stage.

## Repository structure

| Path | Purpose |
|---|---|
| `apps/desktop` | Tauri, React and TypeScript desktop application |
| `engine` | Java-based Minecraft seed and world-generation engine |
| `docs/architecture` | Architecture documentation and decisions |
| `docs/development` | Development environment and workflow documentation |
| `scripts` | Reproducible setup, build and verification scripts |
| `.github/workflows` | Continuous integration and release workflows |

## Development

The project is developed and tested on Windows and Linux through WSL2. Tool versions and setup instructions are documented under `docs/development`.

## License

No license has been granted yet. The repository remains private during early development.

## Disclaimer

YOCSOW is an independent project and is not affiliated with or endorsed by Mojang Studios or Microsoft.
