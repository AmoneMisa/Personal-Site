---
name: webp-animation
description: >
  Generate animated WebP sprites for the aquarium mascots in
  public/images/ocean-creatures/. Covers cleaning raw generated art into a
  transparent sprite, building the looping animated WebP, naming conventions,
  canonical dimensions, and wiring the result into aquariumCreatures.ts.
  Use when the user says "animated webp", "new creature", "new fish/jelly/
  seahorse/shark", "add a mascot", "regenerate sprite", "make it hq",
  "animate this image", or asks to replace/upgrade an ocean-creature asset.
user-invocable: true
argument-hint: "[source image] [creature id]"
---

# Animated WebP mascots

Two-stage pipeline, both stages powered by `sharp` (already a dependency —
no ffmpeg, cwebp, or img2webp needed).

```
raw generated art  --prepare-generated-sprite-->  <name>.webp      (1 frame)
<name>.webp        --build-animated-pet------->  <name>-animated.webp (28 frames)
```

Never hand-author frames. Never commit the raw source art — only the two
WebP outputs go into `public/images/ocean-creatures/`.

## Stage 1 — clean the sprite

```bash
node scripts/prepare-generated-sprite.mjs <source> <target> <width> <height> [crop]
```

`crop` is `full` (default), `left`, `right`, `first`, `second`, `third` — use
these when the image model returned a contact sheet of 2 or 3 poses. Suffix a
crop with `90` (e.g. `left90`) to also drop the bottom 10%, which is where
models like to put captions.

What it does, in order:
1. Flood-fills the near-white backdrop to transparent, starting from all four edges.
2. Keeps only the **largest connected opaque island** — this is what deletes
   stray sparkles, drop shadows, and watermark debris.
3. Trims transparent margin, resizes `fit: contain` into the target box.
4. Writes WebP at `quality: 92, alphaQuality: 100`.

Because of step 2, every creature must be **one connected silhouette**. Art
with a detached fin, floating bubble, or separated tentacle tip will lose the
detached part. If that happens, regenerate the art rather than editing the script.

## Stage 2 — animate

```bash
node scripts/build-animated-pet.mjs <source> <target> <width> <height> [mode] [face options]
```

`mode` is `fish` (default), `shark`, `jelly`, `seahorse`, or `puffer`. Pick it
to match the creature's `kind`, not its look — the CSS rig in
`app/assets/css/ocean-creature-rig.css` assumes the baked motion matches.

| kind | mode | motion | frames / delay |
| --- | --- | --- | --- |
| `fish` | `fish` | two tail beats per loop, fin flutter | 28 / 70 ms |
| `shark` | `shark` | one slow beat, stiffer body, rear-third only | 28 / 82 ms |
| `seahorse` | `seahorse` | upright sway, curled tail, fast dorsal fin | 28 / 85 ms |
| `jelly` | `jelly` | bell contracts, tentacles trail a beat behind | 28 / 95 ms |
| `puffer` | `puffer` | inflate/deflate around centre + tail beat | 28 / 90 ms |

Output is `loop: 0`, `quality: 86`, `alphaQuality: 100`.

### Rebuilding the whole cast

`scripts/regenerate-animated-pets.mjs` holds every sprite's box, mode and face
landmarks, so a rig change can be rolled out in one command:

```bash
node scripts/regenerate-animated-pets.mjs                    # overwrite in place
node scripts/regenerate-animated-pets.mjs --out /tmp/staging # dry run
node scripts/regenerate-animated-pets.mjs shark-clean-hq     # one sprite
```

Always stage into `--out` first and eyeball the frames before overwriting — the
animated files are binary, so `git diff` tells you nothing.

`shark-hunt.webp` is deliberately absent from the table: it ships only as an
animated file with no static source, so it cannot be regenerated. If the rigs
change enough to matter visually, it will drift out of style with the rest of
the shark variants and needs new source art.

### How the motion is produced

This is **not** a rigid transform of the whole sprite. Each rig is a
displacement field: it maps a point on the artwork to an offset, so different
parts of the body move independently and the character deforms.

