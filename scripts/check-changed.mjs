#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptPath = fileURLToPath(import.meta.url)
const projectRoot = resolve(dirname(scriptPath), '..')
const desktopRoot = resolve(projectRoot, 'apps/desktop')
const cargoManifest = 'apps/desktop/src-tauri/Cargo.toml'
const nativeBuildDirectory = 'build/native-development'
const supportedAreas = new Set([
  'frontend',
  'rust',
  'java',
  'native',
  'tooling',
])

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/')
}

function uniqueSorted(values) {
  return [...new Set(values)].sort()
}

function step(id, label, command, args, cwd = '.') {
  return { id, label, command, args, cwd }
}

function addFrontendTarget(state, filePath) {
  const desktopPath = filePath.slice('apps/desktop/'.length)

  if (
    desktopPath === 'src/main.tsx' ||
    desktopPath === 'src/index.css' ||
    desktopPath === 'src/test/setup.ts' ||
    !/^src\/.+\.(?:css|ts|tsx)$/.test(desktopPath)
  ) {
    state.frontendFull = true
    return
  }

  if (/\.test\.(?:ts|tsx)$/.test(desktopPath)) {
    state.frontendTests.add(desktopPath)
  } else {
    state.frontendSources.add(desktopPath)
  }
}

function addRustTarget(state, filePath) {
  const sourceMatch = filePath.match(
    /^apps\/desktop\/src-tauri\/src\/([^/]+)\.rs$/,
  )

  if (sourceMatch === null || sourceMatch[1] === 'lib' || sourceMatch[1] === 'main') {
    state.rustFull = true
    return
  }

  state.rustFilters.add(sourceMatch[1])

  if (sourceMatch[1] === 'engine_process' || sourceMatch[1] === 'seed_search') {
    state.javaModules.add('engine')
    state.javaModules.add('engine-runner')
  }
}

function classifyFile(state, rawFilePath) {
  const filePath = normalizePath(rawFilePath)

  if (
    /^(?:README|CONTRIBUTING|THIRD_PARTY_NOTICES)\.md$/.test(filePath) ||
    filePath === 'LICENSE' ||
    filePath.startsWith('docs/') ||
    /^\.(?:editorconfig|gitattributes|gitignore)$/.test(filePath)
  ) {
    state.documentation = true
    return
  }

  if (
    filePath === 'scripts/check-changed.mjs' ||
    filePath === 'scripts/check-changed.test.mjs'
  ) {
    state.tooling = true
    return
  }

  if (filePath === 'package.json' || filePath === 'package-lock.json') {
    state.frontendFull = true
    state.tooling = true
    return
  }

  if (filePath.startsWith('apps/desktop/src-tauri/src/')) {
    addRustTarget(state, filePath)
    return
  }

  if (
    filePath === 'apps/desktop/src-tauri/Cargo.toml' ||
    filePath === 'apps/desktop/src-tauri/Cargo.lock' ||
    filePath === 'apps/desktop/src-tauri/build.rs' ||
    filePath.startsWith('apps/desktop/src-tauri/capabilities/') ||
    filePath.startsWith('apps/desktop/src-tauri/tauri.')
  ) {
    state.rustFull = true
    return
  }

  if (filePath.startsWith('apps/desktop/src/')) {
    addFrontendTarget(state, filePath)
    return
  }

  if (filePath.startsWith('apps/desktop/')) {
    state.frontendFull = true
    return
  }

  if (filePath.startsWith('engine/src/test/')) {
    state.javaModules.add('engine')
    return
  }

  if (filePath.startsWith('engine/')) {
    state.javaModules.add('engine')
    state.javaModules.add('engine-runner')
    return
  }

  if (filePath.startsWith('engine-runner/')) {
    state.javaModules.add('engine-runner')
    return
  }

  if (
    filePath.startsWith('native/') ||
    filePath.startsWith('third_party/cubiomes/')
  ) {
    state.native = true
    state.javaModules.add('engine')
    state.javaModules.add('engine-runner')
    return
  }

  if (
    filePath === 'build.gradle.kts' ||
    filePath === 'settings.gradle.kts' ||
    filePath.startsWith('gradle/') ||
    filePath.startsWith('config/checkstyle/') ||
    filePath === '.sdkmanrc'
  ) {
    state.javaModules.add('engine')
    state.javaModules.add('engine-runner')
    return
  }

  if (filePath === 'rust-toolchain.toml') {
    state.rustFull = true
    return
  }

  if (filePath === '.nvmrc') {
    state.frontendFull = true
    state.tooling = true
    return
  }

  if (filePath.startsWith('.github/') || filePath.startsWith('scripts/')) {
    state.full = true
    state.fullReasons.add(filePath)
    return
  }

  state.full = true
  state.fullReasons.add(filePath)
}

