import { resolve } from 'node:path'
import sharp from 'sharp'

const usage = `Usage: build-animated-pet.mjs <source> <target> <width> <height> [fish|shark|jelly|seahorse|puffer]
  --eye u,v,r        eye centre and radius, normalised to the sprite's opaque box (repeatable)
  --mouth u,v,rx,ry  mouth centre and radii, same normalisation
  --no-face          skip blinking and mouth motion entirely
  --debug-face FILE  write a PNG with the detected face markers drawn on it
  --probe            print the face that would be used and exit without rendering`

const numbers = (raw, count, flag) => {
  const parts = String(raw ?? '').split(',').map(Number)
  if (parts.length !== count || parts.some((n) => !Number.isFinite(n))) {
    throw new Error(`${flag} expects ${count} comma-separated numbers`)
  }
  return parts
}

const argv = process.argv.slice(2)
const positional = []
const manualEyes = []
let manualMouth = null
let animateFace = true
let debugFacePath = null
let probeOnly = false
for (let i = 0; i < argv.length; i += 1) {
  const arg = argv[i]
  if (arg === '--eye') { const [u, v, r] = numbers(argv[++i], 3, '--eye'); manualEyes.push({ u, v, r }); continue }
  if (arg === '--mouth') { const [u, v, rx, ry] = numbers(argv[++i], 4, '--mouth'); manualMouth = { u, v, rx, ry }; continue }
  if (arg === '--no-face') { animateFace = false; continue }
  if (arg === '--debug-face') { debugFacePath = argv[++i]; continue }
  if (arg === '--probe') { probeOnly = true; continue }
  positional.push(arg)
}

const [source, target, rawWidth, rawHeight, mode = 'fish'] = positional
if (!source || !target || !rawWidth || !rawHeight) throw new Error(usage)

const width = Number(rawWidth)
const height = Number(rawHeight)
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }
const TAU = Math.PI * 2

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)
// Smooth 0..1 ramp with an easing exponent, used to blend a deformation in
// over a region of the body instead of switching it on at a hard edge.
const ramp = (n, power) => clamp01(n) ** power
// Bump that rises across [start, peak] and falls across [peak, end].
const band = (n, start, peak, end) => ramp((n - start) / (peak - start), 1) * ramp((end - n) / (end - peak), 1)

function crabRig(scuttle) {
  return {
    frames: 24,
    delay: Math.round(64 / scuttle),
    beats: 2,
    displace(u, v, t, out) {
      const side = Math.abs(u - 0.5) * 2
      const outward = u < 0.5 ? -1 : 1
      // Legs hang below the shell and reach furthest at the outer edges.
      const legs = ramp((v - 0.50) / 0.50, 1.3) * ramp((side - 0.12) / 0.88, 0.8)
      // Phase trails outward from the body, so the legs ripple in sequence.
      const phase = TAU * (2 * t - side * 0.45)
      // The two claws sit diagonally: raised at upper left, low at lower right.
      const clawHigh = band(u, 0.00, 0.14, 0.36) * ramp((0.52 - v) / 0.52, 1.1)
      const clawLow = band(u, 0.44, 0.62, 0.80) * ramp((v - 0.58) / 0.42, 1.1)
      out[0] = 0.052 * scuttle * legs * Math.sin(phase) * outward
        + 0.030 * scuttle * clawHigh * Math.sin(TAU * (2 * t + 0.35))
        + 0.022 * scuttle * clawLow * Math.sin(TAU * (2 * t + 0.75))
      out[1] = 0.046 * scuttle * legs * Math.cos(phase)
        + 0.034 * scuttle * clawHigh * Math.sin(TAU * (2 * t + 0.10))
        + 0.026 * scuttle * clawLow * Math.sin(TAU * (2 * t + 0.55))
        + 0.012 * Math.sin(TAU * (2 * t))
    },
  }
}

