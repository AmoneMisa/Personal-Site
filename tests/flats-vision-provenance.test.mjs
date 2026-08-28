import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { locationLabel } from '../app/utils/locationLabels.ts'

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
  assert.match(specTable, /flats\.specMetro/)
  assert.match(specTable, /flats\.specNearby/)
  assert.match(specTable, /washingMachine/)
  assert.match(specTable, /dishwasher/)
  assert.match(specTable, /Данные при помощи AI-зрения/)
  assert.match(specTable, /Data obtained with AI vision/)
  assert.match(specTable, /class="spec-table__ai-hint spec-table__ai-hint_grid"[\s\S]*?>\(\?\)<\/span>/)
  assert.match(specTable, /class="spec-table__ai-hint"[\s\S]*?>\(\?\)<\/span>/)
  assert.doesNotMatch(specTable, />AI<\/span>/)
  assert.doesNotMatch(specTable, /\$fetch|safeFetch/)
})

test('generic AI/location semantics are localized from parsing-lexicon', () => {
  assert.equal(locationLabel('Railway station', 'en', 'any'), 'railway station')
  assert.equal(locationLabel('Railway station', 'ru', 'any'), 'вокзал')
  assert.equal(locationLabel('Airport', 'ru', 'any'), 'аэропорт')
  assert.equal(locationLabel('Kindergarten', 'ru', 'any'), 'детский сад')
})