function emptySelection() {
  return {
    documentation: false,
    frontendFull: false,
    frontendSources: new Set(),
    frontendTests: new Set(),
    rustFull: false,
    rustFilters: new Set(),
    javaModules: new Set(),
    native: false,
    tooling: false,
    full: false,
    fullReasons: new Set(),
  }
}

function applyForcedArea(state, area) {
  switch (area) {
    case 'frontend':
      state.frontendFull = true
      break
    case 'rust':
      state.rustFull = true
      break
    case 'java':
      state.javaModules.add('engine')
      state.javaModules.add('engine-runner')
      break
    case 'native':
      state.native = true
      state.javaModules.add('engine')
      state.javaModules.add('engine-runner')
      break
    case 'tooling':
      state.tooling = true
      break
    default:
      throw new Error(`Unsupported check area: ${area}`)
  }
}

function whitespaceSteps() {
  return [
    step(
      'whitespace-working',
      'Check working-tree whitespace',
      'git',
      ['diff', '--check'],
    ),
    step(
      'whitespace-staged',
      'Check staged whitespace',
      'git',
      ['diff', '--cached', '--check'],
    ),
  ]
}

function frontendSteps(state) {
  if (
    !state.frontendFull &&
    state.frontendSources.size === 0 &&
    state.frontendTests.size === 0
  ) {
    return []
  }

  const steps = [
    step('frontend-lint', 'Lint desktop frontend', 'npm', ['run', 'lint'], 'apps/desktop'),
    step(
      'frontend-typecheck',
      'Type-check desktop frontend',
      'npm',
      ['run', 'typecheck'],
      'apps/desktop',
    ),
  ]

  if (state.frontendFull) {
    steps.push(
      step(
        'frontend-test-all',
        'Test desktop frontend',
        'npm',
        ['run', 'test'],
        'apps/desktop',
      ),
      step(
        'frontend-build',
        'Build desktop frontend',
        'npm',
        ['run', 'build'],
        'apps/desktop',
      ),
    )
    return steps
  }

  if (state.frontendTests.size > 0) {
    steps.push(
      step(
        'frontend-test-files',
        'Run changed desktop tests',
        'npm',
        ['run', 'test:files', '--', ...uniqueSorted(state.frontendTests)],
        'apps/desktop',
      ),
    )
  }

  if (state.frontendSources.size > 0) {
    steps.push(
      step(
        'frontend-test-related',
        'Run related desktop tests',
        'npm',
        ['run', 'test:related', '--', ...uniqueSorted(state.frontendSources)],
        'apps/desktop',
      ),
    )
  }

  return steps
}

function nativeSteps(state) {
  if (!state.native) {
    return []
  }

  return [
    step(
      'native-configure',
      'Configure native development checks',
      'cmake',
      [
        '-S',
        'native',
        '-B',
        nativeBuildDirectory,
        '-G',
        'Ninja',
        '-DCMAKE_BUILD_TYPE=Release',
        '-DBUILD_TESTING=ON',
      ],
    ),
    step(
      'native-build',
      'Build changed native components',
      'cmake',
      ['--build', nativeBuildDirectory, '--config', 'Release'],
    ),
    step(
      'native-test',
      'Test native components',
      'ctest',
      [
        '--test-dir',
        nativeBuildDirectory,
        '--build-config',
        'Release',
        '--output-on-failure',
      ],
    ),
  ]
}