// Every rig maps a point on the sprite to a displacement, so different parts of
// the body move independently: a wave travels down a fish toward its tail, a
// jellyfish bell contracts while the tentacles trail a beat behind. `u` runs 0
// (left) to 1 (right) and `v` runs 0 (top) to 1 (bottom) across the artwork's
// opaque bounding box; the returned offsets are fractions of that box.
//
// The art is authored with every swimmer facing right, so the tail is always at
// low `u`. Displacement near the head is kept close to zero — faces read as
// broken the moment they wobble.
const rigs = {
  fish: {
    frames: 28,
    delay: 70,
    beats: 2,
    displace(u, v, t, out) {
      const tail = ramp((0.58 - u) / 0.58, 1.8)
      const bodyWave = Math.sin(TAU * (2 * t + u * 0.55))
      const pectoral = band(u, 0.30, 0.52, 0.78) * ramp((v - 0.48) / 0.34, 1)
      const dorsal = band(u, 0.28, 0.50, 0.76) * ramp((0.40 - v) / 0.34, 1)
      out[0] = 0.026 * tail * Math.sin(TAU * (2 * t + u * 0.55 + 0.25))
      out[1] = 0.155 * tail * bodyWave
        + 0.030 * pectoral * Math.sin(TAU * (4 * t + 0.25))
        + 0.020 * dorsal * Math.sin(TAU * (4 * t + 0.55))
        + 0.016 * Math.sin(TAU * t)
    },
  },
  // Large and comparatively stiff: one slow beat, a longer wavelength, and the
  // undulation confined to the rear third.
  shark: {
    frames: 28,
    delay: 82,
    beats: 1,
    displace(u, v, t, out) {
      const tail = ramp((0.52 - u) / 0.52, 2.1)
      const bodyWave = Math.sin(TAU * (t + u * 0.42))
      const pectoral = band(u, 0.34, 0.56, 0.82) * ramp((v - 0.52) / 0.36, 1)
      const dorsal = band(u, 0.36, 0.58, 0.84) * ramp((0.36 - v) / 0.30, 1)
      out[0] = 0.014 * tail * Math.sin(TAU * (t + u * 0.42 + 0.25))
      out[1] = 0.088 * tail * bodyWave
        + 0.020 * pectoral * Math.sin(TAU * (2 * t + 0.3))
        + 0.013 * dorsal * Math.sin(TAU * (2 * t + 0.6))
        + 0.011 * Math.sin(TAU * t)
    },
  },
  // Upright body, so the wave runs vertically. Seahorses hold the trunk almost
  // rigid and hover on a fluttering dorsal fin, so the fin gets the fastest
  // motion and the curled tail gets the widest sway.
  seahorse: {
    frames: 28,
    delay: 85,
    beats: 1,
    displace(u, v, t, out) {
      const tail = ramp((v - 0.46) / 0.54, 1.7)
      const sway = Math.sin(TAU * (t + v * 0.5))
      const dorsal = ramp((0.46 - u) / 0.28, 1) * band(v, 0.26, 0.50, 0.80)
      const crown = ramp((0.26 - v) / 0.26, 1.4)
      out[0] = 0.058 * tail * sway
        + 0.034 * dorsal * Math.sin(TAU * (5 * t))
        + 0.012 * crown * Math.sin(TAU * (2 * t + 0.4))
      out[1] = 0.024 * Math.sin(TAU * t)
        - 0.016 * tail * Math.cos(TAU * (t + v * 0.5))
    },
  },
  // Bell contracts and relaxes; the tentacles repeat the motion a beat later so
  // they whip instead of moving as one rigid piece.
  jelly: {
    frames: 28,
    delay: 95,
    beats: 1,
    displace(u, v, t, out) {
      const pulse = Math.sin(TAU * t)
      const bell = ramp((0.46 - v) / 0.46, 1.2)
      const tentacle = ramp((v - 0.36) / 0.64, 1.4)
      out[0] = -0.095 * pulse * bell * (u - 0.5)
        + 0.075 * tentacle * Math.sin(TAU * (t - 0.20 + v * 0.65))
      out[1] = -0.090 * pulse * bell * v
        + 0.038 * tentacle * Math.sin(TAU * (t - 0.28 + v * 0.65))
        - 0.030 * Math.max(0, pulse)
    },
  },
  // Walker, not a swimmer. Real crabs move their legs in a metachronal wave —
  // each leg a little behind its neighbour — so the phase is driven by distance
  // from the body centre rather than by a left/right split, which would look
  // like two halves flapping. The shell barely moves; the legs and claw tips do
  // nearly all of it.
  //
  // `scuttle` speeds the rig up and widens the leg throw for the panicked
  // variant, which is on screen while the crab flees or falls.
  crab: crabRig(1),
  'crab-panic': crabRig(1.55),
  // Round body that swells and settles around its own centre, with a small
  // tail beat layered on top.
  puffer: {
    frames: 28,
    delay: 90,
    beats: 1,
    displace(u, v, t, out) {
      const pulse = Math.sin(TAU * t)
      const inflate = 0.050 * pulse
      const tail = ramp((0.30 - u) / 0.30, 1.6)
      const pectoral = band(u, 0.34, 0.56, 0.82) * ramp((v - 0.50) / 0.34, 1)
      out[0] = (u - 0.5) * inflate * 1.6 + 0.018 * tail * Math.sin(TAU * (2 * t + 0.3))
      out[1] = (v - 0.5) * inflate * 2.0
        + 0.062 * tail * Math.sin(TAU * (2 * t + u * 0.5))
        + 0.020 * pectoral * Math.sin(TAU * (3 * t + 0.4))
        + 0.012 * Math.sin(TAU * t)
    },
  },
}

