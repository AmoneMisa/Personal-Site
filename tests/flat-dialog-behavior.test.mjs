import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile, writeFile, mkdir, unlink } from 'node:fs/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'
import { parse, compileScript } from '@vue/compiler-sfc'
import { transform } from 'esbuild'

const dom = new JSDOM('<!doctype html><body><div id="app"></div></body>', { url: 'https://example.test/' })
for (const key of ['window', 'document', 'Element', 'HTMLElement', 'SVGElement', 'Node', 'MutationObserver']) globalThis[key] = dom.window[key]
HTMLElement.prototype.getClientRects = function () { return this.hidden ? [] : [{ width: 1, height: 1 }] }
const Vue = await import('vue')
for (const name of ['ref', 'reactive', 'computed', 'watch', 'onMounted', 'onBeforeUnmount', 'nextTick']) globalThis[name] = Vue[name]
globalThis.useI18n = () => ({ t: key => key, locale: Vue.ref('ru') })

async function compile(path, id, rewrite = source => source) {
  const source = await readFile(resolve(path), 'utf8')
  const compiled = compileScript(parse(source).descriptor, { id, inlineTemplate: true })
  const { code } = await transform(rewrite(compiled.content), { loader: 'ts', format: 'esm', define: { 'import.meta.server': 'false' } })
  await mkdir(resolve('.tmp/test-fixtures'), { recursive: true })
  const fixture = resolve(`.tmp/test-fixtures/${id}-${process.pid}.mjs`)
  await writeFile(fixture, code)
  try {
    return (await import(pathToFileURL(fixture).href)).default
  } finally {
    await unlink(fixture)
  }
}
const Modal = await compile('app/components/U/Modal.vue', 'flat-modal-test')
const SelectMenu = await compile('app/components/U/SelectMenu.vue', 'flat-select-test')
const Details = await compile('app/components/search/SearchDetailsModal.vue', 'flat-details-test')
const Card = await compile('app/components/flats/FlatCard.vue', 'flat-card-test', source => source.replace(
  /import ListingActivityLine from [^;]+;/,
  'const ListingActivityLine = { render: () => null };',
))
const { renderToString } = await import('vue/server-renderer')
const { activateModalDialog, registerModalBranch } = await import('~/utils/modalDialog.ts')
let app
test.afterEach(() => {
  app?.unmount()
  app = null
  document.getElementById('app').innerHTML = ''
})
test.after(() => dom.window.close())

test('modal moves and traps focus, makes its background inert, and restores focus', async () => {
  const open = Vue.ref(false)
  app = Vue.createApp({ render: () => Vue.h('main', [
    Vue.h('button', { id: 'opener', onClick: () => { open.value = true } }, 'Open'),
    Vue.h(Modal, { open: open.value, title: 'Flat', 'onUpdate:open': value => { open.value = value } }, {
      body: () => [Vue.h('button', { id: 'first' }, 'First'), Vue.h('button', { id: 'last' }, 'Last')],
    }),
  ]) })
  app.component('UIcon', { render: () => null })
  app.mount('#app')
  const opener = document.getElementById('opener')
  opener.focus()
  opener.click()
  await Vue.nextTick()
  const dialog = document.querySelector('[role=dialog]')
  assert.ok(dialog.contains(document.activeElement))
  assert.equal(document.getElementById('app').hasAttribute('inert'), true)
  document.getElementById('last').focus()
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
  assert.equal(document.activeElement, dialog.querySelector('button'))
  document.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  await Vue.nextTick()
  assert.equal(document.querySelector('[role=dialog]'), null)
  assert.equal(document.activeElement, opener)
  assert.equal(document.getElementById('app').hasAttribute('inert'), false)
  assert.equal(document.body.style.overflow, '')
})

test('nested dialogs and teleported select popups keep focus and scroll ownership', () => {
  const background = document.getElementById('app')
  background.innerHTML = '<button id="before">Before</button>'
  const outer = document.createElement('div')
  outer.innerHTML = '<button id="trigger">Select</button>'
  document.body.append(outer)
  const releaseOuter = activateModalDialog(outer)
  const popup = document.createElement('div')
  popup.innerHTML = '<input>'
  document.body.append(popup)
  const releasePopup = registerModalBranch(outer.querySelector('button'), popup)
  popup.querySelector('input').focus()
  assert.equal(document.activeElement, popup.querySelector('input'))
  assert.equal(popup.hasAttribute('inert'), false)
  const nested = document.createElement('div')
  nested.innerHTML = '<button>Close photo</button>'
  document.body.append(nested)
  const releaseNested = activateModalDialog(nested)
  assert.equal(outer.hasAttribute('inert'), true)
  assert.ok(nested.contains(document.activeElement))
  releaseNested()
  nested.remove()
  assert.equal(document.body.style.overflow, 'hidden')
  assert.equal(document.activeElement, popup.querySelector('input'))
  releasePopup()
  popup.remove()
  releaseOuter()
  outer.remove()
  assert.equal(document.body.style.overflow, '')
  assert.equal(background.hasAttribute('inert'), false)
})

