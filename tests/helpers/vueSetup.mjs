import * as Vue from 'vue'

const renderer = Vue.createRenderer({
  createElement: () => ({}),
  createText: () => ({}),
  createComment: () => ({}),
  insert() {},
  remove() {},
  patchProp() {},
  setElementText() {},
  setText() {},
  setComment() {},
  parentNode: () => null,
  nextSibling: () => null,
})

export function withVueSetup(t, factory) {
  let value
  globalThis.onBeforeUnmount = Vue.onBeforeUnmount
  const app = renderer.createApp({
    setup() {
      value = factory()
      return () => null
    },
  })
  app.mount({})
  t.after(() => app.unmount())
  return { value, unmount: () => app.unmount() }
}
