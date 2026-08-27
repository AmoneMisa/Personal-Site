import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const sprites = resolve(root, 'public/images/ocean-creatures')
const builder = resolve(root, 'scripts/build-animated-pet.mjs')

// Every animated sprite the aquarium ships, with the box it is rendered at and
// the face landmarks that auto-detection cannot find on its own.
//
// `face` is appended verbatim to the build command. Omit it to let the eye
// detector run; sleeping and narrowed-eye variants correctly detect nothing and
// simply skip the blink.
//
// `src`/`out` override the default `<id>.webp` -> `<id>-animated.webp` naming.
const jellyPinkFace = [
  '--eye', '0.655,0.225,0.075',
  '--eye', '0.875,0.28,0.058',
  '--mouth', '0.735,0.335,0.055,0.042',
]

const pets = [
  { id: 'blue-fish', w: 240, h: 160, mode: 'fish', face: ['--eye', '0.80,0.51,0.09', '--mouth', '0.855,0.685,0.04,0.032'] },
  { id: 'blue-fish-interest', w: 240, h: 160, mode: 'fish' },
  { id: 'blue-fish-panic', w: 240, h: 160, mode: 'fish' },
  { id: 'clownfish', w: 240, h: 160, mode: 'fish' },
  { id: 'clownfish-interest', w: 240, h: 160, mode: 'fish' },
  { id: 'clownfish-panic', w: 240, h: 160, mode: 'fish' },
  { id: 'clownfish-v2', w: 240, h: 160, mode: 'fish' },
  { id: 'jelly-blue', w: 105, h: 120, mode: 'jelly' },
  { id: 'jelly-blue-angry', w: 105, h: 120, mode: 'jelly' },
  { id: 'jelly-blue-play', w: 105, h: 120, mode: 'jelly' },
  { id: 'jelly-blue-sleep', w: 105, h: 120, mode: 'jelly' },
  { id: 'jelly-pink', w: 120, h: 109, mode: 'jelly', face: jellyPinkFace },
  { id: 'jelly-pink-hq', w: 360, h: 327, mode: 'jelly', face: jellyPinkFace },
  { id: 'jelly-pink-play', w: 160, h: 146, mode: 'jelly', face: ['--eye', '0.65,0.25,0.07', '--eye', '0.79,0.30,0.06', '--mouth', '0.72,0.35,0.055,0.045'] },
  { id: 'jelly-pink-angry', w: 160, h: 146, mode: 'jelly', face: ['--eye', '0.63,0.30,0.07', '--eye', '0.79,0.33,0.06', '--mouth', '0.72,0.40,0.05,0.03'] },
  { id: 'jelly-pink-sleep', w: 160, h: 146, mode: 'jelly' },
  { id: 'puffer-clean', w: 240, h: 148, mode: 'puffer' },
  { id: 'puffer-normal', w: 240, h: 148, mode: 'puffer' },
  { id: 'seahorse-clean', w: 140, h: 240, mode: 'seahorse' },
  { id: 'seahorse-clean-hq', w: 280, h: 480, mode: 'seahorse' },
  { id: 'seahorse-heart', w: 140, h: 240, mode: 'seahorse' },
  { id: 'seahorse-tired', w: 140, h: 240, mode: 'seahorse' },
  { id: 'shark-clean', w: 320, h: 198, mode: 'shark', face: ['--eye', '0.72,0.46,0.089', '--mouth', '0.72,0.63,0.12,0.07'] },
  { id: 'shark-clean-hq', w: 640, h: 396, mode: 'shark', face: ['--eye', '0.72,0.46,0.089', '--mouth', '0.72,0.63,0.12,0.07'] },
  // Shark expression overlays. AquariumPetSprite cross-fades these over the
  // resting sprite, so they run the same rig at the same box to stay in step.
  // shark-hunt ships animated under its plain name, so it needs an explicit
  // source: feeding the animation back into the builder would compound the
  // warp of whatever frame happened to be read. shark-hunt-source.webp is the
  // neutral resting frame and exists only to be rebuilt from.
  { id: 'shark-hunt', w: 320, h: 198, mode: 'shark', src: 'shark-hunt-source', out: 'shark-hunt', face: ['--eye', '0.72,0.44,0.065', '--mouth', '0.76,0.65,0.13,0.08'] },
  { id: 'shark-curious', w: 320, h: 198, mode: 'shark', face: ['--eye', '0.725,0.405,0.077', '--mouth', '0.82,0.68,0.04,0.035'] },
  { id: 'shark-annoyed', w: 320, h: 198, mode: 'shark', face: ['--eye', '0.70,0.475,0.055', '--eye', '0.82,0.47,0.050', '--mouth', '0.755,0.655,0.085,0.03'] },
  // The header crab walks rather than swims, and the panicked sprite is on
  // screen only while it is fleeing or falling, so it scuttles harder.
  { id: 'header-crab', w: 220, h: 160, mode: 'crab', face: ['--eye', '0.455,0.21,0.062', '--eye', '0.675,0.29,0.058', '--mouth', '0.51,0.51,0.075,0.055'] },
  { id: 'header-crab-surprised', w: 220, h: 160, mode: 'crab-panic', face: ['--eye', '0.465,0.21,0.065', '--eye', '0.655,0.28,0.055', '--mouth', '0.525,0.505,0.05,0.065'] },
]

const argv = process.argv.slice(2)
const outIndex = argv.indexOf('--out')
const outDir = outIndex === -1 ? sprites : resolve(argv[outIndex + 1])
const only = argv.filter((arg, index) => !arg.startsWith('-') && index !== outIndex + 1)

let failed = 0
for (const pet of pets) {
  if (only.length && !only.includes(pet.id)) continue
  const source = resolve(sprites, `${pet.src ?? pet.id}.webp`)
  if (!existsSync(source)) {
    console.error(`missing source: ${pet.src ?? pet.id}.webp`)
    failed += 1
    continue
  }
  const target = resolve(outDir, `${pet.out ?? `${pet.id}-animated`}.webp`)
  const args = [builder, source, target, String(pet.w), String(pet.h), pet.mode, ...(pet.face ?? [])]
  const run = spawnSync(process.execPath, args, { encoding: 'utf8' })
  if (run.status !== 0) {
    console.error(`${pet.id}: ${run.stderr.trim()}`)
    failed += 1
    continue
  }
  console.log(`${pet.id.padEnd(22)} ${run.stdout.trim()}`)
}

if (failed) process.exitCode = 1
