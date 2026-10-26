import assert from 'node:assert/strict'
import test from 'node:test'
import { Rect, StaticCanvas } from 'fabric'
import { ref } from 'vue'
import { usePdfCanvasHistory } from '../app/composables/pdfEditor/usePdfCanvasHistory.ts'

test('PDF history preserves custom edit metadata with the installed Fabric serializer', () => {
  const metadata = { id: 'original-1', tool: 'text', opacityPct: 80, orig: { page: 1, index: 2 }, name: 'Original text' }
  const object = Object.assign(new Rect({ width: 20, height: 10 }), metadata)
  // Serialization needs no canvas rendering or browser graphics context.
  const canvas = Object.assign(Object.create(StaticCanvas.prototype), { _objects: [object], includeDefaultValues: true })
  const pageJson = {}
  let saves = 0
  const history = usePdfCanvasHistory({ page: ref(1), pageJson, getCanvas: () => canvas, scheduleSave: () => { saves++ } })
  history.pushHistory()
  const serialized = pageJson[1].objects[0]
  for (const [key, value] of Object.entries(metadata)) assert.deepEqual(serialized[key], value)
  assert.equal(saves, 1)
  assert.deepEqual(history.history.stack[0], pageJson[1])
})