const rig = rigs[mode]
if (!rig) throw new Error(`Unknown mode "${mode}". Expected one of: ${Object.keys(rigs).join(', ')}`)

// Warping pushes pixels outside the artwork's original bounds, so the frames are
// built on an oversized canvas and only cropped back to the requested box once
// the true extent of the motion is known. That keeps fin tips and tentacles from
// being clipped without having to shrink the character to make room.
const padding = 1.35
const canvasWidth = Math.round(width * padding)
const canvasHeight = Math.round(height * padding)

// Fit the art to the *target* box first, then pad out to the render canvas.
// Resizing straight into the canvas would scale the artwork up to fill it, so
// the padding would exist in name only and any outward displacement would run
// off the edge — which is exactly how the inflating puffer used to clip.
const padX = Math.floor((canvasWidth - width) / 2)
const padY = Math.floor((canvasHeight - height) / 2)
const base = await sharp(resolve(source))
  .ensureAlpha()
  .resize(width, height, { fit: 'contain', background: transparent })
  .extend({
    left: padX,
    right: canvasWidth - width - padX,
    top: padY,
    bottom: canvasHeight - height - padY,
    background: transparent,
  })
  .raw()
  .toBuffer()

// Bounding box of the opaque artwork. Rigs are written against this box rather
// than the canvas so the same numbers work for any source padding or aspect.
let boxLeft = canvasWidth
let boxRight = -1
let boxTop = canvasHeight
let boxBottom = -1
for (let y = 0; y < canvasHeight; y += 1) {
  for (let x = 0; x < canvasWidth; x += 1) {
    if (base[(y * canvasWidth + x) * 4 + 3] < 8) continue
    if (x < boxLeft) boxLeft = x
    if (x > boxRight) boxRight = x
    if (y < boxTop) boxTop = y
    if (y > boxBottom) boxBottom = y
  }
}
if (boxRight < 0) throw new Error('Source sprite is fully transparent')
const boxWidth = Math.max(1, boxRight - boxLeft)
const boxHeight = Math.max(1, boxBottom - boxTop)

