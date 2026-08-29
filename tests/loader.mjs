// Lets the tests import server and app modules the way Nuxt does.
//
// Three things node's own resolver will not do: the project alias "~~/..."
// that Nitro provides (root-relative — server/, shared/, etc.), the "~/..."
// alias which in Nuxt 4 resolves against <root>/app (not the project root —
// this tripped up the first version of this loader, since server/ code
// happens to also read as root-relative and "~/utils/x" silently 404'd for
// any app/ composable/util), and TypeScript's extensionless relative imports
// ("./hiringCursors"). All three are resolved here so a test can import any
// server or app module directly, with no build step.

import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function firstExisting(candidates) {
  return candidates.find((candidate) => existsSync(candidate))
}

export function resolve(specifier, context, next) {
  if (specifier.startsWith('~~/')) {
    const relative = specifier.slice('~~/'.length)
    const found = firstExisting([
      join(root, relative),
      join(root, `${relative}.ts`),
      join(root, `${relative}.js`),
      join(root, relative, 'index.ts'),
    ])
    if (found) return next(pathToFileURL(found).href, context)
  }

  if (specifier.startsWith('~/')) {
    const relative = specifier.slice('~/'.length)
    // Nuxt 4's "~" resolves against <root>/app. Root-relative is tried too,
    // since some pre-Nuxt-4 code in this repo may still assume the old
    // <root>-rooted "~" and happens to work by resolving into shared/server.
    const found = firstExisting([
      join(root, 'app', relative),
      join(root, 'app', `${relative}.ts`),
      join(root, 'app', `${relative}.js`),
      join(root, 'app', relative, 'index.ts'),
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
