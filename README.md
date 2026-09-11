# YOCSOW

YOCSOW is a local-first desktop application for Minecraft: Java Edition. It aims to help users analyze seeds, define world constraints, arrange structures in a visual 2D/3D editor, and export playable custom worlds.

> Status: Pre-alpha. YOCSOW is under active development and interfaces, project formats, and features may change.

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

The primary development environment is Ubuntu 24.04 LTS running through WSL2.

- [Ubuntu and WSL setup](docs/development/ubuntu-setup.md)
- [Pinned development toolchain](docs/development/toolchain.md)

After installing the required system tools, prepare a new working copy with:

```bash
git clone git@github.com:Raisybear/yocsow.git
cd yocsow
./scripts/bootstrap-ubuntu.sh
```

Start the native desktop application:

```bash
npm run dev:desktop:native
```

Run all project checks before committing or pushing:

```bash
./scripts/verify.sh
```

## License

Copyright (C) 2026 Elias Spycher.

Except for third-party components identified in this repository, YOCSOW is
licensed under the GNU General Public License version 3 only
(`GPL-3.0-only`). See [LICENSE](LICENSE).

Official YOCSOW releases are provided free of charge. The GNU GPL permits
third parties to redistribute the software commercially, provided that they
comply with all GPL requirements, including providing the corresponding
source code under the same license.

Third-party components remain subject to their respective licenses. In
particular, Cubiomes is distributed under the MIT License; see
[`third_party/cubiomes/LICENSE`](third_party/cubiomes/LICENSE).

## Disclaimer

YOCSOW is an independent project and is not affiliated with or endorsed by
Mojang Studios or Microsoft.
