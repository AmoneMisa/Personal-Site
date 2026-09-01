import { createHash } from 'node:crypto'
import { existsSync, promises as fs } from 'node:fs'
import path from 'node:path'

const ROOTS = ['app', 'server', 'shared', 'backend/src']
const SOURCE_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.vue', '.py', '.scss', '.css'])
const SKIP_SEGMENTS = new Set(['node_modules', '.nuxt', '.output', 'dist', 'coverage', 'public'])
const GOD_FILE_LINES = 500
const DUPLICATE_WINDOW_LINES = 12
const MIN_DUPLICATE_CHARS = 220
const TAIL_RE = /\b(TODO|FIXME|HACK|XXX|DEPRECATED)\b/i

async function walk(root) {
  if (!existsSync(root)) return []
  const out = []
  const entries = await fs.readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    if (SKIP_SEGMENTS.has(entry.name)) continue
    const full = path.join(root, entry.name)
    if (entry.isDirectory()) {
      out.push(...await walk(full))
      continue
    }
    if (SOURCE_EXTENSIONS.has(path.extname(entry.name))) out.push(full)
  }
  return out
}

function normalizeDuplicateLine(line) {
  return line.trim().replace(/\s+/g, ' ')
}

function duplicateFingerprint(lines) {
  const normalized = lines.map(normalizeDuplicateLine).filter(Boolean).join('\n')
  if (normalized.length < MIN_DUPLICATE_CHARS) return null
  return {
    normalized,
    hash: createHash('sha1').update(normalized).digest('hex'),
  }
}

const files = (await Promise.all(ROOTS.map(walk))).flat().sort()
const metrics = []
const tails = []
const duplicateWindows = new Map()

for (const file of files) {
  const source = await fs.readFile(file, 'utf8')
  const lines = source.split(/\r?\n/)
  metrics.push({ file, lines: lines.length, bytes: Buffer.byteLength(source) })

  lines.forEach((line, index) => {
    if (TAIL_RE.test(line)) tails.push({ file, line: index + 1, text: line.trim().slice(0, 240) })
  })

  for (let index = 0; index <= lines.length - DUPLICATE_WINDOW_LINES; index += 1) {
    const window = lines.slice(index, index + DUPLICATE_WINDOW_LINES)
    const fingerprint = duplicateFingerprint(window)
    if (!fingerprint) continue
    const locations = duplicateWindows.get(fingerprint.hash) || []
    locations.push({ file, line: index + 1, normalized: fingerprint.normalized })
    duplicateWindows.set(fingerprint.hash, locations)
  }
}

const largest = [...metrics]
  .sort((a, b) => b.lines - a.lines || b.bytes - a.bytes)
  .slice(0, 40)
const godCandidates = largest.filter((item) => item.lines >= GOD_FILE_LINES)
const duplicates = [...duplicateWindows.values()]
  .filter((locations) => new Set(locations.map((item) => item.file)).size > 1)
  .map((locations) => ({
    locations: locations.map(({ file, line }) => ({ file, line })),
    sample: locations[0].normalized.slice(0, 500),
  }))
  .sort((a, b) => b.locations.length - a.locations.length)
  .slice(0, 50)

console.log(JSON.stringify({
  scannedFiles: files.length,
  godFileThresholdLines: GOD_FILE_LINES,
  largest,
  godCandidates,
  tails,
  literalDuplicateWindows: duplicates,
}, null, 2))