// Cartoon eyes in this art are a bright, low-saturation sclera wrapped around a
// dark pupil, which is a combination almost nothing else on the body produces.
// Detection finds bright blobs and keeps the ones that contain a plausible
// amount of dark pixels, then scores them on roundness. It is only a
// convenience: a wrong guess would deform a face, so anything it picks is
// printed, and `--eye` overrides it outright.
function detectEyes() {
  const luminance = new Float32Array(canvasWidth * canvasHeight)
  const bright = new Uint8Array(canvasWidth * canvasHeight)
  for (let pixel = 0; pixel < canvasWidth * canvasHeight; pixel += 1) {
    const offset = pixel * 4
    const r = base[offset], g = base[offset + 1], b = base[offset + 2]
    luminance[pixel] = 0.299 * r + 0.587 * g + 0.114 * b
    const saturation = Math.max(r, g, b) - Math.min(r, g, b)
    bright[pixel] = base[offset + 3] > 128 && luminance[pixel] > 198 && saturation < 38 ? 1 : 0
  }

  const boxArea = boxWidth * boxHeight
  const seen = new Uint8Array(canvasWidth * canvasHeight)
  const stack = new Int32Array(canvasWidth * canvasHeight)
  const found = []
  for (let start = 0; start < canvasWidth * canvasHeight; start += 1) {
    if (!bright[start] || seen[start]) continue
    let head = 0
    let tail = 0
    seen[start] = 1
    stack[tail++] = start
    let minX = canvasWidth, maxX = -1, minY = canvasHeight, maxY = -1, area = 0
    while (head < tail) {
      const pixel = stack[head++]
      const x = pixel % canvasWidth
      const y = (pixel / canvasWidth) | 0
      area += 1
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
      if (x > 0 && bright[pixel - 1] && !seen[pixel - 1]) { seen[pixel - 1] = 1; stack[tail++] = pixel - 1 }
      if (x + 1 < canvasWidth && bright[pixel + 1] && !seen[pixel + 1]) { seen[pixel + 1] = 1; stack[tail++] = pixel + 1 }
      if (y > 0 && bright[pixel - canvasWidth] && !seen[pixel - canvasWidth]) { seen[pixel - canvasWidth] = 1; stack[tail++] = pixel - canvasWidth }
      if (y + 1 < canvasHeight && bright[pixel + canvasWidth] && !seen[pixel + canvasWidth]) { seen[pixel + canvasWidth] = 1; stack[tail++] = pixel + canvasWidth }
    }
    if (area < boxArea * 0.0008 || area > boxArea * 0.05) continue
    const w = maxX - minX + 1
    const h = maxY - minY + 1
    const aspect = w / h
    if (aspect < 0.4 || aspect > 2.5) continue
    let dark = 0
    let opaque = 0
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const pixel = y * canvasWidth + x
        if (base[pixel * 4 + 3] < 128) continue
        opaque += 1
        if (luminance[pixel] < 95) dark += 1
      }
    }
    const darkFraction = opaque ? dark / opaque : 0
    if (darkFraction <= 0.10 || darkFraction >= 0.75) continue
    const roundness = 1 - Math.min(1, Math.abs(Math.log(aspect)) / Math.log(2.5))
    const darkFit = 1 - Math.min(1, Math.abs(darkFraction - 0.42) / 0.42)
    const size = Math.min(1, area / (boxArea * 0.004))
    const radius = Math.max(w, h) / 2 / boxHeight
    // A single eye wider than this is not an eye, it is several bright regions
    // that merged. Rejecting it forces an explicit --eye rather than silently
    // squashing half the face during a blink.
    if (radius > 0.12) continue
    found.push({
      score: roundness * 0.4 + darkFit * 0.45 + size * 0.15,
      u: ((minX + maxX) / 2 - boxLeft) / boxWidth,
      v: ((minY + maxY) / 2 - boxTop) / boxHeight,
      r: radius,
    })
  }

  found.sort((a, b) => b.score - a.score)
  if (!found.length || found[0].score < 0.45) return []
  const best = found[0]
  // A second eye sits at nearly the same height and is a similar size. Loose
  // limits here pick up snouts and belly patches instead.
  const partner = found.slice(1).find((c) => c.score > 0.4
    && Math.abs(c.v - best.v) < 0.09
    && Math.abs(c.u - best.u) > best.r * 0.8
    && c.r > best.r * 0.6 && c.r < best.r * 1.6)
  return partner ? [best, partner] : [best]
}

const eyes = animateFace ? (manualEyes.length ? manualEyes : detectEyes()) : []
const mouth = animateFace ? manualMouth : null
console.log(`mode=${mode} eyes=${eyes.length ? eyes.map((e) => `${e.u.toFixed(2)},${e.v.toFixed(2)},${e.r.toFixed(3)}`).join(' ') : 'none'}${mouth ? ` mouth=${mouth.u.toFixed(2)},${mouth.v.toFixed(2)}` : ''}`)

// Face features are guarded: within this mask the body rig's displacement is
// replaced by the single value sampled at the face anchor, so the face travels
// with the body but never stretches. Blink and mouth motion are then layered on
// top of that stable base.
const guard = new Float32Array(canvasWidth * canvasHeight)
const eyePixels = eyes.map((e) => ({
  x: boxLeft + e.u * boxWidth,
  y: boxTop + e.v * boxHeight,
  r: Math.max(2, e.r * boxHeight),
}))
const mouthPixels = mouth
  ? { x: boxLeft + mouth.u * boxWidth, y: boxTop + mouth.v * boxHeight, rx: Math.max(2, mouth.rx * boxWidth), ry: Math.max(2, mouth.ry * boxHeight) }
  : null