function javaSteps(state) {
  if (state.javaModules.size === 0) {
    return []
  }

  const tasks = uniqueSorted(state.javaModules).map(
    (moduleName) => `:${moduleName}:check`,
  )
  const command = process.platform === 'win32' ? 'cmd.exe' : './gradlew'
  const args =
    process.platform === 'win32'
      ? ['/d', '/s', '/c', 'gradlew.bat', ...tasks]
      : tasks

  return [
    step(
      'java-check',
      `Check Java modules: ${uniqueSorted(state.javaModules).join(', ')}`,
      command,
      args,
    ),
  ]
}

function rustSteps(state) {
  if (!state.rustFull && state.rustFilters.size === 0) {
    return []
  }

  const commonManifestArguments = ['--manifest-path', cargoManifest, '--locked']
  const steps = [
    step(
      'rust-format',
      'Check Tauri Rust formatting',
      'cargo',
      ['fmt', '--manifest-path', cargoManifest, '--', '--check'],
    ),
    step(
      'rust-lint',
      'Lint Tauri Rust targets',
      'cargo',
      ['clippy', ...commonManifestArguments, '--all-targets', '--', '-D', 'warnings'],
    ),
  ]

  if (state.rustFull) {
    steps.push(
      step(
        'rust-check',
        'Check Tauri application',
        'cargo',
        ['check', ...commonManifestArguments],
      ),
      step(
        'rust-test-all',
        'Test Tauri Rust',
        'cargo',
        ['test', ...commonManifestArguments],
      ),
    )
    return steps
  }

  for (const filter of uniqueSorted(state.rustFilters)) {
    steps.push(
      step(
        `rust-test-${filter}`,
        `Test Tauri Rust module: ${filter}`,
        'cargo',
        ['test', ...commonManifestArguments, filter],
      ),
    )
  }

  return steps
}

export function createCheckPlan(
  changedFiles,
  { areas = [], all = false } = {},
) {
  const normalizedFiles = uniqueSorted(changedFiles.map(normalizePath))
  const state = emptySelection()

  for (const filePath of normalizedFiles) {
    classifyFile(state, filePath)
  }

  for (const area of areas) {
    applyForcedArea(state, area)
  }

  if (all) {
    state.full = true
    state.fullReasons.add('--all')
  }

  if (state.full) {
    return {
      changedFiles: normalizedFiles,
      mode: 'full',
      reasons: uniqueSorted(state.fullReasons),
      steps: [
        step(
          'full-verification',
          'Run full YOCSOW verification',
          'bash',
          ['scripts/verify.sh'],
        ),
      ],
    }
  }

  const hasSelection =
    state.documentation ||
    state.frontendFull ||
    state.frontendSources.size > 0 ||
    state.frontendTests.size > 0 ||
    state.rustFull ||
    state.rustFilters.size > 0 ||
    state.javaModules.size > 0 ||
    state.native ||
    state.tooling

  if (!hasSelection) {
    return {
      changedFiles: normalizedFiles,
      mode: 'none',
      reasons: [],
      steps: [],
    }
  }

  const selectedSteps = [
    ...whitespaceSteps(),
    ...(state.tooling
      ? [
          step(
            'tooling-test',
            'Test development check selection',
            'node',
            [
              '--test',
              '--test-isolation=none',
              'scripts/check-changed.test.mjs',
            ],
          ),
        ]
      : []),
    ...nativeSteps(state),
    ...frontendSteps(state),
    ...javaSteps(state),
    ...rustSteps(state),
  ]

  return {
    changedFiles: normalizedFiles,
    mode: 'targeted',
    reasons: [],
    steps: selectedSteps,
  }
}

