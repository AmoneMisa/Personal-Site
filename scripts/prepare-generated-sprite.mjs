import { resolve } from 'node:path'
import sharp from 'sharp'

const [source, target, rawWidth, rawHeight] = process.argv.slice(2)
if (!source || !target || !rawWidth || !rawHeight) {
  throw new Error('Usage: prepare-generated-sprite.mjs <source> <target> <width> <height>')
}

const { data, info } = await sharp(resolve(source)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
const visited = new Uint8Array(info.width * info.height)
const queue = new Int32Array(info.width * info.height)
let head = 0
let tail = 0

const isBackdrop = (pixel) => {
  const offset = pixel * 4
  const r = data[offset]
  const g = data[offset + 1]
  const b = data[offset + 2]
  return r > 205 && g > 205 && b > 205 && Math.max(r, g, b) - Math.min(r, g, b) < 20
}

const enqueue = (pixel) => {
  if (pixel < 0 || pixel >= visited.length || visited[pixel] || !isBackdrop(pixel)) return
  visited[pixel] = 1
  queue[tail++] = pixel
}

for (let x = 0; x < info.width; x += 1) {
  enqueue(x)
  enqueue((info.height - 1) * info.width + x)
}
for (let y = 0; y < info.height; y += 1) {
  enqueue(y * info.width)
  enqueue(y * info.width + info.width - 1)
}

while (head < tail) {
  const pixel = queue[head++]
  const x = pixel % info.width
  const y = Math.floor(pixel / info.width)
  data[pixel * 4 + 3] = 0
  if (x > 0) enqueue(pixel - 1)
  if (x + 1 < info.width) enqueue(pixel + 1)
  if (y > 0) enqueue(pixel - info.width)
  if (y + 1 < info.height) enqueue(pixel + info.width)
}

await sharp(data, { raw: info })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize(Number(rawWidth), Number(rawHeight), {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(resolve(target))

