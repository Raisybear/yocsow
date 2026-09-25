# Testing and verification

YOCSOW uses two verification levels: fast, change-aware checks while code is
being developed and the complete project verification at release gates. This
keeps the edit-test loop short without weakening the checks performed before
manual testing or merging.

## During development

Run the change-aware check before each commit:

```bash
npm run check:changed
```

By default, it examines staged, unstaged, and untracked files in the working
tree. It then selects the smallest safe set of checks:

- changed frontend tests and tests related to changed frontend source files;
- frontend linting and TypeScript compilation for frontend changes;
- matching Rust module tests, formatting, and linting for Tauri changes;
- affected Java modules for Java or engine-bridge changes;
- incremental native configuration, compilation, and tests for C changes;
- whitespace checks for documentation-only changes.

New test files are included directly because untracked files are part of the
selection. If a path cannot be classified safely, the selector falls back to
the full project verification.

Preview the selection without running commands:

```bash
npm run check:changed -- --dry-run
```

To include all commits on the current branch, compare it with a base ref:

```bash
npm run check:changed -- --base origin/main
```

This branch-wide mode is useful for reviewing the final scope. The normal
working-tree mode is preferable between commits because it does not repeatedly
test earlier, already committed work.

## Area checks

Force a complete check for one subsystem when a change has indirect effects or
when additional confidence is useful:

| Command | Scope |
|---|---|
| `npm run check:frontend` | Desktop lint, tests, and production build |
| `npm run check:rust` | Tauri format, lint, compile, and tests |
| `npm run check:java` | Java engine and runner build and tests |
| `npm run check:native` | Native library plus dependent Java modules |

Areas can also be combined directly:

```bash
npm run check:changed -- --area frontend --area rust
```

## Full verification gates

Run the complete project verification:

```bash
./scripts/verify.sh
```

The full suite is required at these points:

1. before starting a manual Linux or Windows application test;
2. after the final change on a branch;
3. before merging a pull request;
4. whenever the change-aware selector chooses its safe fallback.

`npm run check:all` invokes the same full suite through the development check
entry point. On Windows, targeted and area checks can run in the activated
PowerShell environment. Run the authoritative `./scripts/verify.sh` in the
configured WSL development environment, then perform the separate native
Windows test when the change affects cross-platform behavior.

## Maintaining the selector

When adding a new source area or build system, update
`scripts/check-changed.mjs` in the same change. Add a selection test to
`scripts/check-changed.test.mjs`, and keep unknown paths mapped to the full
verification until a narrower dependency boundary is proven safe.

Minecraft release catalog maintenance has its own offline-capable workflow in
[`minecraft-version-catalog.md`](minecraft-version-catalog.md). Catalog and
updater changes run their focused contract tests through `check:changed`.
