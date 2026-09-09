import { spawnSync } from 'node:child_process'
import {
  chmodSync,
  cpSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENGINE_MAIN_CLASS =
  'io.github.raisybear.yocsow.runner.EngineRunner'
const RUNTIME_MODULES = [
  'java.base',
  'java.desktop',
  'java.sql',
  'jdk.unsupported',
]

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')
const runnerDistribution = resolve(
  projectRoot,
  'engine-runner/build/install/engine-runner',
)
const runnerLibraries = join(runnerDistribution, 'lib')
const resourcesDirectory = resolve(
  projectRoot,
  'apps/desktop/src-tauri/resources',
)
const generatedDirectory = join(resourcesDirectory, 'generated')
const bundledRunnerDirectory = join(generatedDirectory, 'engine-runner')
const bundledLibraries = join(bundledRunnerDirectory, 'lib')
const bundledRuntime = join(generatedDirectory, 'java-runtime')

function fail(message) {
  throw new Error(message)
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    ...options,
  })

  if (result.error) {
    throw result.error
  }

  if (result.status === null) {
    fail(
      `${command} terminated without an exit code${
        result.signal === null ? '' : ` (${result.signal})`
      }`,
    )
  }

  if (result.status !== 0) {
    fail(`${command} failed with exit code ${result.status}`)
  }

  return result
}

function requireFile(path, label) {
  if (!existsSync(path)) {
    fail(`${label} was not found at ${path}`)
  }
}

function makeTreeOwnerWritable(root) {
  const pendingPaths = [root]

  while (pendingPaths.length > 0) {
    const currentPath = pendingPaths.pop()
    const metadata = lstatSync(currentPath)

    if (metadata.isSymbolicLink()) {
      continue
    }

    chmodSync(
      currentPath,
      metadata.mode | (metadata.isDirectory() ? 0o700 : 0o200),
    )

    if (metadata.isDirectory()) {
      for (const entry of readdirSync(currentPath)) {
        pendingPaths.push(join(currentPath, entry))
      }
    }
  }
}

function parseResponseLines(output) {
  const lines = output
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length !== 3) {
    fail(`engine smoke test returned ${lines.length} responses; expected 3`)
  }

  return lines.map((line) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      fail(`engine smoke test returned invalid JSON: ${error.message}`)
    }
  })
}

function verifySmokeTest(responses) {
  for (const [index, response] of responses.entries()) {
    const expectedId = index + 1

    if (response.jsonrpc !== '2.0' || response.id !== expectedId) {
      fail(`engine smoke test returned an invalid response for ID ${expectedId}`)
    }

    if (response.error !== undefined) {
      fail(
        `engine smoke test failed for ID ${expectedId}: ${JSON.stringify(
          response.error,
        )}`,
      )
    }
  }

  const initializeResult = responses[0].result
  if (
    initializeResult?.protocolVersion !== 1 ||
    !initializeResult.capabilities?.includes('seed.search')
  ) {
    fail('bundled engine did not initialize with the expected protocol')
  }

  if (responses[1].result?.status !== 'ok') {
    fail('bundled engine health check did not return ok')
  }

  if (responses[2].result?.searchedSeedCount !== 1) {
    fail('bundled engine seed-search smoke test did not search one seed')
  }
}

const javaHome = process.env.JAVA_HOME
if (!javaHome) {
  fail('JAVA_HOME must point to a Java 21 JDK')
}

const javaReleaseFile = join(javaHome, 'release')
requireFile(javaReleaseFile, 'Java release metadata')

const javaRelease = readFileSync(javaReleaseFile, 'utf8')
if (!/^JAVA_VERSION="21(?:[.]|")/m.test(javaRelease)) {
  fail(`JAVA_HOME must point to a Java 21 JDK; found ${javaHome}`)
}

const windows = process.platform === 'win32'
const jlinkExecutable = join(javaHome, 'bin', windows ? 'jlink.exe' : 'jlink')
requireFile(jlinkExecutable, 'jlink executable')

run(process.execPath, [join(scriptDirectory, 'prepare-engine-runner.mjs')])

if (!existsSync(runnerLibraries)) {
  fail(`engine runner libraries were not generated at ${runnerLibraries}`)
}

const jarFiles = readdirSync(runnerLibraries).filter((file) =>
  file.endsWith('.jar'),
)

if (jarFiles.length === 0) {
  fail(`engine runner distribution contains no JAR files at ${runnerLibraries}`)
}

rmSync(generatedDirectory, { force: true, recursive: true })
mkdirSync(bundledRunnerDirectory, { recursive: true })
cpSync(runnerLibraries, bundledLibraries, { recursive: true })

run(jlinkExecutable, [
  '--add-modules',
  RUNTIME_MODULES.join(','),
  '--strip-debug',
  '--compress=zip-6',
  '--no-header-files',
  '--no-man-pages',
  '--output',
  bundledRuntime,
])

makeTreeOwnerWritable(generatedDirectory)

const bundledJava = join(
  bundledRuntime,
  'bin',
  windows ? 'java.exe' : 'java',
)
requireFile(bundledJava, 'bundled Java executable')

const requests = [
  {
    jsonrpc: '2.0',
    id: 1,
    method: 'engine.initialize',
    params: { protocolVersion: 1 },
  },
  {
    jsonrpc: '2.0',
    id: 2,
    method: 'engine.health',
  },
  {
    jsonrpc: '2.0',
    id: 3,
    method: 'seed.search',
    params: {
      firstSeed: 0,
      seedCount: 1,
      minecraftVersion: '1.21',
      requirements: [
        {
          id: 'bundle-smoke-village',
          structureType: 'village',
          center: { x: 0, z: 0 },
          radiusBlocks: 1000,
        },
      ],
      resultLimit: 1,
    },
  },
]

const smokeTest = run(
  bundledJava,
  [
    '-cp',
    join(bundledLibraries, '*'),
    ENGINE_MAIN_CLASS,
  ],
  {
    encoding: 'utf8',
    input: `${requests.map(JSON.stringify).join('\n')}\n`,
    maxBuffer: 10 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  },
)

if (smokeTest.stderr.trim()) {
  process.stderr.write(smokeTest.stderr)
}

verifySmokeTest(parseResponseLines(smokeTest.stdout))

const rootPackage = JSON.parse(
  readFileSync(join(projectRoot, 'package.json'), 'utf8'),
)

writeFileSync(
  join(generatedDirectory, 'bundle-manifest.json'),
  `${JSON.stringify(
    {
      version: rootPackage.version,
      javaModules: RUNTIME_MODULES,
      engineJarCount: jarFiles.length,
    },
    null,
    2,
  )}\n`,
)

console.log(
  `Prepared self-contained desktop resources in ${generatedDirectory}`,
)
