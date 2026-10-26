import assert from 'node:assert/strict'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import test from 'node:test'
import { JSDOM } from 'jsdom'
import { parse, compileScript } from '@vue/compiler-sfc'
import { transform } from 'esbuild'

const dom = new JSDOM('<div id="app"></div>', {url: 'https://example.test'})
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node']) globalThis[key] = dom.window[key]
const Vue = await import('vue')
for (const name of ['ref', 'reactive', 'computed', 'watch', 'onBeforeUnmount', 'useId']) globalThis[name] = Vue[name]
globalThis.useI18n = () => ({t: (key, params = {}) => `${key}${Object.keys(params).length ? JSON.stringify(params) : ''}`, locale: Vue.ref('ru')})
const source = await readFile(new URL('../app/components/search/ListingActivity.vue', import.meta.url), 'utf8')
const {descriptor} = parse(source)
const compiled = compileScript(descriptor, {id: 'activity-test', inlineTemplate: true})
const {code} = await transform(compiled.content.replace(/import FlatContactActions from [^;]+;/, 'const FlatContactActions = { render: () => null };'), {loader: 'ts', format: 'esm'})
const fixture = new URL(`.listing-activity-${process.pid}.mjs`, import.meta.url)
await writeFile(fixture, code)
const Component = (await import(fixture.href)).default
await unlink(fixture)
const tick = async () => {await new Promise(resolve => setImmediate(resolve)); await Vue.nextTick()}
const history = (date = '2026-08-12T09:00:00Z') => ({firstSeenAt: date, events: [], nextCursor: null})
const requests = []
globalThis.$fetch = (_url, options) => new Promise((resolve, reject) => requests.push({resolve, reject, ...options.params}))
let app
test.afterEach(() => {app?.unmount(); requests.length = 0; document.getElementById('app').innerHTML = ''})
function mount(id = 1, domain = 'flats') {
  const props = Vue.reactive({publicId: id, domain, modelValue: 'history'})
  app = Vue.createApp({render: () => Vue.h(Component, {...props, 'onUpdate:modelValue': value => props.modelValue = value})})
  app.mount('#app')
  return props
}

test('history and duplicate count resolve independently; switching tabs keeps loaded history', async () => {
  const props = mount()
  requests.find(r => r.section === 'history').resolve({...history(), events: [{id: '1', kind: 'date_updated', observedAt: '2026-10-26T09:01:00Z'}]})
  requests.find(r => r.section === 'duplicates').resolve({duplicateCount: 2, groups: []})
  await tick()
  assert.ok(document.body.textContent.includes('listingActivity.events.date_updated'))
  const duplicateTab = [...document.querySelectorAll('[role=tab]')].find(b => b.textContent.includes('duplicates'))
  assert.ok(duplicateTab.textContent.includes('2'))
  duplicateTab.click(); await tick()
  assert.equal(props.modelValue, 'duplicates')
  document.querySelectorAll('[role=tab]')[1].click(); await tick()
  assert.equal(props.modelValue, 'history')
  assert.equal(requests.length, 2)
})

test('slow responses for the previous listing cannot overwrite a new listing', async () => {
  const props = mount()
  const old = [...requests]
  props.publicId = 2; await tick()
  requests.filter(r => r.publicId === 2).forEach(r => r.resolve(r.section === 'history' ? history('2026-09-20T00:00:00Z') : {duplicateCount: 4, groups: []}))
  await tick()
  old.forEach(r => r.resolve(r.section === 'history' ? history('2020-01-01T00:00:00Z') : {duplicateCount: 99, groups: []}))
  await tick()
  assert.ok(document.body.textContent.includes('2026'))
  assert.ok(!document.body.textContent.includes('2020'))
  assert.ok(!document.body.textContent.includes('99'))
})