- Coordinates are `u` (0 left → 1 right) and `v` (0 top → 1 bottom), normalised
  over the sprite's **opaque bounding box**, not the canvas. Source padding and
  aspect therefore do not affect the rig.
- All the art faces right, so the tail is always at low `u`. Rigs ramp
  displacement to roughly zero near the head — faces read as broken the instant
  they wobble.
- Swimming comes from a traveling wave: amplitude ramps toward the tail and the
  phase includes a `u` term, e.g. `sin(TAU * (2 * t + u * 0.55))`.
- Frames are rendered on a canvas 1.35x the requested size, then all frames are
  cropped by a **single shared rectangle** (the union of every frame's content)
  and resized into the target box. This means fin tips and tentacles cannot clip,
  the character does not jitter from a per-frame crop, and it stays the same
  apparent size as the static sprite. Do not add an extra inset here — the union
  crop already reserves the headroom.
- Sampling is inverse-mapped and bilinear, on premultiplied alpha. Premultiplying
  is what keeps a dark fringe from appearing along the silhouette.

### Faces

Body rigs deliberately leave the head almost still, so the face is animated
separately: the eyes blink once per loop and the mouth opens and closes twice.

```
--eye u,v,r        eye centre and radius (repeatable, once per eye)
--mouth u,v,rx,ry  mouth centre and radii
--no-face          skip face motion entirely
--debug-face FILE  write a PNG tinting the region the face rig will affect
--probe            print the detected face and exit without rendering
```

All values are normalised to the sprite's opaque bounding box. `r` and `ry` are
fractions of box **height**; `u`, `rx` are fractions of box **width**.

Two things make this work:

- **Blinking is a squash, not a drawn eyelid.** Pixels collapse toward the eye
  centre for a few frames. On this art style that reads as a blink, and it needs
  no extra artwork.
- **The face is guarded.** Inside the face region the body rig's displacement is
  replaced by the single value sampled at the face anchor. The face therefore
  travels with the body — important for the jellyfish, whose bell contracts
  underneath it — but never stretches. Without this the bell pulse visibly
  smears the eyes.

Eye positions are auto-detected when `--eye` is omitted: the detector looks for
a bright, low-saturation sclera wrapped around a dark pupil and scores
candidates on roundness. **It is a convenience, not a contract.** It gets the
single-eyed swimmers right but merges jelly-pink's two eyes into one oversized
blob, and it never finds mouths. The script always prints the face it used —
check that line, or run `--debug-face`, before trusting a new character.

Verified coordinates for the current cast:

All measured coordinates live in `scripts/regenerate-animated-pets.mjs` — that
table is the source of truth, and the ones below are the ones worth knowing by
hand because detection gets them wrong:

| sprite | face options |
| --- | --- |
| `shark-clean`, `shark-clean-hq` | `--eye 0.72,0.46,0.089 --mouth 0.72,0.63,0.12,0.07` |
| `blue-fish` | `--eye 0.80,0.51,0.09 --mouth 0.855,0.685,0.04,0.032` |
| `jelly-pink`, `jelly-pink-hq` | `--eye 0.655,0.225,0.075 --eye 0.875,0.28,0.058 --mouth 0.735,0.335,0.055,0.042` |
| `jelly-pink-play` | `--eye 0.65,0.25,0.07 --eye 0.79,0.30,0.06 --mouth 0.72,0.35,0.055,0.045` |
| `jelly-pink-angry` | `--eye 0.63,0.30,0.07 --eye 0.79,0.33,0.06 --mouth 0.72,0.40,0.05,0.03` |

Detection alone is correct for the rest of the cast — including the two-eyed
`clownfish`, `puffer-normal`, `jelly-blue-play` and `seahorse-tired`, all of
which were verified with `--debug-face`. None of those have measured mouth
coordinates yet, so they blink but do not talk.

Sleep and narrowed-eye variants (`jelly-*-sleep`, `jelly-blue-angry`) report
`eyes=none`. That is correct, not a failure — closed eyes have no sclera, so
no blink is applied.

To measure a new character, crop its head, upscale it, and overlay gridlines at
0.05 intervals of the bounding box — reading `u`/`v` off that is far faster and
more reliable than guessing and re-rendering.

### Tuning a rig

Edit the `rigs` table at the top of the script. Amplitudes are fractions of the
bounding box, so `0.155` means 15.5% of body height. Keep the number of wave
cycles per loop a whole number or the loop will visibly jump. Verify by
rendering to a temp path and diffing frame content — a correct fish or shark
shows displacement peaking at the tail and decaying to near zero at the head.

## Naming

`<id>[-<variant>][-hq][-animated].webp`

- no suffix → the resting sprite referenced by `CreaturePreset.src`
- `-clean` → fragment-stripped from a generated contact sheet (shark, seahorse, puffer)
- `-hq` → 2x the canonical box, for creatures rendered large on screen
- `-animated` → the looping output of stage 2
- variants: `interest`, `panic` (fish/shark), `sleep`, `play`, `angry` (jelly),
  `heart`, `tired` (seahorse), `hunt`, `curious`, `annoyed` (shark)

## Canonical dimensions

| creature | box | hq box |
| --- | --- | --- |
| shark | 320x198 | 640x396 |
| seahorse | 140x240 | 280x480 |
| puffer | 240x148 | — |
| blue-fish, clownfish | 240x160 | — |
| jelly-blue | 105x120 | — |
| jelly-pink | 120x109 | 360x327 |
| header-crab | 220x160 | — |

Keep the aspect ratio identical between a creature's normal and `-hq` box, and
across all of its variants. The runtime cross-fades variants over the base
sprite, so a changed aspect ratio produces a visible jump on mood change.

## Wiring it up

Register in `app/utils/aquariumCreatures.ts` → `aquariumCreatures[]`:

```ts
{ id: "jelly-pink", src: "/images/ocean-creatures/jelly-pink-hq-animated.webp",
  kind: "jelly", top: "72%", size: "clamp(76px, 6vw, 118px)",
  duration: "47s", delay: "-6s", direction: "rtl", opacity: 0.68 }
```

- `size` is a CSS `clamp()`; the intrinsic WebP size does not control display size.
- Stagger `delay` negatively so creatures do not enter in lockstep.
- `MAX_VISIBLE_PETS` caps how many render at once, so the array can exceed it.
- Add a `steeringProfiles` entry only when introducing a new `kind`.

### Variant filenames are derived from `id`, not `src`

`AquariumPetSprite.vue` builds fish and jelly variant paths as
`` `/images/ocean-creatures/${creature.id}-${variant}-animated.webp` ``
(`fishExpressionSrc`, `jellyMoodSrc`). Seahorse and shark variants are hardcoded.

So promoting a fish or jelly to `-hq` upgrades **only the resting sprite** —
its `interest`/`panic`/`sleep`/`play`/`angry` variants still resolve to the
non-hq files and will look softer on mood change. Either regenerate those
variants at hq too, or accept the mismatch deliberately.

Missing variant files fail silently: `handleImageError` hides the broken `<img>`.
Check the network panel, not the console.

## Size budget

Animated output is roughly 20x the static sprite. Measured: ~200–450 KB at 1x,
~890 KB–1.07 MB at `-hq`. These are eagerly loaded on the homepage, so weigh
each `-hq` promotion — three of them already cost ~2.9 MB. Prefer `-hq` only
for creatures with a large `clamp()` max (shark, seahorse).

## Verify

`tests/regressions.test.mjs` pins the exact filenames referenced by the
aquarium and asserts the variant files exist on disk. Any rename or `-hq`
swap must update that test.

```bash
npm test
```

Then confirm visually with the preview tools — animated WebP does not play in
a static snapshot, so use a screenshot plus a network check that the file
actually loaded. Animation is suppressed under `prefers-reduced-motion`; the
baked WebP loop is not, which is a known and accepted gap.
