import { resolve } from 'node:path'
import sharp from 'sharp'

const [source, target, rawWidth, rawHeight, mode = 'fish'] = process.argv.slice(2)
if (!source || !target || !rawWidth || !rawHeight) {
  throw new Error('Usage: build-animated-pet.mjs <source> <target> <width> <height> [fish|jelly|seahorse|puffer]')
}

const width = Number(rawWidth)
const height = Number(rawHeight)
const frameCount = 28
const delay = Array(frameCount).fill(90)
const transparent = { r: 0, g: 0, b: 0, alpha: 0 }

function motion(frame) {
  const phase = frame / frameCount * Math.PI * 2
  const wave = Math.sin(phase)
  const halfWave = Math.sin(phase * 2)
  if (mode === 'jelly') return { scaleX: 1 + wave * 0.025, scaleY: 1 - wave * 0.04, angle: halfWave * 0.45, x: halfWave, y: -wave * 3 }
  if (mode === 'seahorse') return { scaleX: 1 + halfWave * 0.012, scaleY: 1 + wave * 0.018, angle: wave * 3.2, x: halfWave, y: Math.cos(phase) * 3 }
  if (mode === 'puffer') return { scaleX: 1 + wave * 0.018, scaleY: 1 + wave * 0.03, angle: halfWave * 0.7, x: halfWave, y: -wave * 2 }
  return { scaleX: 1 + halfWave * 0.012, scaleY: 1 - halfWave * 0.008, angle: wave * 1.4, x: wave * 2, y: halfWave * 1.5 }
}

const frameBuffers = []
for (let frame = 0; frame < frameCount; frame += 1) {
  const { scaleX, scaleY, angle, x, y } = motion(frame)
  const spriteWidth = Math.max(1, Math.round(width * 0.94 * scaleX))
  const spriteHeight = Math.max(1, Math.round(height * 0.94 * scaleY))
  const sprite = await sharp(resolve(source))
    .resize(spriteWidth, spriteHeight, { fit: 'contain', background: transparent })
    .rotate(angle, { background: transparent })
    .resize(width, height, { fit: 'inside', withoutEnlargement: true })
    .png()
    .toBuffer()
  const metadata = await sharp(sprite).metadata()
  const left = Math.round((width - (metadata.width ?? spriteWidth)) / 2 + x)
  const top = Math.round((height - (metadata.height ?? spriteHeight)) / 2 + y)
  const raw = await sharp({ create: { width, height, channels: 4, background: transparent } })
    .composite([{ input: sprite, left, top }])
    .raw()
    .toBuffer()
  frameBuffers.push(raw)
}

await sharp(Buffer.concat(frameBuffers), {
  raw: { width, height: height * frameCount, channels: 4, pageHeight: height },
})
  .webp({ quality: 88, alphaQuality: 100, loop: 0, delay })
  .toFile(resolve(target))
