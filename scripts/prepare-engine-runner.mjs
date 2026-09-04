import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(scriptDirectory, '..')
const task = ':engine-runner:installDist'

const command =
  process.platform === 'win32'
    ? process.env.ComSpec ?? 'cmd.exe'
    : './gradlew'

const args =
  process.platform === 'win32'
    ? ['/d', '/s', '/c', `gradlew.bat ${task}`]
    : [task]

const result = spawnSync(command, args, {
  cwd: projectRoot,
  stdio: 'inherit',
})

if (result.error) {
  throw result.error
}

if (result.status === null) {
  throw new Error(
    `Gradle terminated without an exit code${
      result.signal === null ? '' : ` (${result.signal})`
    }`,
  )
}

process.exitCode = result.status