// Overlay a normalized 0.05 grid on a sprite's content bounding box so face
// landmarks can be read straight off the image as the u/v values that
// build-animated-pet.mjs expects for --eye and --mouth.
//
//   node scripts/face-grid.mjs <sprite> <out.png> [scale=3]
//
// The grid spans the content bbox, not the canvas, which is the same box the
// animator normalizes against — so 0.5 on the grid is 0.5 to the rig.
import sharp from 'sharp'

const [src, out, scaleArg] = process.argv.slice(2)
const scale = Number(scaleArg ?? 3)

const { data, info } = await sharp(src, { page: 0, pages: 1 }).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 24) {
      if (x < x0) x0 = x
      if (x > x1) x1 = x
      if (y < y0) y0 = y
      if (y > y1) y1 = y
    }
  }
}
const bw = x1 - x0 + 1
const bh = y1 - y0 + 1
const W = Math.round(bw * scale)
const H = Math.round(bh * scale)

const lines = []
for (let i = 0; i <= 20; i++) {
  const f = i / 20
  const major = i % 4 === 0
  const c = major ? '#ff2d55' : '#00e5ff'
  const w = major ? 1.4 : 0.6
  lines.push(`<line x1="${f * W}" y1="0" x2="${f * W}" y2="${H}" stroke="${c}" stroke-width="${w}" opacity="0.75"/>`)
  lines.push(`<line x1="0" y1="${f * H}" x2="${W}" y2="${f * H}" stroke="${c}" stroke-width="${w}" opacity="0.75"/>`)
  if (major) {
    lines.push(`<text x="${f * W + 2}" y="11" fill="#ff2d55" font-size="11" font-family="monospace">${f.toFixed(1)}</text>`)
    lines.push(`<text x="2" y="${f * H - 2}" fill="#ff2d55" font-size="11" font-family="monospace">${f.toFixed(1)}</text>`)
  }
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">${lines.join('')}</svg>`

const base = await sharp(src, { page: 0, pages: 1 })
  .extract({ left: x0, top: y0, width: bw, height: bh })
  .resize(W, H, { kernel: 'nearest' })
  .toBuffer()

await sharp({ create: { width: W, height: H, channels: 4, background: { r: 16, g: 22, b: 38, alpha: 255 } } })
  .composite([{ input: base }, { input: Buffer.from(svg) }])
  .png()
  .toFile(out)

console.log(`${src.split(/[\\/]/).pop()} bbox ${bw}x${bh} at (${x0},${y0}) -> ${out}`)
