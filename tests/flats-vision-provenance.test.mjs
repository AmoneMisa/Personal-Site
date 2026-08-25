import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const specTable = await readFile(new URL('../app/components/ui/SpecTable.vue', import.meta.url), 'utf8')

test('flat specs expose AI vision provenance without another network request', () => {
  assert.match(specTable, /flats:recent:v1/)
  assert.match(specTable, /visionDerivedFields\?: string\[\]/)
  assert.match(specTable, /vision\?: \{ derivedFields\?: string\[\] \}/)
  assert.match(specTable, /flats\.specBedrooms/)
  assert.match(specTable, /flats\.specBathrooms/)
  assert.match(specTable, /flats\.specCondition/)
  assert.match(specTable, /flats\.specParking/)
  assert.match(specTable, /flats\.specElevator/)
  assert.match(specTable, /flats\.specFurnished/)
  assert.match(specTable, /flats\.specBalcony/)
  assert.match(specTable, /flats\.specAC/)
  assert.match(specTable, /washingMachine/)
  assert.match(specTable, /dishwasher/)
  assert.match(specTable, /Данные из AI-Vision/)
  assert.match(specTable, /Data from AI Vision/)
  assert.match(specTable, /class="spec-table__ai-hint"/)
  assert.doesNotMatch(specTable, /\$fetch|safeFetch/)
})