test('select popup inside a modal accepts focus and consumes Escape before its parent', async () => {
  const open = Vue.ref(true)
  app = Vue.createApp({ render: () => Vue.h(Modal, { open: open.value, title: 'Filters', 'onUpdate:open': value => { open.value = value } }, {
    body: () => Vue.h(SelectMenu, { items: Array.from({ length: 8 }, (_, index) => ({ label: String(index), value: index })) }),
  }) })
  app.component('UIcon', { render: () => null })
  app.mount('#app')
  await Vue.nextTick()
  const trigger = document.querySelector('.u-select-menu__trigger')
  trigger.click()
  await Vue.nextTick()
  await Vue.nextTick()
  const search = document.querySelector('.u-select-menu__search')
  assert.equal(document.activeElement, search)
  assert.equal(search.closest('[inert]'), null)
  search.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
  await Vue.nextTick()
  assert.equal(document.querySelector('.u-select-menu__popup'), null)
  assert.equal(open.value, true)
  assert.equal(document.activeElement, trigger)
})

test('all Flat Finder routes retain modal width, identity and layer', async () => {
  const UModal = { props: ['maxWidth', 'zIndex', 'title'], setup: props => () => Vue.h('div', { 'data-width': props.maxWidth, 'data-z': props.zIndex, 'data-title': props.title }) }
  for (const path of ['/flat-finder', '/flat-finder/favorites', '/flat-finder/recent', '/flat-finder/hidden', '/en/flat-finder/owners/0123456789abcdef01234567']) {
    globalThis.useRoute = () => ({ path })
    const instance = Vue.createSSRApp(Details, { open: true, title: 'Apartment', flatListing: { publicId: 42, country: 'RO', city: 'Bucharest' } })
    instance.component('u-modal', UModal)
    instance.component('u-icon', { render: () => null })
    const html = await renderToString(instance)
    assert.match(html, /data-width="960px"/)
    assert.match(html, /data-z="12000"/)
    assert.match(html, /#42/)
  }
})

test('card exposes a focusable open button without nesting favorite and hide actions', async () => {
  let opened = 0
  let saved = 0
  app = Vue.createApp(Card, {
    listing: { id: 'flat-1', source: 'olx', country: 'RO' },
    presentation: { title: 'Apartment', price: '500 USD', badges: [] },
    photo: null,
    noPhotoLabel: 'No photo', checkingLabel: 'Checking', favoriteLabel: 'Save', hideLabel: 'Hide',
    onOpen: () => { opened++ }, onToggleFavorite: () => { saved++ },
  })
  app.component('u-icon', { render: () => null })
  app.component('UiDraggablePills', { render: () => null })
  app.mount('#app')
  const button = document.querySelector('.flat-card__open')
  assert.equal(button.tagName, 'BUTTON')
  assert.equal(button.type, 'button')
  button.focus()
  assert.equal(document.activeElement, button)
  button.click()
  await Vue.nextTick()
  assert.equal(opened, 1)
  document.querySelector('[aria-label="Save"]').click()
  assert.equal(saved, 1)
  assert.equal(opened, 1)
  assert.equal(document.querySelector('button button'), null)
})

test('results loader contains the grid and leaves filters and map outside its inert subtree', async () => {
  const source = await readFile(resolve('app/pages/flat-finder/[...slug].vue'), 'utf8')
  const template = parse(source).descriptor.template.ast
  const find = (node, predicate) => predicate(node) ? node : (node.children || []).map(child => find(child, predicate)).find(Boolean)
  const loader = find(template, node => node.tag === 'UiResultsLoader')
  assert.ok(loader)
  assert.ok(find(loader, node => node.tag === 'SearchResultGrid'))
  assert.equal(find(loader, node => node.tag === 'form' || /flat-?map/i.test(node.tag || '')), undefined)
  assert.ok(find(template, node => node.tag === 'form'))
})