function runGit(args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, {
    cwd: projectRoot,
    encoding: 'utf8',
    windowsHide: true,
  })

  if (result.error !== undefined) {
    throw result.error
  }

  if (result.status !== 0) {
    if (allowFailure) {
      return undefined
    }

    const details = result.stderr?.trim() || result.stdout?.trim()
    throw new Error(details || `git ${args.join(' ')} failed`)
  }

  return result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function collectChangedFiles(baseReference) {
  const files = new Set([
    ...runGit(['diff', '--name-only', '--diff-filter=ACMRD', 'HEAD']),
    ...runGit(['ls-files', '--others', '--exclude-standard']),
  ])

  if (baseReference === undefined) {
    return uniqueSorted(files)
  }

  const verifiedBase = runGit(
    ['rev-parse', '--verify', '--quiet', `${baseReference}^{commit}`],
    { allowFailure: true },
  )

  if (verifiedBase !== undefined) {
    const mergeBase = runGit(['merge-base', 'HEAD', baseReference])[0]

    for (const filePath of runGit([
      'diff',
      '--name-only',
      '--diff-filter=ACMRD',
      `${mergeBase}...HEAD`,
    ])) {
      files.add(filePath)
    }
  } else {
    console.warn(
      `Base reference ${baseReference} is unavailable; checking working-tree changes only.`,
    )
  }

  return uniqueSorted(files)
}

function parseArguments(args) {
  const options = {
    all: false,
    areas: [],
    base: process.env.YOCSOW_CHECK_BASE || undefined,
    dryRun: false,
  }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    switch (argument) {
      case '--all':
        options.all = true
        break
      case '--area': {
        const area = args[++index]

        if (area === undefined || !supportedAreas.has(area)) {
          throw new Error(
            `--area expects one of: ${[...supportedAreas].join(', ')}`,
          )
        }

        options.areas.push(area)
        break
      }
      case '--base':
        options.base = args[++index]
        if (options.base === undefined) {
          throw new Error('--base expects a Git reference')
        }
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`Unknown argument: ${argument}`)
    }
  }

  return options
}

function printHelp() {
  console.log(`Usage: npm run check:changed -- [options]

Options:
  --dry-run             Print the selected checks without running them
  --base <ref>          Also check committed changes since the merge-base
  --area <name>         Force a complete area check; may be repeated
  --all                 Run the full verification suite
  -h, --help            Show this help

Areas: ${[...supportedAreas].join(', ')}`)
}

function displayPath(filePath) {
  return normalizePath(relative(projectRoot, resolve(projectRoot, filePath)))
}

function printPlan(plan, options) {
  console.log('\nYOCSOW development check')
  console.log(`Scope: ${options.base === undefined ? 'working tree' : `working tree and ${options.base}...HEAD`}`)

  if (plan.changedFiles.length > 0) {
    console.log('Changed files:')
    for (const filePath of plan.changedFiles) {
      console.log(`- ${displayPath(filePath)}`)
    }
  } else if (options.areas.length === 0 && !options.all) {
    console.log('No changed files found.')
  }

  if (plan.mode === 'full') {
    console.log(
      `Mode: full${plan.reasons.length > 0 ? ` (${plan.reasons.join(', ')})` : ''}`,
    )
  } else {
    console.log(`Mode: ${plan.mode}`)
  }

  if (plan.steps.length > 0) {
    console.log('Selected checks:')
    for (const selectedStep of plan.steps) {
      console.log(`- ${selectedStep.label}`)
    }
  }
}

function executable(command) {
  if (process.platform !== 'win32') {
    return command
  }

  if (command === 'npm') {
    return 'npm.cmd'
  }

  return command
}

function runStep(selectedStep) {
  console.log(`\n==> ${selectedStep.label}`)

  const result = spawnSync(
    executable(selectedStep.command),
    selectedStep.args,
    {
      cwd: resolve(projectRoot, selectedStep.cwd),
      env: process.env,
      stdio: 'inherit',
      windowsHide: true,
    },
  )

  if (result.error !== undefined) {
    throw result.error
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
}

function main() {
  const options = parseArguments(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const changedFiles = collectChangedFiles(options.base)
  const plan = createCheckPlan(changedFiles, options)
  printPlan(plan, options)

  if (plan.steps.length === 0) {
    console.log('No checks are required.')
    return
  }

  if (options.dryRun) {
    console.log('Dry run complete.')
    return
  }

  for (const selectedStep of plan.steps) {
    runStep(selectedStep)
  }

  console.log('\nAll selected YOCSOW checks passed.')
}

if (resolve(process.argv[1] || '') === scriptPath) {
  try {
    main()
  } catch (error) {
    console.error(`\nDevelopment check failed: ${error.message}`)
    process.exit(1)
  }
}
