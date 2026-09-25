# Minecraft Java version catalog

YOCSOW keeps the selectable Minecraft Java releases in
`config/minecraft-java-releases.json`. The catalog is checked into Git so the
desktop application and every engine layer can use the same deterministic,
offline version list.

## Scope and sources

The catalog contains full Java releases from 1.0.0 onward. Snapshots,
pre-releases, release candidates, Alpha, and Beta versions are excluded.

The primary source is Mojang's launcher manifest:

`https://piston-meta.mojang.com/mc/game/version_manifest_v2.json`

The Minecraft Wiki version history supplements historical releases that the
current launcher manifest omits. These releases are recorded explicitly in
`launcherManifestExceptions`; aliases such as launcher `1.0` versus public
release `1.0.0` are recorded in `launcherAliases`. Historical development
builds marked as releases by the launcher manifest are recorded in
`launcherManifestExclusions`. Do not add an exception, exclusion, or alias
without documenting and reviewing its source.

## Checking for releases

The normal check downloads the Mojang manifest but does not modify files:

```bash
node scripts/update-minecraft-version-catalog.mjs --check
```

For a reproducible or offline check, download the manifest separately and pass
its path:

```bash
node scripts/update-minecraft-version-catalog.mjs \
  --check \
  --manifest /path/to/version_manifest_v2.json
```

## Updating the catalog

Run the explicit write mode and review the resulting diff:

```bash
node scripts/update-minecraft-version-catalog.mjs --write
npm run check:changed
git diff -- config/minecraft-java-releases.json
```

The updater changes only the exact release list, latest release, and Mojang
retrieval date. Existing generation-profile bindings remain unchanged. Every
new release therefore receives its own isolated `pending/java/<release>`
profile until its world-generation behavior is verified.

Never assign a new release to an existing profile merely because its version
number is nearby. A shared profile requires evidence that every seed-finder
behavior used by YOCSOW is equivalent, including biome generation, structure
placement, and biome-dependent structure viability.

## Promoting a generation profile

To promote one or more pending releases:

1. add one entry to `generationProfilePolicy.verifiedProfiles`;
2. select a representative release and an existing backend version;
3. record whether the backend treats the profile as supported or experimental;
4. add reference tests for every affected biome and structure boundary;
5. run change-aware checks, then the complete verification before manual tests.

The catalog tests reject overlapping release groups, duplicate backend
bindings, unknown releases, missing Cubiomes symbols, and accidental fallback
to a neighboring version.
