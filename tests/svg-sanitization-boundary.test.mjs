import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const sanitizer = readFileSync(new URL('../app/utils/svgEditor/sanitizeSvg.ts', import.meta.url), 'utf8')
const shell = readFileSync(new URL('../app/components/svgEditor/SvgEditorShell.vue', import.meta.url), 'utf8')
const transform = readFileSync(new URL('../app/components/svgEditor/TransformEditorModal.vue', import.meta.url), 'utf8')

test('SVG sanitizer strips executable and foreign-content boundaries', () => {
  for (const tag of ['script', 'foreignobject', 'iframe', 'object', 'embed']) {
    assert.match(sanitizer, new RegExp(`['"]${tag}['"]`, 'i'))
  }
  assert.match(sanitizer, /name\.startsWith\(['"]on['"]\)/)
  assert.match(sanitizer, /javascript\\s\*:/)
  assert.match(sanitizer, /xlink:href/)
})

test('SVG shell sanitizes input and modal outputs before v-html state', () => {
  assert.match(shell, /parseAndSanitizeSvg/)
  assert.match(shell, /commitSanitizedSvg\(payload\.svg\)/)
  assert.match(shell, /v-html="previewSvg"/)
  assert.doesNotMatch(shell, /previewSvg\.value\s*=\s*payload\.svg/)
})

test('transform editor never mounts raw SVG input through innerHTML', () => {
  assert.match(transform, /const sanitized = sanitizeSvgMarkup\(svgCode\)/)
  assert.match(transform, /container\.innerHTML = sanitized/)
  assert.doesNotMatch(transform, /container\.innerHTML = svgCode/)
  assert.match(transform, /sanitizeSvgMarkup\(serialize\(result\.svg\)\)/)
})