let anchorU = 0
let anchorV = 0
if (eyePixels.length || mouthPixels) {
  const points = [...eyePixels, ...(mouthPixels ? [mouthPixels] : [])]
  anchorU = points.reduce((sum, p) => sum + (p.x - boxLeft) / boxWidth, 0) / points.length
  anchorV = points.reduce((sum, p) => sum + (p.y - boxTop) / boxHeight, 0) / points.length
  for (let y = 0; y < canvasHeight; y += 1) {
    for (let x = 0; x < canvasWidth; x += 1) {
      let value = 0
      for (const eye of eyePixels) {
        const d = Math.hypot(x - eye.x, y - eye.y) / (eye.r * 2.4)
        value = Math.max(value, 1 - clamp01(d))
      }
      if (mouthPixels) {
        const d = Math.hypot((x - mouthPixels.x) / (mouthPixels.rx * 1.9), (y - mouthPixels.y) / (mouthPixels.ry * 1.9))
        value = Math.max(value, 1 - clamp01(d))
      }
      guard[y * canvasWidth + x] = value
    }
  }
}

if (debugFacePath) {
  const overlay = Buffer.from(base)
  for (let pixel = 0; pixel < canvasWidth * canvasHeight; pixel += 1) {
    const g = guard[pixel]
    if (g <= 0) continue
    const offset = pixel * 4
    overlay[offset] = Math.min(255, overlay[offset] + g * 160)
    overlay[offset + 3] = Math.max(overlay[offset + 3], Math.round(g * 120))
  }
  await sharp(overlay, { raw: { width: canvasWidth, height: canvasHeight, channels: 4 } })
    .flatten({ background: '#0d1520' })
    .png()
    .toFile(resolve(debugFacePath))
}

if (probeOnly) process.exit(0)

// Blink envelope: a fast close-and-open once per loop rather than a sine, so it
// reads as a blink instead of a permanent squint.
function blinkAmount(t) {
  const phase = 0.16
  const span = 0.13
  let delta = Math.abs(((t - phase + 0.5 + 1) % 1) - 0.5)
  if (delta > span / 2) return 0
  return 0.5 * (1 + Math.cos(Math.PI * (delta / (span / 2))))
}

// Bilinear sampling blends colour with transparent neighbours, which fringes the
// silhouette with dark pixels. Premultiplying first keeps edges clean.
const premultiplied = new Float32Array(base.length)
for (let pixel = 0; pixel < canvasWidth * canvasHeight; pixel += 1) {
  const offset = pixel * 4
  const alpha = base[offset + 3] / 255
  premultiplied[offset] = base[offset] * alpha
  premultiplied[offset + 1] = base[offset + 1] * alpha
  premultiplied[offset + 2] = base[offset + 2] * alpha
  premultiplied[offset + 3] = base[offset + 3]
}

const offsets = new Float64Array(2)
const frames = []
let unionLeft = canvasWidth
let unionRight = -1
let unionTop = canvasHeight
let unionBottom = -1

const anchorOffsets = new Float64Array(2)
const hasFace = eyePixels.length > 0 || mouthPixels !== null