test('failed pagination preserves existing events and retries the same bigint cursor', async () => {
  mount()
  requests[0].resolve({...history(), events: [{id: 'one', kind: 'price_changed', price: 500, currency: 'USD', observedAt: '2026-10-26'}], nextCursor: '9007199254740995'})
  requests[1].resolve({duplicateCount: 0, groups: []}); await tick()
  document.querySelector('.listing-activity__link').click(); await tick()
  assert.equal(requests[2].before, '9007199254740995')
  requests[2].reject(new Error('offline')); await tick()
  assert.ok(document.body.textContent.includes('500 USD'))
  const retry = [...document.querySelectorAll('button')].find(b => b.textContent.includes('listingActivity.retry'))
  retry.click(); await tick()
  assert.equal(requests[3].before, '9007199254740995')
  requests[3].resolve({...history(), events: [{id: 'two', kind: 'content_changed', observedAt: '2026-10-25'}]}); await tick()
  assert.equal(document.querySelectorAll('.listing-activity__timeline li').length, 3)
})

test('a missing public id never requests activity; owner claims and unknown contacts stay explicit', async () => {
  mount(null); await tick()
  assert.equal(requests.length, 0)
  assert.ok(document.body.textContent.includes('listingActivity.unavailable'))
})

test('original URLs reject script schemes and duplicate groups retain commission and inactive state', async () => {
  const props = mount()
  requests[0].resolve(history())
  requests[1].resolve({duplicateCount: 1, groups: [{key: 'a', contact: null, sameAdvertiser: false, listings: [
    {publicId: 1, source: 'olx', title: 'Flat', current: true, active: true, advertiserType: 'owner_claim', commission: false, matchKind: 'current', url: 'javascript:alert(1)'},
    {publicId: 2, source: 'olx', title: 'Flat', current: false, active: false, advertiserType: 'agency', commission: true, matchKind: 'fingerprint', url: 'https://example.com/listing/2'},
  ]}]}); await tick()
  props.modelValue = 'duplicates'; await tick()
  assert.equal(document.querySelectorAll('a').length, 1)
  for (const label of ['owner_claim', 'agency', 'commissionNo', 'commissionYes', 'inactive', 'contactUnknown']) assert.ok(document.body.textContent.includes(label), label)
})

test('jobs show publisher groups, salary ranges, source dates and safe application links', async () => {
  const props = mount(101, 'jobs')
  requests[0].resolve(history())
  requests[1].resolve({duplicateCount: 1, groups: [
    {key: 'employer', company: 'Acme', advertiserType: 'direct', contact: null, sameAdvertiser: false, listings: [
      {publicId: 101, source: 'hh', company: 'Acme', title: 'Frontend', current: true, active: true, advertiserType: 'direct', matchKind: 'current', sourcePublishedAt: '2026-10-26T09:01:00Z', url: 'https://hh.ru/vacancy/1', applyUrl: 'https://acme.example/apply', salary: {min: 1000, max: 2000, currency: 'USD', period: 'month', gross: false}},
    ]},
    {key: 'agency', company: 'Acme', advertiserType: 'agency', contact: null, sameAdvertiser: false, listings: [
      {publicId: 102, source: 'workua', title: 'Frontend', current: false, active: true, advertiserType: 'agency', matchKind: 'same_role', url: 'https://work.ua/jobs/2', applyUrl: 'javascript:alert(1)', salary: {min: null, max: 1500, currency: 'USD', period: 'month', gross: true}},
    ]},
  ]}); await tick()
  props.modelValue = 'duplicates'; await tick()
  assert.equal(document.querySelectorAll('.listing-activity__group').length, 2)
  for (const key of ['jobDuplicates', 'salaryPeriods.month', 'salaryNet', 'salaryGross', 'salaryTo', 'sourceDate']) assert.ok(document.body.textContent.includes(key), key)
  const salaries = document.querySelectorAll('.listing-activity__salary')
  assert.ok(salaries[0].textContent.includes('USD'))
  assert.ok(salaries[1].textContent.includes('1 500'))
  const applyLinks = document.querySelectorAll('.listing-activity__apply')
  assert.equal(applyLinks.length, 1)
  assert.equal(applyLinks[0].href, 'https://acme.example/apply')
})
