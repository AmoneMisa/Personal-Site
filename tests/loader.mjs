// Lets the tests import server modules the way Nuxt does.
//
// Two things node's own resolver will not do: the project alias "~~/..." that
// Nitro provides, and TypeScript's extensionless relative imports
// ("./hiringCursors"). Both are resolved here so a test can import any server
// util directly, with no build step.

import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function firstExisting(candidates) {
  return candidates.find((candidate) => existsSync(candidate))
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith('~~/') || specifier.startsWith('~/')) {
    const relative = specifier.replace(/^~~?\//, '')
    const found = firstExisting([
      join(root, relative),
      join(root, `${relative}.ts`),
      join(root, `${relative}.js`),
      join(root, relative, 'index.ts'),
    ])
    if (found) return next(pathToFileURL(found).href, context)
  }

  if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier) && context.parentURL) {
    const base = fileURLToPath(new URL(specifier, context.parentURL))
    const found = firstExisting([`${base}.ts`, join(base, 'index.ts')])
    if (found) return next(pathToFileURL(found).href, context)
  }

  return next(specifier, context)
}