for (let frame = 0; frame < rig.frames; frame += 1) {
  const t = frame / rig.frames
  const blink = blinkAmount(t)
  const gaze = 0.010 * Math.sin(TAU * (t + 0.3))
  const mouthOpen = mouthPixels ? 0.16 * (0.5 + 0.5 * Math.sin(TAU * (2 * t + 0.5))) : 0
  if (hasFace) rig.displace(anchorU, anchorV, t, anchorOffsets)
  const warped = Buffer.alloc(canvasWidth * canvasHeight * 4)
  for (let y = 0; y < canvasHeight; y += 1) {
    const v = (y - boxTop) / boxHeight
    for (let x = 0; x < canvasWidth; x += 1) {
      const u = (x - boxLeft) / boxWidth
      rig.displace(u, v, t, offsets)

      if (hasFace) {
        const g = guard[y * canvasWidth + x]
        if (g > 0) {
          // Hold the face rigid, moving it by whatever the body does at the
          // anchor instead of letting the body wave stretch it.
          offsets[0] = offsets[0] * (1 - g) + anchorOffsets[0] * g
          offsets[1] = offsets[1] * (1 - g) + anchorOffsets[1] * g
          for (const eye of eyePixels) {
            const lid = 1 - clamp01(Math.hypot(x - eye.x, y - eye.y) / (eye.r * 1.7))
            if (lid <= 0) continue
            // Collapsing the eye toward its centre reads as an eyelid closing.
            offsets[1] -= ((y - eye.y) / boxHeight) * blink * 0.9 * lid
            offsets[0] += gaze * lid
          }
          if (mouthPixels && mouthOpen > 0) {
            const d = 1 - clamp01(Math.hypot((x - mouthPixels.x) / mouthPixels.rx, (y - mouthPixels.y) / mouthPixels.ry))
            if (d > 0) offsets[1] += ((y - mouthPixels.y) / boxHeight) * mouthOpen * d
          }
        }
      }

      // Inverse mapping: ask where this output pixel came from, so the result
      // has no gaps the way a forward scatter would.
      const sourceX = x - offsets[0] * boxWidth
      const sourceY = y - offsets[1] * boxHeight
      const x0 = Math.floor(sourceX)
      const y0 = Math.floor(sourceY)
      const fx = sourceX - x0
      const fy = sourceY - y0
      let r = 0
      let g = 0
      let b = 0
      let a = 0
      for (let j = 0; j < 2; j += 1) {
        const sy = y0 + j
        if (sy < 0 || sy >= canvasHeight) continue
        const weightY = j ? fy : 1 - fy
        if (weightY <= 0) continue
        for (let i = 0; i < 2; i += 1) {
          const sx = x0 + i
          if (sx < 0 || sx >= canvasWidth) continue
          const weight = weightY * (i ? fx : 1 - fx)
          if (weight <= 0) continue
          const offset = (sy * canvasWidth + sx) * 4
          r += premultiplied[offset] * weight
          g += premultiplied[offset + 1] * weight
          b += premultiplied[offset + 2] * weight
          a += premultiplied[offset + 3] * weight
        }
      }
      if (a < 1) continue
      const target = (y * canvasWidth + x) * 4
      const scale = 255 / a
      warped[target] = Math.min(255, r * scale)
      warped[target + 1] = Math.min(255, g * scale)
      warped[target + 2] = Math.min(255, b * scale)
      warped[target + 3] = Math.min(255, a)
      if (a >= 8) {
        if (x < unionLeft) unionLeft = x
        if (x > unionRight) unionRight = x
        if (y < unionTop) unionTop = y
        if (y > unionBottom) unionBottom = y
      }
    }
  }
  frames.push(warped)
}

// One crop rectangle shared by every frame. Cropping each frame to its own
// content would make the character jitter as the crop chased the motion.
const cropWidth = unionRight - unionLeft + 1
const cropHeight = unionBottom - unionTop + 1

// The crop already contains the motion headroom, so it can fill the requested
// box edge to edge. Insetting again here would shrink the character by however
// far it happens to move.
const rendered = []
for (const frame of frames) {
  const centred = await sharp(frame, { raw: { width: canvasWidth, height: canvasHeight, channels: 4 } })
    .extract({ left: unionLeft, top: unionTop, width: cropWidth, height: cropHeight })
    .resize(width, height, { fit: 'contain', background: transparent })
    .raw()
    .toBuffer()
  rendered.push(centred)
}

await sharp(Buffer.concat(rendered), {
  raw: { width, height: height * rig.frames, channels: 4, pageHeight: height },
})
  // These are flat cartoon sprites with large areas of near-flat colour, so they
  // survive a much cheaper encode than photographic art would: at q70 the head
  // is indistinguishable from q86 at 2x zoom, for roughly 40% of the bytes.
  // `effort: 6` costs encode time only. Every frame of every mood ships to the
  // homepage, so the bytes matter more than the last few percent of fidelity.
  .webp({ quality: 70, alphaQuality: 80, effort: 6, loop: 0, delay: Array(rig.frames).fill(rig.delay) })
  .toFile(resolve(target))
