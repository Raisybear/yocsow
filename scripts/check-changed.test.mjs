import assert from 'node:assert/strict'
import test from 'node:test'
import { createCheckPlan } from './check-changed.mjs'
import './minecraft-version-catalog.test.mjs'

function stepIds(plan) {
  return plan.steps.map((step) => step.id)
}

test('selects changed and related frontend tests', () => {
  const plan = createCheckPlan([
    'apps/desktop/src/components/SeedMapWorkspace.tsx',
    'apps/desktop/src/components/SeedMapWorkspace.test.tsx',
  ])

  assert.equal(plan.mode, 'targeted')
  assert.deepEqual(stepIds(plan), [
    'whitespace-working',
    'whitespace-staged',
    'frontend-lint',
    'frontend-typecheck',
    'frontend-test-files',
    'frontend-test-related',
  ])

  assert.deepEqual(plan.steps.at(-2).args, [
    'run',
    'test:files',
    '--',
    'src/components/SeedMapWorkspace.test.tsx',
  ])
  assert.deepEqual(plan.steps.at(-1).args, [
    'run',
    'test:related',
    '--',
    'src/components/SeedMapWorkspace.tsx',
  ])
})

test('runs the matching Rust module and dependent Java checks', () => {
  const plan = createCheckPlan([
    'apps/desktop/src-tauri/src/seed_search.rs',
  ])

  assert.deepEqual(stepIds(plan), [
    'whitespace-working',
    'whitespace-staged',
    'java-check',
    'rust-format',
    'rust-lint',
    'rust-test-seed_search',
  ])
  assert.deepEqual(plan.steps[2].args.slice(-2), [
    ':engine:check',
    ':engine-runner:check',
  ])
  assert.equal(plan.steps.at(-1).args.at(-1), 'seed_search')
})

test('runs incremental native and Java checks for C changes', () => {
  const plan = createCheckPlan([
    'native/cubiomes/src/yocsow_cubiomes.c',
  ])

  assert.deepEqual(stepIds(plan), [
    'whitespace-working',
    'whitespace-staged',
    'native-configure',
    'native-build',
    'native-test',
    'java-check',
  ])
})

test('keeps documentation-only checks lightweight', () => {
  const plan = createCheckPlan([
    'README.md',
    'docs/development/toolchain.md',
  ])

  assert.equal(plan.mode, 'targeted')
  assert.deepEqual(stepIds(plan), [
    'whitespace-working',
    'whitespace-staged',
  ])
})

test('falls back to full verification for unknown files', () => {
  const plan = createCheckPlan(['unexpected/project.file'])

  assert.equal(plan.mode, 'full')
  assert.deepEqual(plan.reasons, ['unexpected/project.file'])
  assert.deepEqual(stepIds(plan), ['full-verification'])
})

test('forces complete checks for explicitly selected areas', () => {
  const plan = createCheckPlan([], {
    areas: ['frontend', 'rust'],
  })

  assert.equal(plan.mode, 'targeted')
  assert.ok(stepIds(plan).includes('frontend-test-all'))
  assert.ok(stepIds(plan).includes('frontend-build'))
  assert.ok(stepIds(plan).includes('rust-test-all'))
})

test('runs the selector tests when development tooling changes', () => {
  const plan = createCheckPlan(['scripts/check-changed.mjs'])

  assert.deepEqual(stepIds(plan), [
    'whitespace-working',
    'whitespace-staged',
    'tooling-test',
  ])
})

test('checks frontend consumers when the Minecraft catalog changes', () => {
  const plan = createCheckPlan([
    'config/minecraft-java-releases.json',
    'scripts/minecraft-version-catalog.mjs',
  ])

  assert.deepEqual(stepIds(plan), [
    'whitespace-working',
    'whitespace-staged',
    'minecraft-version-catalog-test',
    'frontend-lint',
    'frontend-typecheck',
    'frontend-test-related',
  ])
  assert.deepEqual(plan.steps.at(-1).args, [
    'run',
    'test:related',
    '--',
    'src/domain/minecraft-version.ts',
  ])
})

test('uses full verification when requested', () => {
  const plan = createCheckPlan([], { all: true })

  assert.equal(plan.mode, 'full')
  assert.deepEqual(plan.reasons, ['--all'])
  assert.deepEqual(stepIds(plan), ['full-verification'])
})
