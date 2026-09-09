import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { delimiter, dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')
const tauriDirectory = resolve(projectRoot, 'apps/desktop/src-tauri')
const releaseDirectory = join(tauriDirectory, 'target', 'release')
const bundleDirectory = join(releaseDirectory, 'bundle')

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
}

function readProductName() {
  const configurationPath = join(tauriDirectory, 'tauri.conf.json')
  const configuration = JSON.parse(readFileSync(configurationPath, 'utf8'))

  if (
    typeof configuration.productName !== 'string' ||
    configuration.productName.length === 0
  ) {
    fail(`productName is missing from ${configurationPath}`)
  }

  return configuration.productName
}

function removeDirectoryChildren(parent) {
  if (!existsSync(parent)) {
    return
  }

  for (const entry of readdirSync(parent, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      rmSync(join(parent, entry.name), { force: true, recursive: true })
    }
  }
}

function cleanGeneratedResourceCopies() {
  for (const resourcePath of [
    join(releaseDirectory, 'engine-runner'),
    join(releaseDirectory, 'java-runtime'),
    join(releaseDirectory, 'bundle-manifest.json'),
  ]) {
    rmSync(resourcePath, { force: true, recursive: true })
  }

  removeDirectoryChildren(join(bundleDirectory, 'deb'))
}

run(process.execPath, [join(scriptDirectory, 'prepare-desktop-bundle.mjs')])
cleanGeneratedResourceCopies()

const buildEnvironment = { ...process.env }

if (process.platform === 'linux') {
  const productName = readProductName()
  const appImageDirectory = join(bundleDirectory, 'appimage')
  const appDir = join(appImageDirectory, `${productName}.AppDir`)
  const appImageDebDirectory = join(bundleDirectory, 'appimage_deb')
  const javaLibraryDirectory = join(
    appDir,
    'usr',
    'lib',
    productName,
    'java-runtime',
    'lib',
  )

  rmSync(appImageDebDirectory, { force: true, recursive: true })
  rmSync(appDir, { force: true, recursive: true })

  buildEnvironment.LD_LIBRARY_PATH = [
    join(javaLibraryDirectory, 'server'),
    javaLibraryDirectory,
    process.env.LD_LIBRARY_PATH,
  ]
    .filter(Boolean)
    .join(delimiter)
}

const npmExecutable = process.platform === 'win32' ? 'npm.cmd' : 'npm'

run(
  npmExecutable,
  [
    'run',
    'tauri',
    '--workspace=@yocsow/desktop',
    '--',
    'build',
    '--config',
    'src-tauri/tauri.release.conf.json',
    ...process.argv.slice(2),
  ],
  { env: buildEnvironment },
)
