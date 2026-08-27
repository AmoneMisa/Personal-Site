import { resolve } from 'node:path'
import sharp from 'sharp'

const [source, target, rawWidth, rawHeight, crop = 'full'] = process.argv.slice(2)
if (!source || !target || !rawWidth || !rawHeight) {
  throw new Error('Usage: prepare-generated-sprite.mjs <source> <target> <width> <height> [full|left|right]')
}

const input = sharp(resolve(source))
const metadata = await input.metadata()
const halfWidth = Math.floor((metadata.width ?? 0) / 2)
const thirdWidth = Math.floor((metadata.width ?? 0) / 3)
const cropHeight = crop.endsWith('90') ? Math.floor((metadata.height ?? 0) * 0.9) : metadata.height
const cropped = crop.startsWith('left')
  ? input.extract({ left: 0, top: 0, width: halfWidth, height: cropHeight })
  : crop.startsWith('right')
    ? input.extract({ left: (metadata.width ?? 0) - halfWidth, top: 0, width: halfWidth, height: cropHeight })
    : crop === 'first'
      ? input.extract({ left: 0, top: 0, width: thirdWidth, height: cropHeight })
      : crop === 'second'
        ? input.extract({ left: thirdWidth, top: 0, width: thirdWidth, height: cropHeight })
        : crop === 'third'
          ? input.extract({ left: (metadata.width ?? 0) - thirdWidth, top: 0, width: thirdWidth, height: cropHeight })
    : input
const { data, info } = await cropped.ensureAlpha().raw().toBuffer({ resolveWithObject: true })
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

// Image models can leave tiny disconnected sparkles or watermark-like debris
// around an otherwise transparent sprite. Keep only the largest opaque island;
// every aquarium character is one connected silhouette.
visited.fill(0)
let largest = []
for (let start = 0; start < visited.length; start += 1) {
  if (visited[start] || data[start * 4 + 3] < 24) continue
  const component = []
  head = 0
  tail = 0
  visited[start] = 1
  queue[tail++] = start
  while (head < tail) {
    const pixel = queue[head++]
    component.push(pixel)
    const x = pixel % info.width
    const y = Math.floor(pixel / info.width)
    for (const neighbour of [x > 0 ? pixel - 1 : -1, x + 1 < info.width ? pixel + 1 : -1, y > 0 ? pixel - info.width : -1, y + 1 < info.height ? pixel + info.width : -1]) {
      if (neighbour < 0 || visited[neighbour] || data[neighbour * 4 + 3] < 24) continue
      visited[neighbour] = 1
      queue[tail++] = neighbour
    }
  }
  if (component.length > largest.length) largest = component
}
visited.fill(0)
for (const pixel of largest) visited[pixel] = 1
for (let pixel = 0; pixel < visited.length; pixel += 1) {
  if (!visited[pixel]) data[pixel * 4 + 3] = 0
}

await sharp(data, { raw: info })
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .resize(Number(rawWidth), Number(rawHeight), {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  })
  .webp({ quality: 92, alphaQuality: 100 })
  .toFile(resolve(target))
